import { sql } from 'drizzle-orm'
import { text } from 'drizzle-orm/sqlite-core'

export function nowIso(): string {
  return new Date().toISOString()
}

export function createdAt(name = 'created_at') {
  return text(name)
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
}

export function updatedAt(name = 'updated_at') {
  return text(name)
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`)
    .$onUpdate(nowIso)
}
