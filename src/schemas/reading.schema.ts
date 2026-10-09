import { z } from 'zod';

/**
 * Zod validation schema for time-series generation reading ingestion.
 * Validates physical and electrical boundaries:
 * - timestamp: valid ISO 8601 string, non-future
 * - power: non-negative instantaneous kW
 * - energy: positive cumulative kWh
 * - voltage: grid interface voltage (180V - 260V)
 * - current: non-negative Amperes
 * - frequency: grid frequency (47Hz - 53Hz, nominal 50Hz)
 * Supports both snake_case and camelCase attributes for IoT device flexibility.
 */
export const readingIngestionSchema = z
  .object({
    timestamp: z
      .string()
      .datetime({ message: 'timestamp must be a valid ISO 8601 datetime string' })
      .refine(
        (val) => new Date(val).getTime() <= Date.now() + 60_000,
        'timestamp cannot be in the future'
      ),
    power_kw: z.number().min(0, 'power_kw must be non-negative').optional(),
    powerKw: z.number().min(0, 'powerKw must be non-negative').optional(),
    energy_kwh: z.number().positive('energy_kwh must be greater than zero').optional(),
    energyKwh: z.number().positive('energyKwh must be greater than zero').optional(),
    voltage: z
      .number()
      .min(180, 'voltage must be at least 180V')
      .max(260, 'voltage cannot exceed 260V'),
    current_a: z.number().min(0, 'current_a must be non-negative').optional(),
    currentA: z.number().min(0, 'currentA must be non-negative').optional(),
    frequency_hz: z
      .number()
      .min(47, 'frequency_hz must be at least 47Hz')
      .max(53, 'frequency_hz cannot exceed 53Hz')
      .optional(),
    frequencyHz: z
      .number()
      .min(47, 'frequencyHz must be at least 47Hz')
      .max(53, 'frequencyHz cannot exceed 53Hz')
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.power_kw === undefined && data.powerKw === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['power_kw'],
        message: 'power_kw (or powerKw) is required and cannot be empty',
      });
    }
    if (data.energy_kwh === undefined && data.energyKwh === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['energy_kwh'],
        message: 'energy_kwh (or energyKwh) is required and must be positive',
      });
    }
    if (data.current_a === undefined && data.currentA === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['current_a'],
        message: 'current_a (or currentA) is required and must be non-negative',
      });
    }
    if (data.frequency_hz === undefined && data.frequencyHz === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['frequency_hz'],
        message: 'frequency_hz (or frequencyHz) is required (47Hz - 53Hz)',
      });
    }
  });

export const installationIdParamSchema = z.object({
  installationId: z.string().min(1, 'installationId path parameter is required'),
});

export type RawReadingInput = z.infer<typeof readingIngestionSchema>;

export interface NormalizedReadingInput {
  timestamp: string;
  powerKw: number;
  energyKwh: number;
  voltage: number;
  currentA: number;
  frequencyHz: number;
}

/**
 * Normalizes snake_case or camelCase payload to a canonical domain input structure
 */
export function normalizeReadingPayload(data: RawReadingInput): NormalizedReadingInput {
  return {
    timestamp: data.timestamp,
    powerKw: (data.power_kw ?? data.powerKw)!,
    energyKwh: (data.energy_kwh ?? data.energyKwh)!,
    voltage: data.voltage,
    currentA: (data.current_a ?? data.currentA)!,
    frequencyHz: (data.frequency_hz ?? data.frequencyHz)!,
  };
}
