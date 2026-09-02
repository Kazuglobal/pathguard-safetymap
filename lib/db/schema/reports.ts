import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

import { createdAt, updatedAt } from './common'

export const dangerReports = sqliteTable('danger_reports', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  dangerType: text('danger_type').notNull(),
  dangerLevel: integer('danger_level').notNull(),
  latitude: real('latitude').notNull(),
  longitude: real('longitude').notNull(),
  status: text('status').notNull().default('pending'),
  imageKey: text('image_key'),
  processedImageKey: text('processed_image_key'),
  processedImageKeys: text('processed_image_keys', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  accidentStats: text('accident_stats', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  accidentRiskScore: real('accident_risk_score'),
  geocodeSource: text('geocode_source'),
  geocodeConfidence: real('geocode_confidence'),
  geocodedAt: text('geocoded_at'),
  addressHash: text('address_hash'),
  prefecture: text('prefecture'),
  prefectureCode: integer('prefecture_code'),
  city: text('city'),
  municipalityCode: text('municipality_code'),
  town: text('town'),
  postalCode: text('postal_code'),
  alertRadiusM: integer('alert_radius_m'),
  pushNotifiedAt: text('push_notified_at'),
  aiModerationStatus: text('ai_moderation_status'),
  aiModerationReason: text('ai_moderation_reason'),
  aiModerationScore: real('ai_moderation_score'),
  aiModerationCheckedAt: text('ai_moderation_checked_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('idx_dr_user').on(table.userId),
  index('idx_dr_status_created').on(table.status, table.createdAt),
  index('idx_dr_lat_lng').on(table.latitude, table.longitude),
  index('idx_dr_push').on(table.pushNotifiedAt, table.createdAt),
  index('idx_dr_moderation_sweep').on(table.aiModerationStatus, table.status, table.createdAt),
  check('dr_danger_level', sql`${table.dangerLevel} between 1 and 5`),
  check('dr_lat_range', sql`${table.latitude} between -90 and 90`),
  check('dr_lng_range', sql`${table.longitude} between -180 and 180`),
  check('dr_status', sql`${table.status} in ('pending','approved','rejected','resolved','published')`),
  check('dr_geocode_source', sql`${table.geocodeSource} is null or ${table.geocodeSource} in ('mapbox','gsi','osm','manual','batch')`),
  check('dr_processed_keys_json', sql`json_valid(${table.processedImageKeys}) and json_type(${table.processedImageKeys}) = 'array'`),
  check('dr_accident_stats_json', sql`${table.accidentStats} is null or json_valid(${table.accidentStats})`),
])

export const dangerReportModerationLog = sqliteTable('danger_report_moderation_log', {
  id: text('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => dangerReports.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(),
  heuristicStatus: text('heuristic_status').notNull(),
  aiVerdict: text('ai_verdict', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  finalStatus: text('final_status').notNull(),
  fallback: integer('fallback', { mode: 'boolean' }).notNull().default(false),
  latencyMs: integer('latency_ms'),
  model: text('model'),
  promptVersion: text('prompt_version').notNull(),
  createdAt: createdAt(),
}, (table) => [
  index('idx_moderation_log_report_created').on(table.reportId, table.createdAt),
  check('moderation_ai_verdict_json', sql`${table.aiVerdict} is null or json_valid(${table.aiVerdict})`),
])

export const reportImages = sqliteTable('report_images', {
  id: text('id').primaryKey(),
  reportId: text('report_id').references(() => dangerReports.id, { onDelete: 'cascade' }),
  imageKey: text('image_key').notNull(),
  imageType: text('image_type'),
  uploadedBy: text('uploaded_by'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index('idx_report_images_report').on(table.reportId),
])
