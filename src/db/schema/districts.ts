import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';
import { provinces } from './provinces.js';

export const districts = pgTable('districts', {
  id: varchar('id', { length: 20 }).primaryKey(), // e.g. 'lk-colombo', 'lk-kandy'
  provinceId: varchar('province_id', { length: 10 })
    .notNull()
    .references(() => provinces.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull().unique(), // e.g. 'Colombo'
  code: varchar('code', { length: 10 }).notNull().unique(), // e.g. 'CMB'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type District = typeof districts.$inferSelect;
export type NewDistrict = typeof districts.$inferInsert;
