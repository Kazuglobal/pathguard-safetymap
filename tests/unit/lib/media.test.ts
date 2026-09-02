import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createPrivateMediaAuthorizer } from '@/lib/media/authorize'
import {
  parsePrivateMediaKey,
  privateMediaUrl,
  publicMediaUrl,
} from '@/lib/media/url'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

const owner: Actor = { kind: 'user', id: 'owner-1', email: null, isAdmin: false }
const other: Actor = { kind: 'user', id: 'other-1', email: null, isAdmin: false }
const admin: Actor = { kind: 'user', id: 'admin-1', email: 'admin@example.com', isAdmin: true }

describe('media key URL helpers', () => {
  it('encodes keys without accepting legacy absolute URLs', () => {
    expect(publicMediaUrl('avatars/user 1/photo.webp', 'https://media.example.com/'))
      .toBe('https://media.example.com/avatars/user%201/photo.webp')
    expect(privateMediaUrl('danger-reports/u/r/photo.webp'))
      .toBe('/api/media/private/danger-reports/u/r/photo.webp')
    expect(() => publicMediaUrl('https://old.example/photo.webp', 'https://media.example.com'))
      .toThrow('media key')
  })

  it('decodes once and rejects traversal, malformed prefixes and segment counts', () => {
    expect(parsePrivateMediaKey('danger-reports/u/r/photo%20one.webp')).toEqual({
      kind: 'danger-report',
      key: 'danger-reports/u/r/photo one.webp',
      ownerId: 'u',
      resourceId: 'r',
    })
    expect(() => parsePrivateMediaKey('danger-reports/u/r/../secret')).toThrow('media key')
    expect(() => parsePrivateMediaKey('/danger-reports/u/r/photo.webp')).toThrow('media key')
    expect(() => parsePrivateMediaKey('other/u/r/photo.webp')).toThrow('media key')
    expect(() => parsePrivateMediaKey('hunter-photos/u/photo.webp')).toThrow('media key')
  })
})

describe('private media row authorization', () => {
  let database: TestDatabase

  beforeEach(() => {
    database = createTestDatabase()
    database.sqlite.prepare(`
      insert into danger_reports (
        id, user_id, title, danger_type, danger_level, latitude, longitude, status, image_key
      ) values (?, 'owner-1', 'report', 'traffic', 3, 35, 139, ?, ?)
    `).run('public-report', 'published', 'danger-reports/owner-1/public-report/photo.webp')
    database.sqlite.prepare(`
      insert into danger_reports (
        id, user_id, title, danger_type, danger_level, latitude, longitude, status, image_key
      ) values (?, 'owner-1', 'report', 'traffic', 3, 35, 139, ?, ?)
    `).run('pending-report', 'pending', 'danger-reports/owner-1/pending-report/photo.webp')
    database.sqlite.prepare(`
      insert into hunter_photos (id, player_id, image_key)
      values ('photo-1', 'owner-1', 'hunter-photos/owner-1/photo-1/masked.webp')
    `).run()
  })

  afterEach(() => database.sqlite.close())

  it('allows authenticated public reports but protects pending reports', async () => {
    const authorize = createPrivateMediaAuthorizer(database.db as unknown as AppDb)

    await expect(authorize(other, parsePrivateMediaKey(
      'danger-reports/owner-1/public-report/photo.webp',
    ))).resolves.toBe(true)
    await expect(authorize(other, parsePrivateMediaKey(
      'danger-reports/owner-1/pending-report/photo.webp',
    ))).resolves.toBe(false)
    await expect(authorize(owner, parsePrivateMediaKey(
      'danger-reports/owner-1/pending-report/photo.webp',
    ))).resolves.toBe(true)
    await expect(authorize(admin, parsePrivateMediaKey(
      'danger-reports/owner-1/pending-report/photo.webp',
    ))).resolves.toBe(true)
  })

  it('requires exact hunter ownership and persisted object key', async () => {
    const authorize = createPrivateMediaAuthorizer(database.db as unknown as AppDb)
    const key = parsePrivateMediaKey('hunter-photos/owner-1/photo-1/masked.webp')

    await expect(authorize(owner, key)).resolves.toBe(true)
    await expect(authorize(other, key)).resolves.toBe(false)
    await expect(authorize(owner, parsePrivateMediaKey(
      'hunter-photos/owner-1/photo-1/original.webp',
    ))).resolves.toBe(false)
  })
})
