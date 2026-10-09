import { eq, and } from 'drizzle-orm';
import { db, generationReadings, solarInstallations } from '../db/index.js';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '../errors/app-error.js';
import {
  RawReadingInput,
  normalizeReadingPayload,
} from '../schemas/reading.schema.js';

export interface FormattedReading {
  id: string;
  installationId: string;
  timestamp: string;
  powerKw: number;
  energyKwh: number;
  voltage: number;
  currentA: number;
  frequencyHz: number;
  power_kw: number;
  energy_kwh: number;
  current_a: number;
  frequency_hz: number;
  createdAt: string;
}

export interface IngestionResult {
  reading: FormattedReading;
  isDuplicate: boolean;
}

function formatReading(row: typeof generationReadings.$inferSelect): FormattedReading {
  const pKw = parseFloat(row.powerKw);
  const eKwh = parseFloat(row.energyKwh);
  const v = parseFloat(row.voltage);
  const iA = parseFloat(row.currentA);
  const fHz = parseFloat(row.frequencyHz);

  return {
    id: row.id,
    installationId: row.installationId,
    timestamp: row.timestamp.toISOString(),
    powerKw: pKw,
    energyKwh: eKwh,
    voltage: v,
    currentA: iA,
    frequencyHz: fHz,
    power_kw: pKw,
    energy_kwh: eKwh,
    current_a: iA,
    frequency_hz: fHz,
    createdAt: row.createdAt.toISOString(),
  };
}

export class ReadingService {
  /**
   * Ingest a single time-series generation reading for an authenticated solar installation
   * Validates capacity bounds (power <= capacity * 1.2) and enforces idempotent ingestion
   */
  static async ingestReading(
    installationId: string,
    rawInput: RawReadingInput,
    deviceInstalledCapacityKw?: number
  ): Promise<IngestionResult> {
    const normalized = normalizeReadingPayload(rawInput);
    const readingTimestamp = new Date(normalized.timestamp);

    // 1. Resolve installation capacity for physical bounds validation
    let capacityKw = deviceInstalledCapacityKw;

    if (capacityKw === undefined) {
      const [installation] = await db
        .select({
          id: solarInstallations.id,
          installedCapacityKw: solarInstallations.installedCapacityKw,
          status: solarInstallations.status,
        })
        .from(solarInstallations)
        .where(eq(solarInstallations.id, installationId))
        .limit(1);

      if (!installation) {
        throw new NotFoundError(`Solar installation '${installationId}' was not found`);
      }

      if (installation.status !== 'active') {
        throw new ForbiddenError(
          `Solar installation '${installationId}' is currently ${installation.status} and cannot ingest readings`
        );
      }

      capacityKw = parseFloat(installation.installedCapacityKw);
    }

    // 2. Capacity bounds check: power <= capacity * 1.2 (inverter clipping / max tolerance)
    const maxPermissiblePower = capacityKw * 1.2;
    if (normalized.powerKw > maxPermissiblePower) {
      throw new ValidationError(
        `Instantaneous power (${normalized.powerKw} kW) exceeds maximum permissible threshold for installation capacity (${capacityKw} kW * 1.2 = ${maxPermissiblePower.toFixed(2)} kW)`,
        [
          {
            field: 'power_kw',
            message: `Power generation exceeds the upper electrical bound of ${maxPermissiblePower.toFixed(2)} kW`,
            code: 'EXCEEDS_CAPACITY_BOUND',
          },
        ]
      );
    }

    // 3. Idempotency Check: check for duplicate timestamp for the same installation
    const [existingReading] = await db
      .select()
      .from(generationReadings)
      .where(
        and(
          eq(generationReadings.installationId, installationId),
          eq(generationReadings.timestamp, readingTimestamp)
        )
      )
      .limit(1);

    if (existingReading) {
      // Compare values to distinguish idempotent retry from conflicting data
      const existingPower = parseFloat(existingReading.powerKw);
      const existingEnergy = parseFloat(existingReading.energyKwh);

      const isIdentical =
        Math.abs(existingPower - normalized.powerKw) < 0.001 &&
        Math.abs(existingEnergy - normalized.energyKwh) < 0.001;

      if (!isIdentical) {
        throw new ConflictError(
          `A conflicting generation reading for installation '${installationId}' at timestamp '${normalized.timestamp}' already exists with different values`,
          [
            {
              field: 'timestamp',
              message: `Reading timestamp '${normalized.timestamp}' conflicts with existing data (${existingPower} kW, ${existingEnergy} kWh)`,
              code: 'DUPLICATE_TIMESTAMP_CONFLICT',
            },
          ]
        );
      }

      // Idempotent retry: return existing reading without creating duplicate rows
      return {
        reading: formatReading(existingReading),
        isDuplicate: true,
      };
    }

    // 4. Persist append-only time-series record into generation_readings
    const [inserted] = await db
      .insert(generationReadings)
      .values({
        installationId,
        timestamp: readingTimestamp,
        powerKw: normalized.powerKw.toFixed(3),
        energyKwh: normalized.energyKwh.toFixed(3),
        voltage: normalized.voltage.toFixed(2),
        currentA: normalized.currentA.toFixed(2),
        frequencyHz: normalized.frequencyHz.toFixed(2),
      })
      .returning();

    return {
      reading: formatReading(inserted!),
      isDuplicate: false,
    };
  }
}
