import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';

export const provinces = pgTable('provinces', {
  id: varchar('id', { length: 10 }).primaryKey(), // e.g. 'lk-wp', 'lk-cp'
  name: varchar('name', { length: 100 }).notNull().unique(), // e.g. 'Western'
  code: varchar('code', { length: 10 }).notNull().unique(), // e.g. 'WP'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Province = typeof provinces.$inferSelect;
export type NewProvince = typeof provinces.$inferInsert;
