import { eq, asc } from 'drizzle-orm';
import { db, provinces, districts, gridSubstations, solarInstallations } from '../db/index.js';
import { NotFoundError } from '../errors/app-error.js';

export interface SanitizedInstallationSummary {
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
}

export class HierarchyService {
  /**
   * List all 9 provinces of Sri Lanka
   */
  static async listProvinces() {
    return db.select().from(provinces).orderBy(asc(provinces.id));
  }

  /**
   * Get single province metadata by ID
   */
  static async getProvinceById(id: string) {
    const [province] = await db
      .select()
      .from(provinces)
      .where(eq(provinces.id, id))
      .limit(1);

    if (!province) {
      throw new NotFoundError(`Province '${id}' was not found`);
    }

    return province;
  }

  /**
   * List all districts within a specific province
   */
  static async getDistrictsByProvince(provinceId: string) {
    // Verify parent province exists
    await this.getProvinceById(provinceId);

    return db
      .select()
      .from(districts)
      .where(eq(districts.provinceId, provinceId))
      .orderBy(asc(districts.id));
  }

  /**
   * List all 25 districts across Sri Lanka, including parent province metadata
   */
  static async listDistricts() {
    return db
      .select({
        id: districts.id,
        provinceId: districts.provinceId,
        provinceName: provinces.name,
        provinceCode: provinces.code,
        name: districts.name,
        code: districts.code,
        createdAt: districts.createdAt,
      })
      .from(districts)
      .innerJoin(provinces, eq(districts.provinceId, provinces.id))
      .orderBy(asc(districts.id));
  }

  /**
   * Get single district metadata by ID, including parent province metadata
   */
  static async getDistrictById(id: string) {
    const [district] = await db
      .select({
        id: districts.id,
        provinceId: districts.provinceId,
        provinceName: provinces.name,
        provinceCode: provinces.code,
        name: districts.name,
        code: districts.code,
        createdAt: districts.createdAt,
      })
      .from(districts)
      .innerJoin(provinces, eq(districts.provinceId, provinces.id))
      .where(eq(districts.id, id))
      .limit(1);

    if (!district) {
      throw new NotFoundError(`District '${id}' was not found`);
    }

    return district;
  }

  /**
   * List all grid substations within a specific district
   */
  static async getSubstationsByDistrict(districtId: string) {
    // Verify parent district exists
    await this.getDistrictById(districtId);

    return db
      .select()
      .from(gridSubstations)
      .where(eq(gridSubstations.districtId, districtId))
      .orderBy(asc(gridSubstations.id));
  }

  /**
   * Get single grid substation by ID, including parent district and province metadata
   */
  static async getSubstationById(id: string) {
    const [substation] = await db
      .select({
        id: gridSubstations.id,
        name: gridSubstations.name,
        code: gridSubstations.code,
        capacityMva: gridSubstations.capacityMva,
        districtId: districts.id,
        districtName: districts.name,
        provinceId: provinces.id,
        provinceName: provinces.name,
        createdAt: gridSubstations.createdAt,
      })
      .from(gridSubstations)
      .innerJoin(districts, eq(gridSubstations.districtId, districts.id))
      .innerJoin(provinces, eq(districts.provinceId, provinces.id))
      .where(eq(gridSubstations.id, id))
      .limit(1);

    if (!substation) {
      throw new NotFoundError(`Grid substation '${id}' was not found`);
    }

    return substation;
  }

  /**
   * List all installations linked to a grid substation (redacting apiKeyHash)
   */
  static async getInstallationsBySubstation(substationId: string): Promise<SanitizedInstallationSummary[]> {
    // Verify parent substation exists
    await this.getSubstationById(substationId);

    const rows = await db
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
      })
      .from(solarInstallations)
      .where(eq(solarInstallations.substationId, substationId))
      .orderBy(asc(solarInstallations.id));

    return rows;
  }
}
