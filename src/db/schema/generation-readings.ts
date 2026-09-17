import { pgTable, uuid, varchar, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { solarInstallations } from './solar-installations.js';

// Architectural requirement: GenerationReading is its own append-only time series entity
export const generationReadings = pgTable(
  'generation_readings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    installationId: varchar('installation_id', { length: 50 })
      .notNull()
      .references(() => solarInstallations.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    powerKw: numeric('power_kw', { precision: 8, scale: 3 }).notNull(), // Instantaneous power in kW
    energyKwh: numeric('energy_kwh', { precision: 12, scale: 3 }).notNull(), // Cumulative energy reading in kWh
    voltage: numeric('voltage', { precision: 6, scale: 2 }).notNull(), // Grid interface voltage in Volts (~230V)
    currentA: numeric('current_a', { precision: 6, scale: 2 }).notNull(), // Interface current in Amperes
    frequencyHz: numeric('frequency_hz', { precision: 4, scale: 2 }).notNull(), // Grid frequency in Hz (~50.00Hz)
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Composite index for fast historical time-window scans and operational last-reading derivation
    index('idx_readings_inst_timestamp').on(table.installationId, table.timestamp.desc()),
    index('idx_readings_timestamp').on(table.timestamp.desc()),
  ]
);

export type GenerationReading = typeof generationReadings.$inferSelect;
export type NewGenerationReading = typeof generationReadings.$inferInsert;
