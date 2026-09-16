import { describe, it, expect } from 'vitest';
import { db } from '../src/db/index.js';
import {
  provinces,
  districts,
  gridSubstations,
  solarInstallations,
  generationReadings,
  users,
} from '../src/db/schema/index.js';

describe('Neon Database Schema & Connectivity Verification', () => {
  it('should successfully connect to Neon PostgreSQL and query the provinces table', async () => {
    const result = await db.select().from(provinces).limit(1);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should verify all 6 domain schema tables exist and can be queried', async () => {
    const [
      provincesCount,
      districtsCount,
      substationsCount,
      installationsCount,
      readingsCount,
      usersCount,
    ] = await Promise.all([
      db.select().from(provinces).limit(1),
      db.select().from(districts).limit(1),
      db.select().from(gridSubstations).limit(1),
      db.select().from(solarInstallations).limit(1),
      db.select().from(generationReadings).limit(1),
      db.select().from(users).limit(1),
    ]);

    expect(Array.isArray(provincesCount)).toBe(true);
    expect(Array.isArray(districtsCount)).toBe(true);
    expect(Array.isArray(substationsCount)).toBe(true);
    expect(Array.isArray(installationsCount)).toBe(true);
    expect(Array.isArray(readingsCount)).toBe(true);
    expect(Array.isArray(usersCount)).toBe(true);
  });
});
