import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Polygon, MultiPolygon } from 'geojson'
import { localSafetyAlerts } from './push'

export const schoolDistricts = sqliteTable('school_districts', {
  id: text('id').primaryKey(),
  municipalityCode: text('municipality_code').notNull(),
  schoolCode: text('school_code').notNull(),
  prefecture: text('prefecture').notNull(),
  city: text('city').notNull(),
  name: text('name').notNull(),
  sourceUrl: text('source_url').notNull(),
  dataYear: integer('data_year').notNull(),
}, table => [index('idx_school_district_region').on(table.prefecture, table.city)])

// Store components separately so large island districts stay below D1's row limit.
export const schoolDistrictBoundaries = sqliteTable('school_district_boundaries', {
  id: text('id').primaryKey(),
  districtId: text('district_id').notNull().references(() => schoolDistricts.id, { onDelete: 'cascade' }),
  geometry: text('geometry', { mode: 'json' }).$type<Polygon | MultiPolygon>().notNull(),
  minLng: real('min_lng').notNull(), minLat: real('min_lat').notNull(),
  maxLng: real('max_lng').notNull(), maxLat: real('max_lat').notNull(),
}, table => [index('idx_school_boundary_district').on(table.districtId)])

export const localAlertDistricts = sqliteTable('local_alert_districts', {
  alertId: text('alert_id').notNull().references(() => localSafetyAlerts.id, { onDelete: 'cascade' }),
  districtId: text('district_id').notNull().references(() => schoolDistricts.id, { onDelete: 'cascade' }),
}, table => [primaryKey({ columns: [table.alertId, table.districtId] }), index('idx_alert_district').on(table.districtId, table.alertId)])

// Private evidence is never returned in the public alert response.
export const localAlertLocations = sqliteTable('local_alert_locations', {
  alertId: text('alert_id').primaryKey().references(() => localSafetyAlerts.id, { onDelete: 'cascade' }),
  address: text('address'), evidence: text('evidence'), sourceUrl: text('source_url'),
  longitude: real('longitude'), latitude: real('latitude'),
  status: text('status').notNull(), checkedAt: text('checked_at').notNull(),
})
