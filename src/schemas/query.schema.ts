import { z } from 'zod';

export const readingsQuerySchema = z
  .object({
    page: z.coerce
      .number()
      .int('page must be an integer')
      .min(1, 'page must be at least 1')
      .default(1),
    limit: z.coerce
      .number()
      .int('limit must be an integer')
      .min(1, 'limit must be at least 1')
      .max(200, 'limit cannot exceed 200')
      .default(50),
    from: z
      .string()
      .datetime({ message: 'from must be a valid ISO 8601 datetime string' })
      .optional(),
    to: z
      .string()
      .datetime({ message: 'to must be a valid ISO 8601 datetime string' })
      .optional(),
    min_power_kw: z.coerce
      .number()
      .min(0, 'min_power_kw must be non-negative')
      .optional(),
    minPowerKw: z.coerce
      .number()
      .min(0, 'minPowerKw must be non-negative')
      .optional(),
    max_power_kw: z.coerce
      .number()
      .min(0, 'max_power_kw must be non-negative')
      .optional(),
    maxPowerKw: z.coerce
      .number()
      .min(0, 'maxPowerKw must be non-negative')
      .optional(),
    sort_by: z
      .enum(['timestamp', 'power_kw', 'energy_kwh'])
      .optional(),
    sortBy: z
      .enum(['timestamp', 'power_kw', 'energy_kwh'])
      .optional(),
    order: z
      .enum(['asc', 'desc'])
      .default('desc'),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        return new Date(data.to).getTime() >= new Date(data.from).getTime();
      }
      return true;
    },
    {
      message: 'to datetime must be greater than or equal to from datetime',
      path: ['to'],
    }
  )
  .refine(
    (data) => {
      const min = data.min_power_kw ?? data.minPowerKw;
      const max = data.max_power_kw ?? data.maxPowerKw;
      if (min !== undefined && max !== undefined) {
        return max >= min;
      }
      return true;
    },
    {
      message: 'max_power_kw must be greater than or equal to min_power_kw',
      path: ['max_power_kw'],
    }
  )
  .transform((data) => ({
    page: data.page,
    limit: data.limit,
    from: data.from,
    to: data.to,
    minPowerKw: data.min_power_kw ?? data.minPowerKw,
    maxPowerKw: data.max_power_kw ?? data.maxPowerKw,
    sortBy: (data.sort_by ?? data.sortBy ?? 'timestamp') as 'timestamp' | 'power_kw' | 'energy_kwh',
    order: data.order,
  }));

export type ReadingsQueryInput = z.input<typeof readingsQuerySchema>;
export type CanonicalReadingsQuery = z.output<typeof readingsQuerySchema>;
