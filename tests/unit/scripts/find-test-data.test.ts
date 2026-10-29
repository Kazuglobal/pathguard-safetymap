// @vitest-environment node
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { DEMO_SAMPLE_MODERATION_REASON } from '@/lib/admin-report-moderation-queue'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { getLeaderboardExclusions, LEADERBOARD_EXCLUDED_EMAILS_ENV } from '@/lib/leaderboard-exclusions'
import {
  buildFindTestDataQueries,
  collectTestDataCandidates,
  main,
  type TestDataCandidates,
} from '@/scripts/ops/find-test-data'
import { DEMO_SAMPLE_ROUTE_DESCRIPTION_PREFIX } from '@/scripts/ops/ops-shared'

import { createFakeWrangler, createTestDeps } from './ops-fake-wrangler'

const ENV = { [LEADERBOARD_EXCLUDED_EMAILS_ENV]: 'staff@corp.jp' }
const WRITE_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|REPLACE|CREATE|ATTACH|PRAGMA|VACUUM)\b/i
const EMAIL_LIKE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/

function seed(database: TestDatabase) {
  const profile = database.sqlite.prepare('insert into profiles (id, email, display_name) values (?, ?, ?)')
  profile.run('demo', 'demo@example.com', 'デモ')
  profile.run('tester', 'user@test.com', 'テスト')
  profile.run('staff', 'staff@corp.jp', '職員')
  profile.run('real', 'real@gmail.com', '保護者')
  const points = database.sqlite.prepare('insert into user_points (user_id, points, level) values (?, ?, 1)')
  points.run('demo', 120)
  points.run('tester', 40)
  points.run('real', 300)
  points.run('ghost', 50)

  const report = database.sqlite.prepare(`insert into danger_reports
    (id, user_id, title, danger_type, danger_level, latitude, longitude, ai_moderation_status, ai_moderation_reason, image_key, processed_image_keys)
    values (?, ?, ?, 'traffic', 3, 35.68, 139.76, ?, ?, ?, ?)`)
  const plain = (id: string, userId: string, title: string) => report.run(id, userId, title, null, null, null, '[]')
  report.run('r-uitest', 'real', 'UIテスト 交差点', null, null, 'danger-reports/real/r-uitest/a.webp', '["danger-reports/real/r-uitest/b.webp"]')
  plain('r-delete', 'real', '削除可：古い報告')
  plain('r-ux', 'real', '[UXテスト] 歩道')
  plain('r-sample', 'real', 'サンプル投稿')
  plain('r-real', 'real', '見通しの悪い交差点')
  report.run('r-real-marker', 'real', '段差テスト', 'needs_review', DEMO_SAMPLE_MODERATION_REASON, null, '[]')
  plain('r-demo-owned', 'demo', '駅前の歩道')
  report.run('r-demo-seed', 'demo', '【サンプル】見通しの悪い交差点', 'needs_review', DEMO_SAMPLE_MODERATION_REASON, null, '[]')
  plain('r-tester-owned', 'tester', 'UIテスト')
  plain('r-staff-owned', 'staff', '公園の前')
  database.sqlite.prepare("insert into report_images (id, report_id, image_key) values ('img-1', 'r-uitest', 'danger-reports/real/r-uitest/extra.webp')").run()

  const route = database.sqlite.prepare(`insert into user_routes
    (id, user_id, name, description, start_address, start_lat, start_lng, end_address, end_lat, end_lng)
    values (?, ?, ?, ?, '東京駅', 35.68, 139.76, '学校', 35.67, 139.76)`)
  route.run('route-test', 'real', 'テスト通学路1', null)
  route.run('route-kanoha', 'real', 'Kanoha route', null)
  route.run('route-real', 'real', '学校への道', null)
  route.run('route-tester', 'tester', '学校への道', null)
  route.run('route-demo-seed', 'demo', 'サンプル：まるのうち小への通学路', `${DEMO_SAMPLE_ROUTE_DESCRIPTION_PREFIX}見本です`)
  route.run('route-demo-other', 'demo', 'おばあちゃんの家', null)
}

function find(database: TestDatabase, env: Record<string, string>, includeDemoSamples = false): TestDataCandidates {
  const queries = buildFindTestDataQueries(getLeaderboardExclusions(env), { includeDemoSamples })
  const results = queries.map((query) => ({ results: database.sqlite.prepare(query.sql).all() as Record<string, unknown>[] }))
  return collectTestDataCandidates(queries, results, new Date('2026-10-28T00:00:00.000Z'))
}

describe('find-test-data SQL builders', () => {
  it('only builds read-only SELECT statements', () => {
    const queries = buildFindTestDataQueries(getLeaderboardExclusions(ENV))
    expect(queries.map((query) => query.name)).toEqual([
      'excluded_accounts', 'reports_by_title', 'reports_by_owner', 'routes_by_name', 'routes_by_owner', 'leaderboard_users_without_profile',
    ])
    for (const query of queries) {
      expect(query.sql.trimStart().startsWith('SELECT')).toBe(true)
      expect(query.sql).not.toMatch(WRITE_KEYWORDS)
      expect(query.displaySql).not.toMatch(WRITE_KEYWORDS)
    }
  })

  it('keeps LEADERBOARD_EXCLUDED_EMAILS values out of the SQL that is shown', () => {
    const queries = buildFindTestDataQueries(getLeaderboardExclusions(ENV))
    expect(queries.some((query) => query.sql.includes("'staff@corp.jp'"))).toBe(true)
    for (const query of queries) expect(query.displaySql).not.toContain('staff@corp.jp')
  })
})

describe('find-test-data against the D1 schema', () => {
  let database: TestDatabase
  beforeEach(() => {
    database = createTestDatabase()
    seed(database)
  })
  afterEach(() => database.sqlite.close())

  it('finds test-titled reports, test routes and everything owned by demo/test accounts', () => {
    const candidates = find(database, ENV)

    expect(candidates.reports.map((report) => report.id).sort()).toEqual([
      'r-delete', 'r-demo-owned', 'r-real-marker', 'r-sample', 'r-staff-owned', 'r-tester-owned', 'r-uitest', 'r-ux',
    ])
    expect(candidates.reports.find((report) => report.id === 'r-tester-owned')?.matched_by).toEqual(['title', 'owner'])
    expect(candidates.reports.find((report) => report.id === 'r-uitest')?.image_keys).toEqual([
      'danger-reports/real/r-uitest/a.webp',
      'danger-reports/real/r-uitest/b.webp',
      'danger-reports/real/r-uitest/extra.webp',
    ])
    expect(candidates.routes.map((route) => route.id).sort()).toEqual(['route-demo-other', 'route-kanoha', 'route-test', 'route-tester'])
    expect(candidates.excludedAccounts.map((account) => [account.user_id, account.matched_rule, account.points])).toEqual(
      expect.arrayContaining([['demo', '@example.com', 120], ['tester', '@test.com', 40], ['staff', LEADERBOARD_EXCLUDED_EMAILS_ENV, 0]]),
    )
    expect(candidates.excludedAccounts).toHaveLength(3)
    expect(candidates.leaderboardUsersWithoutProfile).toBe(1)
    expect(candidates.truncated).toEqual([])
  })

  it('leaves the seeded demo samples alone unless asked', () => {
    const byDefault = find(database, ENV)
    expect(byDefault.reports.map((report) => report.id)).not.toContain('r-demo-seed')
    expect(byDefault.routes.map((route) => route.id)).not.toContain('route-demo-seed')

    const included = find(database, ENV, true)
    expect(included.reports.map((report) => report.id)).toContain('r-demo-seed')
    expect(included.routes.map((route) => route.id)).toContain('route-demo-seed')
  })

  it('only uses LEADERBOARD_EXCLUDED_EMAILS when it is set', () => {
    const candidates = find(database, {})
    expect(candidates.reports.map((report) => report.id)).not.toContain('r-staff-owned')
    expect(candidates.excludedAccounts.map((account) => account.user_id)).not.toContain('staff')
  })

  it('never outputs an email address', () => {
    expect(JSON.stringify(find(database, ENV, true))).not.toMatch(EMAIL_LIKE)
  })

  it('shortens long titles to 40 characters and marks the cut with …', () => {
    database.sqlite.prepare(`insert into danger_reports (id, user_id, title, danger_type, danger_level, latitude, longitude)
      values ('r-long', 'real', ?, 'traffic', 3, 35.68, 139.76)`).run(`テスト${'あ'.repeat(60)}`)
    const long = find(database, ENV).reports.find((report) => report.id === 'r-long')
    expect(long?.title).toBe(`テスト${'あ'.repeat(37)}…`)
    expect(find(database, ENV).reports.find((report) => report.id === 'r-ux')?.title).toBe('[UXテスト] 歩道')
  })
})

describe('find-test-data main', () => {
  let database: TestDatabase
  beforeEach(() => {
    database = createTestDatabase()
    seed(database)
  })
  afterEach(() => database.sqlite.close())

  it('only prints the SQL by default and never calls wrangler', async () => {
    const fake = createFakeWrangler(database.sqlite)
    const deps = createTestDeps({ runner: fake.runner, env: ENV })

    await expect(main([], deps)).resolves.toBe(0)

    expect(fake.calls).toEqual([])
    expect(deps.lines.join('\n')).toContain('SELECT')
    expect(deps.lines.join('\n')).not.toContain('staff@corp.jp')
  })

  it('runs every SELECT in one remote d1 execute call with --remote', async () => {
    const fake = createFakeWrangler(database.sqlite)
    const deps = createTestDeps({ runner: fake.runner, env: ENV })

    await expect(main(['--remote'], deps)).resolves.toBe(0)

    expect(fake.calls).toHaveLength(1)
    expect(fake.calls[0].slice(0, 6)).toEqual(['d1', 'execute', 'pathguardian', '--remote', '--json', '--command'])
    expect(fake.calls[0][6]).toContain("'staff@corp.jp'")
    expect(deps.lines.join('\n')).not.toContain('staff@corp.jp')
    expect(deps.lines.join('\n')).toContain('r-uitest')
  })

  it('writes the candidates file for cleanup-test-data.ts and refuses to overwrite one', async () => {
    const fake = createFakeWrangler(database.sqlite)
    const deps = createTestDeps({ runner: fake.runner, env: ENV })
    await expect(main(['--remote', '--out=candidates.json'], deps)).resolves.toBe(0)
    const written = deps.written.get(path.resolve(process.cwd(), 'candidates.json'))
    expect(JSON.parse(written ?? '{}').kind).toBe('pathguardian-test-data-candidates')
    expect(written).not.toMatch(EMAIL_LIKE)

    const existing = createTestDeps({ runner: fake.runner, env: ENV, files: { 'candidates.json': '{}' } })
    await expect(main(['--remote', '--out=candidates.json'], existing)).resolves.toBe(1)
    expect(fake.calls).toHaveLength(1)
  })

  it('rejects --out without --remote and unknown options', async () => {
    const fake = createFakeWrangler(database.sqlite)
    await expect(main(['--out=x.json'], createTestDeps({ runner: fake.runner }))).resolves.toBe(1)
    await expect(main(['--remote', '--delete'], createTestDeps({ runner: fake.runner }))).resolves.toBe(1)
    expect(fake.calls).toEqual([])
  })
})
