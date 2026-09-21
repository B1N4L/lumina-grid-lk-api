import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, provinces, districts, gridSubstations, solarInstallations } from '../db/index.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../errors/app-error.js';

export type JurisdictionEntityType = 'province' | 'district' | 'substation' | 'installation';

export interface JurisdictionOptions {
  entityType: JurisdictionEntityType;
  paramName?: string;
}

/**
 * Middleware enforcing jurisdiction-scoped authorization (ABAC) on SLSEA read resources:
 * - national_admin: full nationwide access
 * - provincial_analyst: access restricted to resources within their assigned province
 * - district_operator: access restricted to resources within their assigned district
 */
export function requireJurisdiction(options: JurisdictionOptions) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;

      if (!user) {
        throw new UnauthorizedError('Authentication required: Missing user context');
      }

      // National Admin has nationwide authority across all entities
      if (user.role === 'national_admin') {
        return next();
      }

      const paramKey = options.paramName || 'id';
      const rawEntityId = req.params[paramKey] || req.params.id;
      const entityId: string | undefined = typeof rawEntityId === 'string' ? rawEntityId : undefined;

      if (!entityId) {
        return next();
      }

      switch (options.entityType) {
        case 'province': {
          if (user.role === 'district_operator') {
            throw new ForbiddenError(
              'Access denied: District operators do not have access to provincial-level resources'
            );
          }

          if (user.role === 'provincial_analyst') {
            if (entityId !== user.jurisdictionProvinceId) {
              throw new ForbiddenError(
                `Access denied: Province '${entityId}' is outside your assigned jurisdiction '${user.jurisdictionProvinceId}'`
              );
            }
          }
          break;
        }

        case 'district': {
          if (user.role === 'district_operator') {
            if (entityId !== user.jurisdictionDistrictId) {
              throw new ForbiddenError(
                `Access denied: District '${entityId}' is outside your assigned jurisdiction '${user.jurisdictionDistrictId}'`
              );
            }
          } else if (user.role === 'provincial_analyst') {
            const [district] = await db
              .select({
                id: districts.id,
                provinceId: districts.provinceId,
              })
              .from(districts)
              .where(eq(districts.id, entityId))
              .limit(1);

            if (!district) {
              throw new NotFoundError(`District '${entityId}' was not found`);
            }

            if (district.provinceId !== user.jurisdictionProvinceId) {
              throw new ForbiddenError(
                `Access denied: District '${entityId}' does not belong to your assigned province jurisdiction '${user.jurisdictionProvinceId}'`
              );
            }
          }
          break;
        }

        case 'substation': {
          const [substation] = await db
            .select({
              id: gridSubstations.id,
              districtId: gridSubstations.districtId,
              provinceId: districts.provinceId,
            })
            .from(gridSubstations)
            .innerJoin(districts, eq(gridSubstations.districtId, districts.id))
            .where(eq(gridSubstations.id, entityId))
            .limit(1);

          if (!substation) {
            throw new NotFoundError(`Grid substation '${entityId}' was not found`);
          }

          if (user.role === 'district_operator') {
            if (substation.districtId !== user.jurisdictionDistrictId) {
              throw new ForbiddenError(
                `Access denied: Substation '${entityId}' is outside your assigned district jurisdiction '${user.jurisdictionDistrictId}'`
              );
            }
          } else if (user.role === 'provincial_analyst') {
            if (substation.provinceId !== user.jurisdictionProvinceId) {
              throw new ForbiddenError(
                `Access denied: Substation '${entityId}' is outside your assigned province jurisdiction '${user.jurisdictionProvinceId}'`
              );
            }
          }
          break;
        }

        case 'installation': {
          const [installation] = await db
            .select({
              id: solarInstallations.id,
              substationId: solarInstallations.substationId,
              districtId: gridSubstations.districtId,
              provinceId: districts.provinceId,
            })
            .from(solarInstallations)
            .innerJoin(gridSubstations, eq(solarInstallations.substationId, gridSubstations.id))
            .innerJoin(districts, eq(gridSubstations.districtId, districts.id))
            .where(eq(solarInstallations.id, entityId))
            .limit(1);

          if (!installation) {
            throw new NotFoundError(`Solar installation '${entityId}' was not found`);
          }

          if (user.role === 'district_operator') {
            if (installation.districtId !== user.jurisdictionDistrictId) {
              throw new ForbiddenError(
                `Access denied: Solar installation '${entityId}' is outside your assigned district jurisdiction '${user.jurisdictionDistrictId}'`
              );
            }
          } else if (user.role === 'provincial_analyst') {
            if (installation.provinceId !== user.jurisdictionProvinceId) {
              throw new ForbiddenError(
                `Access denied: Solar installation '${entityId}' is outside your assigned province jurisdiction '${user.jurisdictionProvinceId}'`
              );
            }
          }
          break;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware enforcing jurisdiction boundary on query filters (e.g. ?province=... or ?district=...)
 */
export async function enforceQueryJurisdiction(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = req.user;

    if (!user || user.role === 'national_admin') {
      return next();
    }

    const queryProvince = typeof req.query.province === 'string' ? req.query.province : undefined;
    const queryDistrict = typeof req.query.district === 'string' ? req.query.district : undefined;

    if (user.role === 'provincial_analyst') {
      if (queryProvince && queryProvince !== user.jurisdictionProvinceId) {
        throw new ForbiddenError(
          `Access denied: Cannot query province '${queryProvince}' outside assigned jurisdiction '${user.jurisdictionProvinceId}'`
        );
      }
      if (queryDistrict) {
        const [district] = await db
          .select({ provinceId: districts.provinceId })
          .from(districts)
          .where(eq(districts.id, queryDistrict))
          .limit(1);

        if (district && district.provinceId !== user.jurisdictionProvinceId) {
          throw new ForbiddenError(
            `Access denied: Cannot query district '${queryDistrict}' outside assigned province jurisdiction '${user.jurisdictionProvinceId}'`
          );
        }
      }
    }

    if (user.role === 'district_operator') {
      if (queryDistrict && queryDistrict !== user.jurisdictionDistrictId) {
        throw new ForbiddenError(
          `Access denied: Cannot query district '${queryDistrict}' outside assigned jurisdiction '${user.jurisdictionDistrictId}'`
        );
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}
