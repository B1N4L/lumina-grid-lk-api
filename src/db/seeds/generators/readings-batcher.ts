import { db } from '../../index.js';
import { generationReadings, NewGenerationReading } from '../../schema/generation-readings.js';
import { NewSolarInstallation } from '../../schema/solar-installations.js';
import { generateReadingTelemetry } from './solar-model.js';
import { logger } from '../../../config/logger.js';

export interface SeedBatchOptions {
  batchSize?: number;
  daysOfHistory?: number;
}

export async function seedGenerationReadings(
  installations: NewSolarInstallation[],
  options: SeedBatchOptions = {}
): Promise<{ totalReadings: number; elapsedSeconds: number }> {
  const batchSize = options.batchSize ?? 1500;
  const daysOfHistory = options.daysOfHistory ?? 7; // 1 week per coursework requirement

  logger.info(`⚡ Preparing 15-minute generation readings for ${installations.length} installations across ${daysOfHistory} days...`);
  const startTime = Date.now();

  // Anchor time: 7 days ago starting at 00:00:00 UTC
  const now = new Date();
  const startTimestamp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysOfHistory, 0, 0, 0));

  const totalIntervals = daysOfHistory * 96; // 96 fifteen-minute intervals per 24 hours
  const expectedTotalReadings = installations.length * totalIntervals;
  logger.info(`📊 Total rows to generate & insert: ${expectedTotalReadings.toLocaleString()} readings`);

  let currentBatch: NewGenerationReading[] = [];
  let insertedCount = 0;

  // Weather pattern variations across the 7 days (realistic monsoon/tropical variations)
  const dailyWeatherFactors = [0.98, 1.02, 0.85, 0.92, 1.05, 0.89, 0.95];

  for (let instIdx = 0; instIdx < installations.length; instIdx++) {
    const inst = installations[instIdx]!;
    const capacityKw = parseFloat(inst.installedCapacityKw);

    // Initial cumulative energy based on commissioning
    let cumulativeEnergyKwh = 1000.0 + (instIdx * 75.5);

    for (let interval = 0; interval < totalIntervals; interval++) {
      const readingTime = new Date(startTimestamp.getTime() + interval * 15 * 60 * 1000);
      const dayIndex = Math.floor(interval / 96) % dailyWeatherFactors.length;
      const weatherFactor = dailyWeatherFactors[dayIndex]!;

      const telemetry = generateReadingTelemetry(
        capacityKw,
        readingTime,
        cumulativeEnergyKwh,
        weatherFactor
      );

      cumulativeEnergyKwh = telemetry.energyKwh;

      currentBatch.push({
        installationId: inst.id,
        timestamp: telemetry.timestamp,
        powerKw: telemetry.powerKw.toFixed(3),
        energyKwh: telemetry.energyKwh.toFixed(3),
        voltage: telemetry.voltage.toFixed(2),
        currentA: telemetry.currentA.toFixed(2),
        frequencyHz: telemetry.frequencyHz.toFixed(2),
      });

      // Flush chunk when threshold reached
      if (currentBatch.length >= batchSize) {
        await db.insert(generationReadings).values(currentBatch);
        insertedCount += currentBatch.length;
        currentBatch = [];

        if (insertedCount % 15000 === 0 || insertedCount === expectedTotalReadings) {
          const percent = ((insertedCount / expectedTotalReadings) * 100).toFixed(1);
          logger.info(`⏳ Inserted ${insertedCount.toLocaleString()} / ${expectedTotalReadings.toLocaleString()} readings (${percent}%)`);
        }
      }
    }
  }

  // Flush remaining records
  if (currentBatch.length > 0) {
    await db.insert(generationReadings).values(currentBatch);
    insertedCount += currentBatch.length;
  }

  const elapsedSeconds = +((Date.now() - startTime) / 1000).toFixed(2);
  logger.info(`✅ Successfully seeded ${insertedCount.toLocaleString()} generation readings in ${elapsedSeconds}s (${Math.round(insertedCount / elapsedSeconds)} rows/s)`);

  return { totalReadings: insertedCount, elapsedSeconds };
}
