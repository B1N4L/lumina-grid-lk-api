import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core';
import { provinces } from './provinces.js';
import { districts } from './districts.js';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 150 }).notNull(),
  // Architectural requirement: SLSEA users have roles and read jurisdiction scopes
  role: varchar('role', { length: 30 }).notNull(), // 'national_admin', 'provincial_analyst', 'district_operator'
  jurisdictionProvinceId: varchar('jurisdiction_province_id', { length: 10 }).references(
    () => provinces.id,
    { onDelete: 'set null', onUpdate: 'cascade' }
  ),
  jurisdictionDistrictId: varchar('jurisdiction_district_id', { length: 20 }).references(
    () => districts.id,
    { onDelete: 'set null', onUpdate: 'cascade' }
  ),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
