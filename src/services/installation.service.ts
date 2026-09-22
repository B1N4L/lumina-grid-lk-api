import { eq, and, asc, sql } from 'drizzle-orm';
import { db, solarInstallations, gridSubstations, districts, provinces } from '../db/index.js';
import { NotFoundError } from '../errors/app-error.js';
import { UserTokenPayload } from '../types/auth.types.js';
import { InstallationQuery } from '../schemas/hierarchy.schema.js';

export interface PaginatedInstallationsResult {
  installations: Array<{
    id: string;
    substationId: string;
    name: string;
    meterId: string;
    inverterId: string;
    installedCapacityKw: string;
    commissionedDate: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    substationName: string;
    districtId: string;
    districtName: string;
    provinceId: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class InstallationService {
  /**
   * List installations with pagination and multi-attribute filters,
   * automatically scoped by the user's ABAC jurisdiction.
   * Strictly redacts internal device secrets (apiKeyHash).
   */
  static async listInstallations(
    query: InstallationQuery,
    user: UserTokenPayload
  ): Promise<PaginatedInstallationsResult> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const offset = (page - 1) * limit;

    const conditions = [];

    // Installation operational status filter
    if (query.status) {
      conditions.push(eq(solarInstallations.status, query.status));
    }

    // Determine effective province scope
    let effectiveProvince: string | undefined;
    if (user.role === 'provincial_analyst') {
      effectiveProvince = user.jurisdictionProvinceId ?? undefined;
    } else if (user.role === 'national_admin') {
      effectiveProvince = query.province;
    }

    if (effectiveProvince) {
      conditions.push(eq(districts.provinceId, effectiveProvince));
    }

    // Determine effective district scope
    let effectiveDistrict: string | undefined;
    if (user.role === 'district_operator') {
      effectiveDistrict = user.jurisdictionDistrictId ?? undefined;
    } else {
      effectiveDistrict = query.district;
    }

    if (effectiveDistrict) {
      conditions.push(eq(gridSubstations.districtId, effectiveDistrict));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(solarInstallations)
      .innerJoin(gridSubstations, eq(solarInstallations.substationId, gridSubstations.id))
      .innerJoin(districts, eq(gridSubstations.districtId, districts.id));

    const dataQuery = db
      .select({
        id: solarInstallations.id,
        substationId: solarInstallations.substationId,
        name: solarInstallations.name,
        meterId: solarInstallations.meterId,
        inverterId: solarInstallations.inverterId,
        installedCapacityKw: solarInstallations.installedCapacityKw,
        commissionedDate: solarInstallations.commissionedDate,
        status: solarInstallations.status,
        createdAt: solarInstallations.createdAt,
        updatedAt: solarInstallations.updatedAt,
        substationName: gridSubstations.name,
        districtId: districts.id,
        districtName: districts.name,
        provinceId: districts.provinceId,
      })
      .from(solarInstallations)
      .innerJoin(gridSubstations, eq(solarInstallations.substationId, gridSubstations.id))
      .innerJoin(districts, eq(gridSubstations.districtId, districts.id))
      .orderBy(asc(solarInstallations.id))
      .limit(limit)
      .offset(offset);

    if (whereClause) {
      countQuery.where(whereClause);
      dataQuery.where(whereClause);
    }

    const [countResult, rows] = await Promise.all([countQuery, dataQuery]);

    const total = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      installations: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Get single installation atomic resource metadata by ID,
   * with related grid hierarchy metadata. Redacts apiKeyHash.
   */
  static async getInstallationById(id: string) {
    const [installation] = await db
      .select({
        id: solarInstallations.id,
        substationId: solarInstallations.substationId,
        name: solarInstallations.name,
        meterId: solarInstallations.meterId,
        inverterId: solarInstallations.inverterId,
        installedCapacityKw: solarInstallations.installedCapacityKw,
        commissionedDate: solarInstallations.commissionedDate,
        status: solarInstallations.status,
        createdAt: solarInstallations.createdAt,
        updatedAt: solarInstallations.updatedAt,
        substation: {
          id: gridSubstations.id,
          name: gridSubstations.name,
          code: gridSubstations.code,
          capacityMva: gridSubstations.capacityMva,
        },
        district: {
          id: districts.id,
          name: districts.name,
          code: districts.code,
        },
        province: {
          id: provinces.id,
          name: provinces.name,
          code: provinces.code,
        },
      })
      .from(solarInstallations)
      .innerJoin(gridSubstations, eq(solarInstallations.substationId, gridSubstations.id))
      .innerJoin(districts, eq(gridSubstations.districtId, districts.id))
      .innerJoin(provinces, eq(districts.provinceId, provinces.id))
      .where(eq(solarInstallations.id, id))
      .limit(1);

    if (!installation) {
      throw new NotFoundError(`Solar installation '${id}' was not found`);
    }

    return installation;
  }
}
