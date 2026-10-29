// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { LEADERBOARD_EXCLUDED_EMAILS_ENV } from '@/lib/leaderboard-exclusions'

const state = vi.hoisted(() => ({
  db: null as unknown,
  actor: { kind: 'user', id: 'admin', email: 'owner@corp.jp', isAdmin: true } as Actor,
}))

vi.mock('@/lib/db/client', () => ({ getDb: () => state.db }))
vi.mock('@/lib/auth/actor', () => ({ getActor: async () => state.actor }))

import { getReportsWithProfiles } from '@/lib/admin-reports-service'

describe('admin reports service marks demo/test owners without exposing emails', () => {
  let database: TestDatabase

  beforeEach(() => {
    delete process.env[LEADERBOARD_EXCLUDED_EMAILS_ENV]
    database = createTestDatabase()
    state.db = database.db
    const profile = database.sqlite.prepare('insert into profiles (id, email, display_name) values (?, ?, ?)')
    profile.run('demo', 'demo@example.com', 'デモ')
    profile.run('tester', 'user@test.com', 'テスト')
    profile.run('staff', 'staff@corp.jp', '職員')
    profile.run('real', 'real@gmail.com', '保護者')
    const report = database.sqlite.prepare(
      "insert into danger_reports (id, user_id, title, danger_type, danger_level, latitude, longitude) values (?, ?, ?, 'traffic', 3, 35.68, 139.76)",
    )
    for (const [id, userId] of [['r-demo', 'demo'], ['r-tester', 'tester'], ['r-staff', 'staff'], ['r-real', 'real'], ['r-orphan', 'no-profile']]) {
      report.run(id, userId, `報告 ${id}`)
    }
  })
  afterEach(() => {
    delete process.env[LEADERBOARD_EXCLUDED_EMAILS_ENV]
    database.sqlite.close()
  })

  it('sets owner_excluded from the same rules as the leaderboard', async () => {
    process.env[LEADERBOARD_EXCLUDED_EMAILS_ENV] = 'staff@corp.jp'
    const reports = await getReportsWithProfiles()
    const flags = Object.fromEntries(reports.map((report) => [report.id, report.owner_excluded]))

    expect(flags).toEqual({ 'r-demo': true, 'r-tester': true, 'r-staff': true, 'r-real': false, 'r-orphan': false })
    expect(reports.find((report) => report.id === 'r-real')?.profiles).toEqual({ display_name: '保護者' })
  })

  it('never puts an email address into the response', async () => {
    process.env[LEADERBOARD_EXCLUDED_EMAILS_ENV] = 'staff@corp.jp'
    const body = JSON.stringify(await getReportsWithProfiles())

    expect(body).not.toMatch(/@(example\.com|test\.com|corp\.jp|gmail\.com)/)
    expect(body).not.toContain('"email"')
  })
})
