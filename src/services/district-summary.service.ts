import { sql, eq, and } from 'drizzle-orm';
import { db, districts, provinces, gridSubstations, solarInstallations } from '../db/index.js';
import { NotFoundError } from '../errors/app-error.js';

export interface DistrictGenerationSummary {
  districtId: string;
  districtName: string;
  districtCode: string;
  provinceId: string;
  provinceName: string;
  provinceCode: string;
  evaluatedAt: string;
  current_total_power_kw: number;
  today_total_energy_kwh: number;
  peak_power_today_kw: number;
  active_installations_count: number;
  total_installations_count: number;
  // camelCase accessors for client convenience
  currentTotalPowerKw: number;
  todayTotalEnergyKwh: number;
  peakPowerTodayKw: number;
  activeInstallationsCount: number;
  totalInstallationsCount: number;
}

export class DistrictSummaryService {
  /**
   * High-performance SQL aggregation engine computing real-time collective power,
   * cumulative daily energy, peak interval power, and active installation ratio
   * for an entire district.
   */
  static async getDistrictSummary(
    districtId: string,
    queryDate?: string
  ): Promise<DistrictGenerationSummary> {
    // 1. Verify target district exists with parent province metadata
    const [district] = await db
      .select({
        id: districts.id,
        name: districts.name,
        code: districts.code,
        provinceId: provinces.id,
        provinceName: provinces.name,
        provinceCode: provinces.code,
      })
      .from(districts)
      .innerJoin(provinces, eq(districts.provinceId, provinces.id))
      .where(eq(districts.id, districtId))
      .limit(1);

    if (!district) {
      throw new NotFoundError(`District '${districtId}' was not found`);
    }

    // 2. Fetch total active installations in this district
    const activeInstallations = await db
      .select({ id: solarInstallations.id })
      .from(solarInstallations)
      .innerJoin(gridSubstations, eq(solarInstallations.substationId, gridSubstations.id))
      .where(
        and(
          eq(gridSubstations.districtId, districtId),
          eq(solarInstallations.status, 'active')
        )
      );

    const totalInstallationsCount = activeInstallations.length;

    // Handle empty district (no installations registered)
    if (totalInstallationsCount === 0) {
      return {
        districtId: district.id,
        districtName: district.name,
        districtCode: district.code,
        provinceId: district.provinceId,
        provinceName: district.provinceName,
        provinceCode: district.provinceCode,
        evaluatedAt: new Date().toISOString(),
        current_total_power_kw: 0,
        today_total_energy_kwh: 0,
        peak_power_today_kw: 0,
        active_installations_count: 0,
        total_installations_count: 0,
        currentTotalPowerKw: 0,
        todayTotalEnergyKwh: 0,
        peakPowerTodayKw: 0,
        activeInstallationsCount: 0,
        totalInstallationsCount: 0,
      };
    }

    // 3. Compute current_total_power_kw:
    // Sum of latest instantaneous power across all active installations in the district
    const latestReadingsResult = await db.execute(sql`
      SELECT DISTINCT ON (gr.installation_id)
        gr.installation_id,
        gr.power_kw::float as power_kw,
        gr.timestamp
      FROM generation_readings gr
      INNER JOIN solar_installations si ON gr.installation_id = si.id
      INNER JOIN grid_substations gs ON si.substation_id = gs.id
      WHERE gs.district_id = ${districtId}
        AND si.status = 'active'
      ORDER BY gr.installation_id, gr.timestamp DESC
    `);

    const latestReadings = Array.isArray(latestReadingsResult)
      ? latestReadingsResult
      : (latestReadingsResult as any).rows ?? [];

    const currentTotalPowerKw = Number(
      latestReadings.reduce((sum: number, r: any) => sum + (Number(r.power_kw) || 0), 0).toFixed(3)
    );

    const maxTimestamp =
      latestReadings.length > 0
        ? new Date(Math.max(...latestReadings.map((r: any) => new Date(r.timestamp).getTime()))).toISOString()
        : null;

    // 4. Compute active_installations_count:
    // Installations actively pushing readings in the last 60 minutes
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000);
    const activeResult = await db.execute(sql`
      SELECT COUNT(DISTINCT gr.installation_id)::int as active_count
      FROM generation_readings gr
      INNER JOIN solar_installations si ON gr.installation_id = si.id
      INNER JOIN grid_substations gs ON si.substation_id = gs.id
      WHERE gs.district_id = ${districtId}
        AND si.status = 'active'
        AND gr.timestamp >= ${sixtyMinutesAgo}
    `);

    const activeRows = Array.isArray(activeResult) ? activeResult : (activeResult as any).rows ?? [];
    const activeInstallationsCount = Number((activeRows[0] as any)?.active_count || 0);

    // 5. Determine target date window (Sri Lanka Local Time: Asia/Colombo UTC+05:30)
    const slOffsetMs = 5.5 * 60 * 60 * 1000;
    let targetDateStr: string;

    if (queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate)) {
      targetDateStr = queryDate;
    } else {
      const now = new Date();
      const slDate = new Date(now.getTime() + slOffsetMs);
      const yyyy = slDate.getUTCFullYear();
      const mm = String(slDate.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(slDate.getUTCDate()).padStart(2, '0');
      targetDateStr = `${yyyy}-${mm}-${dd}`;
    }

    const [year, month, day] = targetDateStr.split('-').map(Number) as [number, number, number];
    const dateStartUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - slOffsetMs);
    const dateEndUtc = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - slOffsetMs);

    // 6. Compute today_total_energy_kwh:
    // Aggregated energy generated today: sum of (max(energy_kwh) - min(energy_kwh)) per installation
    const energyResult = await db.execute(sql`
      SELECT
        gr.installation_id,
        (MAX(gr.energy_kwh::float) - MIN(gr.energy_kwh::float)) as generated_kwh
      FROM generation_readings gr
      INNER JOIN solar_installations si ON gr.installation_id = si.id
      INNER JOIN grid_substations gs ON si.substation_id = gs.id
      WHERE gs.district_id = ${districtId}
        AND si.status = 'active'
        AND gr.timestamp >= ${dateStartUtc}
        AND gr.timestamp <= ${dateEndUtc}
      GROUP BY gr.installation_id
    `);

    const energyRows = Array.isArray(energyResult) ? energyResult : (energyResult as any).rows ?? [];
    const todayTotalEnergyKwh = Number(
      energyRows.reduce((sum: number, r: any) => sum + (Number(r.generated_kwh) || 0), 0).toFixed(3)
    );

    // 7. Compute peak_power_today_kw:
    // Maximum collective power recorded today across measurement intervals
    const peakResult = await db.execute(sql`
      SELECT
        COALESCE(MAX(interval_power), 0)::float as peak_power
      FROM (
        SELECT
          gr.timestamp,
          SUM(gr.power_kw::float) as interval_power
        FROM generation_readings gr
        INNER JOIN solar_installations si ON gr.installation_id = si.id
        INNER JOIN grid_substations gs ON si.substation_id = gs.id
        WHERE gs.district_id = ${districtId}
          AND si.status = 'active'
          AND gr.timestamp >= ${dateStartUtc}
          AND gr.timestamp <= ${dateEndUtc}
        GROUP BY gr.timestamp
      ) interval_sums
    `);

    const peakRows = Array.isArray(peakResult) ? peakResult : (peakResult as any).rows ?? [];
    const peakPowerTodayKw = Number(
      (Number((peakRows[0] as any)?.peak_power) || 0).toFixed(3)
    );

    return {
      districtId: district.id,
      districtName: district.name,
      districtCode: district.code,
      provinceId: district.provinceId,
      provinceName: district.provinceName,
      provinceCode: district.provinceCode,
      evaluatedAt: maxTimestamp || new Date().toISOString(),
      current_total_power_kw: currentTotalPowerKw,
      today_total_energy_kwh: todayTotalEnergyKwh,
      peak_power_today_kw: peakPowerTodayKw,
      active_installations_count: activeInstallationsCount,
      total_installations_count: totalInstallationsCount,
      currentTotalPowerKw,
      todayTotalEnergyKwh,
      peakPowerTodayKw,
      activeInstallationsCount,
      totalInstallationsCount,
    };
  }
}
