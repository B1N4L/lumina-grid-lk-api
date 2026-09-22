import { z } from 'zod';

export const provinceParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Province ID is required')
    .max(10, 'Province ID must not exceed 10 characters'),
});

export const districtParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'District ID is required')
    .max(20, 'District ID must not exceed 20 characters'),
});

export const substationParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Grid substation ID is required')
    .max(30, 'Grid substation ID must not exceed 30 characters'),
});

export const installationParamsSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Installation ID is required')
    .max(50, 'Installation ID must not exceed 50 characters'),
});

export const installationQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100').default(20),
  province: z.string().trim().optional(),
  district: z.string().trim().optional(),
  status: z.enum(['active', 'maintenance', 'decommissioned']).optional(),
});

export type ProvinceParams = z.infer<typeof provinceParamsSchema>;
export type DistrictParams = z.infer<typeof districtParamsSchema>;
export type SubstationParams = z.infer<typeof substationParamsSchema>;
export type InstallationParams = z.infer<typeof installationParamsSchema>;
export type InstallationQuery = z.infer<typeof installationQuerySchema>;
