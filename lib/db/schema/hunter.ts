import { sql } from 'drizzle-orm'
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { createdAt } from './common'

export const hunterPhotos = sqliteTable('hunter_photos', {
  id: text('id').primaryKey(),
  playerId: text('player_id').notNull(),
  imageKey: text('image_key').notNull(),
  pinLat: real('pin_lat'),
  pinLng: real('pin_lng'),
  capturedAt: text('captured_at'),
  exifStripped: integer('exif_stripped', { mode: 'boolean' }).notNull().default(true),
  masked: integer('masked', { mode: 'boolean' }).notNull().default(true),
  retentionUntil: text('retention_until'),
  createdAt: createdAt(),
}, (table) => [
  index('idx_hunter_photos_player').on(table.playerId),
  index('idx_hunter_photos_retention').on(table.retentionUntil),
  check('hunter_photo_lat', sql`${table.pinLat} is null or ${table.pinLat} between -90 and 90`),
  check('hunter_photo_lng', sql`${table.pinLng} is null or ${table.pinLng} between -180 and 180`),
])

export const hazardDetections = sqliteTable('hazard_detections', {
  id: text('id').primaryKey(),
  photoId: text('photo_id').notNull().references(() => hunterPhotos.id, { onDelete: 'cascade' }),
  type: text('type'),
  // kind は閉じた語彙(KID_DANGER_KINDS)。表示ラベル(type)が変わっても集計が壊れないための列。
  kind: text('kind'),
  // 近隣事故傾向との関連(やさしいラベル)。AI が写真と対応するときだけ付ける。
  accidentLink: text('accident_link'),
  region: text('region', { mode: 'json' }).$type<Record<string, unknown> | null>(),
  severity: text('severity'),
  kidExplanation: text('kid_explanation'),
  safeAction: text('safe_action'),
  confidence: real('confidence'),
  model: text('model'),
  createdAt: createdAt(),
}, (table) => [
  index('idx_hazard_detections_photo').on(table.photoId),
  index('idx_hazard_detections_kind').on(table.kind),
  check('hazard_detection_region_json', sql`${table.region} is null or json_valid(${table.region})`),
])

export const hunterAuditLog = sqliteTable('hunter_audit_log', {
  id: text('id').primaryKey(),
  actorId: text('actor_id'),
  action: text('action'),
  targetId: text('target_id'),
  createdAt: createdAt(),
}, (table) => [
  index('idx_hunter_audit_actor_created').on(table.actorId, table.createdAt),
])
