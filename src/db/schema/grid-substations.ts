import { pgTable, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { districts } from './districts.js';

export const gridSubstations = pgTable('grid_substations', {
  id: varchar('id', { length: 30 }).primaryKey(), // e.g. 'sub-kolonnawa-01'
  districtId: varchar('district_id', { length: 20 })
    .notNull()
    .references(() => districts.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  name: varchar('name', { length: 150 }).notNull(), // e.g. 'Kolonnawa Grid Substation'
  code: varchar('code', { length: 20 }).notNull().unique(), // e.g. 'KLN-GS-01'
  capacityMva: numeric('capacity_mva', { precision: 8, scale: 2 }).notNull(), // Transformer capacity in MVA
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type GridSubstation = typeof gridSubstations.$inferSelect;
export type NewGridSubstation = typeof gridSubstations.$inferInsert;
