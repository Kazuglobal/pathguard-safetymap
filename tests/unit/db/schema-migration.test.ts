import { afterEach, describe, expect, it } from 'vitest'

import { AUTHZ_TABLES } from '@/lib/db/authz'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

describe('D1 schema migration', () => {
  let database: TestDatabase | undefined

  afterEach(() => {
    database?.sqlite.close()
    database = undefined
  })

  it('creates every migrated table and the four compatibility views', () => {
    database = createTestDatabase()

    const tables = database.sqlite
      .prepare("select name from sqlite_master where type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name)

    for (const table of AUTHZ_TABLES) {
      expect(tables).toContain(table)
    }

    const views = database.sqlite
      .prepare("select name from sqlite_master where type = 'view'")
      .all()
      .map((row) => (row as { name: string }).name)

    expect(views).toEqual(expect.arrayContaining([
      'danger_reports_public_preview',
      'report_stats',
      'public_reports_with_stats',
      'danger_category_stats',
    ]))
  })

  it('enforces coordinates, JSON, and composite uniqueness in SQLite itself', () => {
    database = createTestDatabase()

    expect(() => database!.sqlite.prepare(`
      insert into danger_reports (
        id, user_id, title, danger_type, danger_level, latitude, longitude,
        processed_image_keys, status
      ) values ('r1', 'u1', 'bad', 'traffic', 3, 91, 139, '[]', 'pending')
    `).run()).toThrow()

    expect(() => database!.sqlite.prepare(`
      insert into danger_reports (
        id, user_id, title, danger_type, danger_level, latitude, longitude,
        processed_image_keys, status
      ) values ('r2', 'u1', 'bad json', 'traffic', 3, 35, 139, 'nope', 'pending')
    `).run()).toThrow()

    database.sqlite.prepare(`
      insert into danger_reports (
        id, user_id, title, danger_type, danger_level, latitude, longitude,
        processed_image_keys, status
      ) values ('r1', 'u1', 'valid', 'traffic', 3, 35, 139, '[]', 'approved')
    `).run()

    database.sqlite.prepare(`
      insert into danger_report_reactions (
        id, user_id, report_id, reaction_type
      ) values ('x1', 'u1', 'r1', 'careful')
    `).run()

    expect(() => database!.sqlite.prepare(`
      insert into danger_report_reactions (
        id, user_id, report_id, reaction_type
      ) values ('x2', 'u1', 'r1', 'careful')
    `).run()).toThrow()
  })
})
