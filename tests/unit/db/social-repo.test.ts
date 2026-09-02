import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createSocialRepo } from '@/lib/db/repos/social.repo'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

const actor: Actor = { kind: 'user', id: 'user-1', email: null, isAdmin: false }

describe('social D1 repository', () => {
  let database: TestDatabase

  beforeEach(() => {
    database = createTestDatabase()
    database.sqlite.prepare(`
      insert into danger_reports (
        id, user_id, title, danger_type, danger_level, latitude, longitude, status
      ) values ('report-1', 'author-1', 'Report', 'traffic', 3, 35, 139, 'published')
    `).run()
  })

  afterEach(() => database.sqlite.close())

  it('toggles likes with a unique row and returns aggregate count', async () => {
    const repo = createSocialRepo(database.db as unknown as AppDb)

    await expect(repo.toggleLike(actor, 'report-1')).resolves.toEqual({ active: true, count: 1 })
    await expect(repo.toggleLike(actor, 'report-1')).resolves.toEqual({ active: false, count: 0 })
  })

  it('keeps bookmark state independent from likes', async () => {
    const repo = createSocialRepo(database.db as unknown as AppDb)

    await repo.toggleLike(actor, 'report-1')
    await expect(repo.toggleBookmark(actor, 'report-1')).resolves.toEqual({ active: true, count: 1 })

    const likeCount = database.sqlite.prepare(
      "select count(*) as count from report_likes where report_id = 'report-1'",
    ).get() as { count: number }
    expect(likeCount.count).toBe(1)
  })

  it('rejects anonymous mutation before touching D1', async () => {
    const repo = createSocialRepo(database.db as unknown as AppDb)

    await expect(repo.toggleLike({ kind: 'anon' }, 'report-1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it('returns aggregate counts plus only the current user state', async () => {
    const repo = createSocialRepo(database.db as unknown as AppDb)
    await repo.toggleLike(actor, 'report-1')
    database.sqlite.prepare(`
      insert into report_likes (id, user_id, report_id)
      values ('like-other', 'other-user', 'report-1')
    `).run()

    await expect(repo.listInteractions(actor, ['report-1'])).resolves.toEqual([{
      reportId: 'report-1',
      liked: true,
      likeCount: 2,
      saved: false,
      saveCount: 0,
    }])
  })
})
