import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { createdAt, updatedAt } from './common'

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  notificationPreferences: text('notification_preferences', { mode: 'json' })
    .$type<Record<string, boolean>>()
    .notNull()
    .default(sql`'{"danger_reports":true,"news":true,"magazine":true}'`),
  prefecture: text('prefecture'),
  lastNotifiedAt: text('last_notified_at'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex('uq_push_user_endpoint').on(table.userId, table.endpoint),
  index('idx_push_user').on(table.userId),
  index('idx_push_endpoint').on(table.endpoint),
  check('push_preferences_json', sql`json_valid(${table.notificationPreferences})`),
])

export const localSafetyAlerts = sqliteTable('local_safety_alerts', {
  id: text('id').primaryKey(),
  prefecture: text('prefecture').notNull(),
  city: text('city'),
  category: text('category').notNull(),
  description: text('description').notNull(),
  sourceUrl: text('source_url'),
  occurredAt: text('occurred_at').notNull(),
  pushNotifiedAt: text('push_notified_at'),
  createdAt: createdAt(),
}, (table) => [
  uniqueIndex('uq_local_alert_location_time').on(table.prefecture, table.city, table.occurredAt),
  index('idx_local_alert_created').on(table.createdAt),
  index('idx_local_alert_push').on(table.pushNotifiedAt, table.occurredAt),
  check('local_alert_category', sql`${table.category} in ('suspicious','voice_call','following','other')`),
])
