import { z } from 'zod';

export const userRoleEnum = z.enum(['national_admin', 'provincial_analyst', 'district_operator']);
export const userStatusEnum = z.enum(['active', 'suspended', 'deleted']);

/**
 * Domain Invariant Helper:
 * - national_admin: both jurisdictions must be null/empty
 * - provincial_analyst: jurisdictionProvinceId required, jurisdictionDistrictId must be null/empty
 * - district_operator: jurisdictionDistrictId required
 */
function validateRoleJurisdiction(
  data: {
    role?: 'national_admin' | 'provincial_analyst' | 'district_operator';
    jurisdictionProvinceId?: string | null;
    jurisdictionDistrictId?: string | null;
  },
  ctx: z.RefinementCtx
) {
  if (!data.role) return;

  if (data.role === 'national_admin') {
    if (data.jurisdictionProvinceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jurisdictionProvinceId'],
        message: 'National administrators cannot be assigned a provincial jurisdiction',
      });
    }
    if (data.jurisdictionDistrictId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jurisdictionDistrictId'],
        message: 'National administrators cannot be assigned a district jurisdiction',
      });
    }
  } else if (data.role === 'provincial_analyst') {
    if (!data.jurisdictionProvinceId || data.jurisdictionProvinceId.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jurisdictionProvinceId'],
        message: 'Provincial analysts require an assigned jurisdictionProvinceId',
      });
    }
    if (data.jurisdictionDistrictId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jurisdictionDistrictId'],
        message: 'Provincial analysts cannot have a district jurisdiction',
      });
    }
  } else if (data.role === 'district_operator') {
    if (!data.jurisdictionDistrictId || data.jurisdictionDistrictId.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jurisdictionDistrictId'],
        message: 'District operators require an assigned jurisdictionDistrictId',
      });
    }
  }
}

export const createUserSchema = z
  .object({
    email: z
      .string()
      .email('Invalid email address format')
      .max(255, 'Email cannot exceed 255 characters'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long'),
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters long')
      .max(150, 'Full name cannot exceed 150 characters'),
    role: userRoleEnum,
    jurisdictionProvinceId: z.string().nullable().optional(),
    jurisdictionDistrictId: z.string().nullable().optional(),
  })
  .superRefine(validateRoleJurisdiction);

export const updateUserSchema = z
  .object({
    fullName: z
      .string()
      .min(2, 'Full name must be at least 2 characters long')
      .max(150, 'Full name cannot exceed 150 characters')
      .optional(),
    role: userRoleEnum.optional(),
    status: z.enum(['active', 'suspended']).optional(),
    jurisdictionProvinceId: z.string().nullable().optional(),
    jurisdictionDistrictId: z.string().nullable().optional(),
  })
  .superRefine(validateRoleJurisdiction);

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long'),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: userRoleEnum.optional(),
  status: userStatusEnum.optional(),
  jurisdictionProvinceId: z.string().optional(),
  jurisdictionDistrictId: z.string().optional(),
});

export const userIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format: must be a valid UUID'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
