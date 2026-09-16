import { relations } from 'drizzle-orm';
import { provinces } from './provinces.js';
import { districts } from './districts.js';
import { gridSubstations } from './grid-substations.js';
import { solarInstallations } from './solar-installations.js';
import { generationReadings } from './generation-readings.js';
import { users } from './users.js';

export const provincesRelations = relations(provinces, ({ many }) => ({
  districts: many(districts),
  users: many(users),
}));

export const districtsRelations = relations(districts, ({ one, many }) => ({
  province: one(provinces, {
    fields: [districts.provinceId],
    references: [provinces.id],
  }),
  gridSubstations: many(gridSubstations),
  users: many(users),
}));

export const gridSubstationsRelations = relations(gridSubstations, ({ one, many }) => ({
  district: one(districts, {
    fields: [gridSubstations.districtId],
    references: [districts.id],
  }),
  solarInstallations: many(solarInstallations),
}));

export const solarInstallationsRelations = relations(solarInstallations, ({ one, many }) => ({
  gridSubstation: one(gridSubstations, {
    fields: [solarInstallations.substationId],
    references: [gridSubstations.id],
  }),
  readings: many(generationReadings),
}));

export const generationReadingsRelations = relations(generationReadings, ({ one }) => ({
  installation: one(solarInstallations, {
    fields: [generationReadings.installationId],
    references: [solarInstallations.id],
  }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  jurisdictionProvince: one(provinces, {
    fields: [users.jurisdictionProvinceId],
    references: [provinces.id],
  }),
  jurisdictionDistrict: one(districts, {
    fields: [users.jurisdictionDistrictId],
    references: [districts.id],
  }),
}));
