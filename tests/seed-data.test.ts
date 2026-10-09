import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import {
  provinces,
  districts,
  gridSubstations,
  solarInstallations,
  generationReadings,
  users,
} from '../src/db/schema/index.js';

describe('Seed Data Verification & Academic Rubric Compliance', () => {
  it('should satisfy all scale requirements from Section 4 of coursework brief', async () => {
    const [
      provincesResult,
      districtsResult,
      substationsResult,
      installationsResult,
      readingsResult,
      usersResult,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(provinces),
      db.select({ count: sql<number>`count(*)::int` }).from(districts),
      db.select({ count: sql<number>`count(*)::int` }).from(gridSubstations),
      db.select({ count: sql<number>`count(*)::int` }).from(solarInstallations),
      db.select({ count: sql<number>`count(*)::int` }).from(generationReadings),
      db.select({ count: sql<number>`count(*)::int` }).from(users),
    ]);

    const provinceCount = provincesResult[0]?.count ?? 0;
    const districtCount = districtsResult[0]?.count ?? 0;
    const substationCount = substationsResult[0]?.count ?? 0;
    const installationCount = installationsResult[0]?.count ?? 0;
    const readingCount = readingsResult[0]?.count ?? 0;
    const userCount = usersResult[0]?.count ?? 0;

    // Strict Coursework Assertions
    expect(provinceCount).toBe(9); // Exactly 9 Provinces
    expect(districtCount).toBe(25); // Exactly 25 Districts
    expect(substationCount).toBeGreaterThanOrEqual(20); // >= 20 Substations
    expect(installationCount).toBeGreaterThanOrEqual(200); // >= 200 Solar Installations
    expect(readingCount).toBeGreaterThanOrEqual(134400); // >= 1 week at 15-min intervals
    expect(userCount).toBeGreaterThanOrEqual(6); // National, provincial, district users
  });

  it('should verify diurnal solar generation characteristics (zero at night, positive at midday)', async () => {
    // Check night generation in Sri Lanka timezone (e.g. 00:00 - 04:00 Asia/Colombo)
    const nightReadings = await db
      .select({ powerKw: generationReadings.powerKw })
      .from(generationReadings)
      .where(sql`EXTRACT(HOUR FROM ${generationReadings.timestamp} AT TIME ZONE 'Asia/Colombo') IN (0, 1, 2, 3, 22, 23)`)
      .limit(10);

    expect(nightReadings.length).toBeGreaterThan(0);
    for (const reading of nightReadings) {
      expect(parseFloat(reading.powerKw)).toBe(0.0);
    }

    // Check peak midday generation in Sri Lanka timezone (between 11:00 and 13:00 Asia/Colombo)
    const middayReadings = await db
      .select({ powerKw: generationReadings.powerKw })
      .from(generationReadings)
      .where(sql`EXTRACT(HOUR FROM ${generationReadings.timestamp} AT TIME ZONE 'Asia/Colombo') = 12`)
      .limit(10);

    expect(middayReadings.length).toBeGreaterThan(0);
    for (const reading of middayReadings) {
      expect(parseFloat(reading.powerKw)).toBeGreaterThan(0.0);
    }
  });

  it('should enforce that meter_id is an attribute on SolarInstallation without a Device entity', async () => {
    const sampleInstallation = await db.select().from(solarInstallations).limit(1);

    expect(sampleInstallation.length).toBe(1);
    expect(sampleInstallation[0]).toHaveProperty('meterId');
    expect(sampleInstallation[0]).toHaveProperty('inverterId');
    expect(sampleInstallation[0]?.meterId).toMatch(/^MTR-SLSEA-\d{4}$/);
  });
});
