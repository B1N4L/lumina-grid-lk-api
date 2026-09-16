import { pgTable, varchar, numeric, date, timestamp } from 'drizzle-orm/pg-core';
import { gridSubstations } from './grid-substations.js';

export const solarInstallations = pgTable('solar_installations', {
  id: varchar('id', { length: 50 }).primaryKey(), // e.g. 'inst-lk-wp-00101'
  substationId: varchar('substation_id', { length: 30 })
    .notNull()
    .references(() => gridSubstations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  // Architectural requirement: meter_id and inverter_id are embedded attributes, NOT a separate Device entity
  meterId: varchar('meter_id', { length: 50 }).notNull().unique(),
  inverterId: varchar('inverter_id', { length: 50 }).notNull(),
  installedCapacityKw: numeric('installed_capacity_kw', { precision: 8, scale: 2 }).notNull(),
  commissionedDate: date('commissioned_date').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'maintenance', 'decommissioned'
  apiKeyHash: varchar('api_key_hash', { length: 128 }).notNull(), // Hashed secret for write-path device authentication
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type SolarInstallation = typeof solarInstallations.$inferSelect;
export type NewSolarInstallation = typeof solarInstallations.$inferInsert;
