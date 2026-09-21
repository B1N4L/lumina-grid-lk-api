import { pgTable, uuid, varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { provinces } from './provinces.js';
import { districts } from './districts.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    // Architectural requirement: SLSEA users have roles and read jurisdiction scopes
    role: varchar('role', { length: 30 }).notNull(), // 'national_admin', 'provincial_analyst', 'district_operator'
    status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'suspended', 'deleted'
    jurisdictionProvinceId: varchar('jurisdiction_province_id', { length: 10 }).references(
      () => provinces.id,
      { onDelete: 'set null', onUpdate: 'cascade' }
    ),
    jurisdictionDistrictId: varchar('jurisdiction_district_id', { length: 20 }).references(
      () => districts.id,
      { onDelete: 'set null', onUpdate: 'cascade' }
    ),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('users_email_active_idx')
      .on(table.email)
      .where(sql`${table.status} != 'deleted'`),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
