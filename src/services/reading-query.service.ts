import { eq, and, gte, lte, asc, desc, sql } from 'drizzle-orm';
import { db, generationReadings, solarInstallations } from '../db/index.js';
import { NotFoundError } from '../errors/app-error.js';
import { CanonicalReadingsQuery } from '../schemas/query.schema.js';

export interface FormattedReading {
  id: string;
  installationId: string;
  timestamp: Date;
  powerKw: number;
  energyKwh: number;
  voltage: number;
  currentA: number;
  frequencyHz: number;
  createdAt: Date;
}

export interface ReadingQueryResult {
  readings: FormattedReading[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  maxTimestamp: Date | null;
}

export class ReadingQueryService {
  /**
   * Dynamically build and execute time-series reading queries
   * supporting pagination, multi-attribute filtering, and configurable sorting.
   */
  static async queryReadings(
    installationId: string,
    query: CanonicalReadingsQuery
  ): Promise<ReadingQueryResult> {
    // 1. Verify installation exists
    const [installation] = await db
      .select({ id: solarInstallations.id })
      .from(solarInstallations)
      .where(eq(solarInstallations.id, installationId))
      .limit(1);

    if (!installation) {
      throw new NotFoundError(`Solar installation '${installationId}' was not found`);
    }

    const conditions = [eq(generationReadings.installationId, installationId)];

    // Time-window filtering
    if (query.from) {
      conditions.push(gte(generationReadings.timestamp, new Date(query.from)));
    }
    if (query.to) {
      conditions.push(lte(generationReadings.timestamp, new Date(query.to)));
    }

    // Electrical bounds filtering
    if (query.minPowerKw !== undefined) {
      conditions.push(gte(generationReadings.powerKw, String(query.minPowerKw)));
    }
    if (query.maxPowerKw !== undefined) {
      conditions.push(lte(generationReadings.powerKw, String(query.maxPowerKw)));
    }

    const whereClause = and(...conditions);

    // Sorting column mapping
    const sortColumn =
      query.sortBy === 'power_kw'
        ? generationReadings.powerKw
        : query.sortBy === 'energy_kwh'
        ? generationReadings.energyKwh
        : generationReadings.timestamp;

    const sortOrder = query.order === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const offset = (query.page - 1) * query.limit;

    // Parallel count and paginated query
    const [countResult, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(generationReadings)
        .where(whereClause),
      db
        .select()
        .from(generationReadings)
        .where(whereClause)
        .orderBy(sortOrder)
        .limit(query.limit)
        .offset(offset),
    ]);

    const totalCount = countResult[0]?.count ?? 0;
    const totalPages = Math.ceil(totalCount / query.limit) || (totalCount === 0 ? 0 : 1);

    const formattedReadings: FormattedReading[] = rows.map((r) => ({
      id: r.id,
      installationId: r.installationId,
      timestamp: r.timestamp,
      powerKw: Number(r.powerKw),
      energyKwh: Number(r.energyKwh),
      voltage: Number(r.voltage),
      currentA: Number(r.currentA),
      frequencyHz: Number(r.frequencyHz),
      createdAt: r.createdAt,
    }));

    // Find highest reading timestamp in the result set (or null if empty) for Last-Modified header
    let maxTimestamp: Date | null = null;
    if (formattedReadings.length > 0) {
      const timestamps = formattedReadings.map((r) => new Date(r.timestamp).getTime());
      maxTimestamp = new Date(Math.max(...timestamps));
    }

    return {
      readings: formattedReadings,
      totalCount,
      page: query.page,
      limit: query.limit,
      totalPages,
      maxTimestamp,
    };
  }
}
