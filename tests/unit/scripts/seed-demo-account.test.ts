// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEMO_SAMPLE_MODERATION_REASON, filterModerationQueue, type AdminModerationReport } from '@/lib/admin-report-moderation-queue'
import { createDangerModerationD1 } from '@/lib/danger-report-moderation-d1'
import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createDangerReportsRepo } from '@/lib/db/repos/danger-reports.repo'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { getLeaderboardExclusions, LEADERBOARD_EXCLUDED_EMAILS_ENV } from '@/lib/leaderboard-exclusions'
import { buildFindTestDataQueries, collectTestDataCandidates } from '@/scripts/ops/find-test-data'
import {
  assertDemoUserId,
  buildDemoSeed,
  DEMO_POINTS,
  DEMO_REPORT_SAMPLES,
  DEMO_ROUTE_SAMPLES,
  DEMO_SEED_CONFIRM_ENV,
  demoSeedIds,
  main,
  pathLengthMeters,
  uuidV5,
} from '@/scripts/ops/seed-demo-account'
import { UsageError } from '@/scripts/ops/ops-shared'

import { createFakeWrangler, createTestDeps, runOnSqlite } from './ops-fake-wrangler'

const DEMO_ID = '11111111-2222-4333-8444-555555555555'
const REAL_ID = '99999999-8888-4777-8666-555555555555'
const exclusions = getLeaderboardExclusions({})
const service: Actor = { kind: 'service' }

function addProfile(database: TestDatabase, id: string, email: string) {
  database.sqlite.prepare('insert into profiles (id, email, display_name) values (?, ?, ?)').run(id, email, 'デモ')
}

function applySeed(database: TestDatabase, userId = DEMO_ID) {
  return runOnSqlite(database.sqlite, buildDemoSeed(userId, exclusions).sql)
}

function count(database: TestDatabase, table: string, where = '1 = 1'): number {
  return (database.sqlite.prepare(`select count(*) as n from ${table} where ${where}`).get() as { n: number }).n
}

describe('seed-demo-account id and SQL generation', () => {
  it('implements RFC 4122 UUID v5 (known test vector)', () => {
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2')
  })

  it('derives stable, per-user ids from the given user id', () => {
    const ids = demoSeedIds(DEMO_ID)
    expect(demoSeedIds(DEMO_ID.toUpperCase())).toEqual(ids)
    expect(ids.routes).toHaveLength(2)
    expect(ids.reports).toHaveLength(3)
    expect(new Set([...ids.routes, ...ids.reports, ...demoSeedIds(REAL_ID).reports]).size).toBe(8)
  })

  it.each(['', 'demo', "1'; DELETE FROM profiles; --", '11111111-2222-4333-8444-55555555555'])('rejects %j as a user id', (value) => {
    expect(() => assertDemoUserId(value)).toThrow(UsageError)
  })

  it('names the samples clearly and never uses a fixed user id', () => {
    expect(DEMO_ROUTE_SAMPLES.map((route) => route.name)).toContain('サンプル：まるのうち小への通学路')
    expect(DEMO_REPORT_SAMPLES.every((report) => report.title.startsWith('【サンプル】'))).toBe(true)
    const seed = buildDemoSeed(DEMO_ID, exclusions)
    expect(seed.sql).toContain(DEMO_ID)
    expect(buildDemoSeed(REAL_ID, exclusions).sql).not.toContain(DEMO_ID)
  })

  it('keeps LEADERBOARD_EXCLUDED_EMAILS values out of the displayed SQL', () => {
    const seed = buildDemoSeed(DEMO_ID, getLeaderboardExclusions({ [LEADERBOARD_EXCLUDED_EMAILS_ENV]: 'staff@corp.jp' }))
    expect(seed.sql).toContain("'staff@corp.jp'")
    expect(seed.displaySql).not.toContain('staff@corp.jp')
  })

  it('computes plausible walking distances for the sample routes near Tokyo Station', () => {
    const distances = DEMO_ROUTE_SAMPLES.map((route) => pathLengthMeters(route.path))
    for (const distance of distances) {
      expect(distance).toBeGreaterThan(300)
      expect(distance).toBeLessThan(1500)
    }
  })
})

describe('seed-demo-account SQL against the D1 schema', () => {
  let database: TestDatabase
  beforeEach(() => { database = createTestDatabase() })
  afterEach(() => database.sqlite.close())

  it('creates 2 routes, 3 hidden sample reports and 120pt for a demo account', () => {
    addProfile(database, DEMO_ID, 'demo@example.com')
    applySeed(database)
    const ids = demoSeedIds(DEMO_ID)

    expect(count(database, 'user_routes', `user_id = '${DEMO_ID}'`)).toBe(2)
    const reports = database.sqlite.prepare('select * from danger_reports order by title').all() as Array<Record<string, unknown>>
    expect(reports).toHaveLength(3)
    for (const report of reports) {
      expect(report).toMatchObject({
        user_id: DEMO_ID,
        status: 'pending',
        ai_moderation_status: 'needs_review',
        ai_moderation_reason: DEMO_SAMPLE_MODERATION_REASON,
        reward_points: null,
      })
      expect(ids.reports).toContain(report.id)
    }
    expect(database.sqlite.prepare('select points, level from user_points where user_id = ?').get(DEMO_ID)).toEqual({ points: DEMO_POINTS, level: 1 })
    const route = database.sqlite.prepare('select route_geometry from user_routes where id = ?').get(ids.routes[0]) as { route_geometry: string }
    expect(JSON.parse(route.route_geometry)).toMatchObject({ type: 'LineString' })
  })

  it('is never picked up by the 5-minute moderation sweep (live or shadow)', async () => {
    addProfile(database, DEMO_ID, 'demo@example.com')
    applySeed(database)
    database.sqlite.prepare(`insert into danger_reports (id, user_id, title, danger_type, danger_level, latitude, longitude, created_at)
      values ('control', 'someone', '普通の報告', 'traffic', 3, 35.68, 139.76, '2026-01-01T00:00:00.000Z')`).run()
    const moderation = createDangerModerationD1(database.db as unknown as AppDb)
    const future = '2999-01-01T00:00:00.000Z'

    for (const mode of ['live', 'shadow'] as const) {
      const picked = await moderation.listForSweep(service, { mode, cutoff: future, limit: 100 })
      expect(picked.map((report) => report.id)).toEqual(['control'])
    }
  })

  it('is never visible to anonymous viewers or other users', async () => {
    addProfile(database, DEMO_ID, 'demo@example.com')
    applySeed(database)
    const repo = createDangerReportsRepo(database.db as unknown as AppDb)

    await expect(repo.list({ kind: 'anon' })).resolves.toEqual([])
    await expect(repo.list({ kind: 'user', id: 'someone', email: null, isAdmin: false })).resolves.toEqual([])
    await expect(repo.list({ kind: 'user', id: DEMO_ID, email: 'demo@example.com', isAdmin: false })).resolves.toHaveLength(3)
  })

  it('is idempotent and restores the sample state on re-run', () => {
    addProfile(database, DEMO_ID, 'demo@example.com')
    applySeed(database)
    const [firstReport] = demoSeedIds(DEMO_ID).reports
    database.sqlite.prepare("update danger_reports set status = 'published', ai_moderation_status = 'approved', title = 'いたずら' where id = ?").run(firstReport)
    database.sqlite.prepare('update user_points set points = 999 where user_id = ?').run(DEMO_ID)

    const verify = applySeed(database).at(-1)?.results[0]

    expect(verify).toEqual({ routes: 2, hidden_reports: 3, points: DEMO_POINTS })
    expect(count(database, 'user_routes')).toBe(2)
    expect(count(database, 'danger_reports')).toBe(3)
    expect(count(database, 'danger_reports', "status = 'pending' and ai_moderation_status = 'needs_review'")).toBe(3)
    expect(count(database, 'danger_reports', "title = 'いたずら'")).toBe(0)
    // 2回目は INSERT にならないので投稿数の上限カウント(report_create_history)も増えない
    expect(count(database, 'report_create_history')).toBe(3)
  })

  it('writes nothing for a real account or a missing profile', () => {
    addProfile(database, REAL_ID, 'parent@gmail.com')
    applySeed(database, REAL_ID)
    applySeed(database, DEMO_ID)

    expect(count(database, 'user_routes')).toBe(0)
    expect(count(database, 'danger_reports')).toBe(0)
    expect(count(database, 'user_points')).toBe(0)
  })

  it('stays out of the admin queue and the test-data finder, but is found when asked', () => {
    addProfile(database, DEMO_ID, 'demo@example.com')
    applySeed(database)
    const rows = database.sqlite.prepare('select * from danger_reports').all() as Array<Record<string, unknown>>
    const queueReports = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      danger_type: row.danger_type,
      danger_level: row.danger_level,
      status: row.status,
      latitude: row.latitude,
      longitude: row.longitude,
      created_at: row.created_at,
      profiles: null,
      ai_moderation_status: row.ai_moderation_status,
      ai_moderation_reason: row.ai_moderation_reason,
      ai_moderation_score: row.ai_moderation_score,
      ai_moderation_checked_at: row.ai_moderation_checked_at,
      owner_excluded: true,
    }) as AdminModerationReport)
    expect(filterModerationQueue(queueReports, 'all')).toEqual([])

    const find = (includeDemoSamples: boolean) => {
      const queries = buildFindTestDataQueries(exclusions, { includeDemoSamples })
      const results = queries.map((query) => ({ results: database.sqlite.prepare(query.sql).all() as Record<string, unknown>[] }))
      return collectTestDataCandidates(queries, results, new Date())
    }
    expect(find(false).reports).toEqual([])
    expect(find(false).routes).toEqual([])
    expect(find(true).reports).toHaveLength(3)
    expect(find(true).routes).toHaveLength(2)
  })
})

describe('seed-demo-account main', () => {
  let database: TestDatabase
  beforeEach(() => { database = createTestDatabase() })
  afterEach(() => database.sqlite.close())

  it('prints the SQL by default and never calls wrangler', async () => {
    const fake = createFakeWrangler(database.sqlite)
    const deps = createTestDeps({ runner: fake.runner })

    await expect(main([`--user-id=${DEMO_ID}`], deps)).resolves.toBe(0)

    expect(fake.calls).toEqual([])
    expect(deps.lines.join('\n')).toContain('INSERT INTO danger_reports')
  })

  it('requires --user-id and the confirmation variable for --apply', async () => {
    const fake = createFakeWrangler(database.sqlite)
    await expect(main([], createTestDeps({ runner: fake.runner }))).resolves.toBe(1)
    await expect(main([`--user-id=${DEMO_ID}`, '--apply'], createTestDeps({ runner: fake.runner }))).resolves.toBe(1)
    expect(fake.calls).toEqual([])
  })

  it('checks the account first and refuses a real or unknown account', async () => {
    addProfile(database, REAL_ID, 'parent@gmail.com')
    const fake = createFakeWrangler(database.sqlite)
    const env = { [DEMO_SEED_CONFIRM_ENV]: 'yes' }

    const real = createTestDeps({ runner: fake.runner, env })
    await expect(main([`--user-id=${REAL_ID}`, '--apply'], real)).resolves.toBe(1)
    expect(real.errors.join('\n')).toContain('デモ・テストアカウント')
    const unknown = createTestDeps({ runner: fake.runner, env })
    await expect(main([`--user-id=${DEMO_ID}`, '--apply'], unknown)).resolves.toBe(1)
    expect(unknown.errors.join('\n')).toContain('profiles 行がありません')

    expect(fake.calls).toHaveLength(2)
    expect(fake.calls.every((call) => /^SELECT/.test(call[6]))).toBe(true)
    expect(count(database, 'danger_reports')).toBe(0)
  })

  it('seeds a demo account with --apply and verifies the result', async () => {
    addProfile(database, DEMO_ID, 'demo@example.com')
    const fake = createFakeWrangler(database.sqlite)
    const deps = createTestDeps({ runner: fake.runner, env: { [DEMO_SEED_CONFIRM_ENV]: 'yes' } })

    await expect(main([`--user-id=${DEMO_ID}`, '--apply'], deps)).resolves.toBe(0)

    expect(fake.calls).toHaveLength(2)
    expect(fake.calls.every((call) => call.slice(0, 5).join(' ') === 'd1 execute pathguardian --remote --json')).toBe(true)
    expect(deps.lines.join('\n')).toContain(`ポイント ${DEMO_POINTS}pt`)
    expect(count(database, 'danger_reports', "status = 'pending'")).toBe(3)
  })
})
