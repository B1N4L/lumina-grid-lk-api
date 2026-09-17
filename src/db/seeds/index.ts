import { db } from '../index.js';
import { provinces } from '../schema/provinces.js';
import { districts } from '../schema/districts.js';
import { gridSubstations } from '../schema/grid-substations.js';
import { solarInstallations } from '../schema/solar-installations.js';
import { generationReadings } from '../schema/generation-readings.js';
import { users } from '../schema/users.js';
import { provincesData } from './data/provinces.data.js';
import { districtsData } from './data/districts.data.js';
import { gridSubstationsData } from './data/grid-substations.data.js';
import { generateInstallations } from './generators/installations-generator.js';
import { seedGenerationReadings } from './generators/readings-batcher.js';
import { logger } from '../../config/logger.js';

export async function runMasterSeed(): Promise<void> {
  const overallStart = Date.now();
  logger.info('🚀 Starting SLSEA Solar API Master Seed Pipeline...');

  try {
    // 1. Clean existing records in foreign-key dependency order
    logger.info('🧹 Cleaning existing database tables...');
    await db.delete(generationReadings);
    await db.delete(solarInstallations);
    await db.delete(gridSubstations);
    await db.delete(districts);
    await db.delete(provinces);
    await db.delete(users);

    // 2. Seed Provinces (9)
    logger.info(`🗺️ Seeding ${provincesData.length} provinces...`);
    await db.insert(provinces).values(provincesData);

    // 3. Seed Districts (25)
    logger.info(`🏙️ Seeding ${districtsData.length} districts...`);
    await db.insert(districts).values(districtsData);

    // 4. Seed Grid Substations (27 >= 20)
    logger.info(`⚡ Seeding ${gridSubstationsData.length} grid substations...`);
    await db.insert(gridSubstations).values(gridSubstationsData);

    // 5. Generate and Seed Solar Installations (216 >= 200)
    const installations = generateInstallations();
    logger.info(`☀️ Seeding ${installations.length} solar installations...`);
    await db.insert(solarInstallations).values(installations);

    // 6. Seed Time-Series Generation Readings (7 days * 96 intervals * 216 = 145,152 readings)
    const { totalReadings, elapsedSeconds } = await seedGenerationReadings(installations, {
      batchSize: 1500,
      daysOfHistory: 7,
    });

    const totalDuration = +((Date.now() - overallStart) / 1000).toFixed(2);
    logger.info(`✨ Master seed pipeline completed successfully in ${totalDuration}s!`);
    logger.info(`📊 Summary: 9 Provinces, 25 Districts, ${gridSubstationsData.length} Substations, ${installations.length} Installations, ${totalReadings.toLocaleString()} Readings`);
  } catch (error) {
    logger.error({ err: error }, '❌ Fatal error occurred during seed execution');
    throw error;
  }
}

// Execute directly when run as CLI script
if (process.argv[1]?.includes('seeds/index')) {
  runMasterSeed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
