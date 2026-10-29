import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createGamificationRepo } from '@/lib/db/repos/gamification.repo'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { LEADERBOARD_EXCLUDED_EMAILS_ENV } from '@/lib/leaderboard-exclusions'

const viewer: Actor = { kind: 'user', id: 'real-0', email: 'real0@gmail.com', isAdmin: false }

describe('leaderboard excludes demo and test accounts', () => {
  let database: TestDatabase
  let repo: ReturnType<typeof createGamificationRepo>

  beforeEach(() => {
    delete process.env[LEADERBOARD_EXCLUDED_EMAILS_ENV]
    database = createTestDatabase()
    repo = createGamificationRepo(database.db as unknown as AppDb)
  })
  afterEach(() => {
    delete process.env[LEADERBOARD_EXCLUDED_EMAILS_ENV]
    database.sqlite.close()
  })

  function seedUser(id: string, email: string | null, points: number) {
    if (email !== null) {
      database.sqlite.prepare('insert into profiles (id, email, display_name) values (?, ?, ?)').run(id, email, `name-${id}`)
    }
    database.sqlite.prepare('insert into user_points (user_id, points, level) values (?, ?, 1)').run(id, points)
  }

  function seedRealUsers(count: number) {
    for (let index = 0; index < count; index += 1) seedUser(`real-${index}`, `real${index}@gmail.com`, 100 + index)
  }

  it('drops excluded accounts before LIMIT 50 so the board is still filled with real users', async () => {
    seedRealUsers(55)
    seedUser('demo', 'demo@example.com', 5000)
    seedUser('tester', 'Student@Test.com', 4000)
    seedUser('admin-test', 'admin@test.com', 3500)

    const { top } = await repo.leaderboard(viewer, viewer.id)

    expect(top).toHaveLength(50)
    const ids = top.map((row) => row.userId)
    expect(ids).not.toContain('demo')
    expect(ids).not.toContain('tester')
    expect(ids).not.toContain('admin-test')
    expect(ids[0]).toBe('real-54')
    expect(ids[49]).toBe('real-5')
  })

  it('keeps users whose email is unknown (no profiles row) and lookalike domains', async () => {
    seedRealUsers(3)
    seedUser('no-profile', null, 900)
    seedUser('lookalike', 'someone@notexample.com', 800)

    const { top } = await repo.leaderboard(viewer, viewer.id)

    expect(top.map((row) => row.userId)).toEqual(['no-profile', 'lookalike', 'real-2', 'real-1', 'real-0'])
  })

  it('also excludes the emails listed in LEADERBOARD_EXCLUDED_EMAILS', async () => {
    seedRealUsers(3)
    seedUser('staff', 'Staff@Corp.jp', 700)

    expect((await repo.leaderboard(viewer)).top.map((row) => row.userId)).toContain('staff')
    process.env[LEADERBOARD_EXCLUDED_EMAILS_ENV] = 'other@corp.jp, staff@corp.jp'
    expect((await repo.leaderboard(viewer)).top.map((row) => row.userId)).not.toContain('staff')
  })

  it('still shows an excluded viewer their own points as an unranked row', async () => {
    seedRealUsers(3)
    seedUser('demo', 'demo@example.com', 120)
    const demo: Actor = { kind: 'user', id: 'demo', email: 'demo@example.com', isAdmin: false }

    const { top, mine } = await repo.leaderboard(demo, demo.id)

    expect(top.map((row) => row.userId)).not.toContain('demo')
    expect(mine).toMatchObject({ userId: 'demo', points: 120 })
  })
})
