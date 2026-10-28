// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import {
  buildCleanupPlan,
  CLEANUP_CONFIRM_ENV,
  isOwnedReportImageKey,
  main,
  MAX_CLEANUP_IDS,
  parseCleanupInput,
  planR2Deletions,
  resolveCleanup,
} from '@/scripts/ops/cleanup-test-data'
import { UsageError } from '@/scripts/ops/ops-shared'

import { createFakeWrangler, createTestDeps } from './ops-fake-wrangler'

const BUCKET = 'pg-media-private'
const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => `${prefix}-${index}`)

function seed(database: TestDatabase) {
  const profile = database.sqlite.prepare('insert into profiles (id, email) values (?, ?)')
  profile.run('tester', 'user@test.com')
  profile.run('real', 'real@gmail.com')
  const points = database.sqlite.prepare('insert into user_points (user_id, points, level) values (?, ?, 1)')
  points.run('tester', 60)
  points.run('real', 100)
  const report = database.sqlite.prepare(`insert into danger_reports
    (id, user_id, title, danger_type, danger_level, latitude, longitude, status, reward_points, image_key, processed_image_keys)
    values (?, ?, ?, 'traffic', 3, 35.68, 139.76, ?, ?, ?, ?)`)
  report.run('r-approved', 'tester', 'UIテスト', 'approved', 20, 'danger-reports/tester/r-approved/a.webp',
    '["danger-reports/tester/r-approved/b.webp","danger-reports/other/r-approved/c.webp"]')
  report.run('r-pending', 'tester', '削除可', 'pending', 0, null, '[]')
  report.run('r-keep', 'real', '本物の報告', 'approved', 20, 'danger-reports/real/r-keep/k.webp', '[]')
  const image = database.sqlite.prepare('insert into report_images (id, report_id, image_key) values (?, ?, ?)')
  image.run('img-1', 'r-pending', 'danger-reports/tester/r-pending/x.webp')
  image.run('img-2', 'r-pending', 'legacy/x.webp')
  database.sqlite.prepare(`insert into danger_report_moderation_log (id, report_id, mode, heuristic_status, final_status, prompt_version)
    values ('log-1', 'r-approved', 'live', 'approved', 'approved', 'v1')`).run()
  const route = database.sqlite.prepare(`insert into user_routes
    (id, user_id, name, start_address, start_lat, start_lng, end_address, end_lat, end_lng)
    values (?, ?, ?, '東京駅', 35.68, 139.76, '学校', 35.67, 139.76)`)
  route.run('route-a', 'tester', 'テスト通学路')
  route.run('route-keep', 'real', '学校への道')
  database.sqlite.prepare(`insert into route_learning_sessions (id, user_id, route_id, session_id, started_at)
    values ('session-1', 'tester', 'route-a', 's1', '2026-10-01T00:00:00.000Z')`).run()
}

function count(database: TestDatabase, table: string, where = '1 = 1'): number {
  return (database.sqlite.prepare(`select count(*) as n from ${table} where ${where}`).get() as { n: number }).n
}

function pointsOf(database: TestDatabase, userId: string): number {
  return (database.sqlite.prepare('select points from user_points where user_id = ?').get(userId) as { points: number }).points
}

describe('cleanup-test-data input and plan guard rails', () => {
  it('reads the find-test-data output and plain id lists', () => {
    const input = parseCleanupInput({
      kind: 'pathguardian-test-data-candidates',
      reports: [{ id: 'r-1', title: 'UIテスト', user_id: 'tester', reward_points: 20, image_keys: ['danger-reports/tester/r-1/a.webp'] }],
      routes: [{ id: 'route-1', name: 'テスト通学路' }],
      reportIds: ['r-2'],
    })
    expect(input.reportIds).toEqual(['r-1', 'r-2'])
    expect(input.routeIds).toEqual(['route-1'])
    expect(input.notes.get('r-1')).toMatchObject({ title: 'UIテスト', userId: 'tester', rewardPoints: 20 })
  })

  it.each([
    ['not an object', []],
    ['ids that are not strings', { reportIds: [1] }],
    ['entries without an id', { reports: [{ title: 'x' }] }],
  ])('rejects %s', (_label, value) => {
    expect(() => parseCleanupInput(value)).toThrow(UsageError)
  })

  it('refuses an empty input', () => {
    expect(() => buildCleanupPlan({ reportIds: [], routeIds: [] }, { bucket: BUCKET })).toThrow('空')
  })

  it(`refuses more than ${MAX_CLEANUP_IDS} ids in total but accepts exactly ${MAX_CLEANUP_IDS}`, () => {
    expect(() => buildCleanupPlan({ reportIds: ids('r', 150), routeIds: ids('u', 51) }, { bucket: BUCKET })).toThrow(String(MAX_CLEANUP_IDS))
    expect(buildCleanupPlan({ reportIds: ids('r', 150), routeIds: ids('u', 50) }, { bucket: BUCKET }).reportIds).toHaveLength(150)
  })

  it('de-duplicates ids and rejects anything that is not a plain id', () => {
    expect(buildCleanupPlan({ reportIds: ['a', ' a ', 'b'], routeIds: [] }, { bucket: BUCKET }).reportIds).toEqual(['a', 'b'])
    expect(() => buildCleanupPlan({ reportIds: ["x'); DELETE FROM profiles; --"], routeIds: [] }, { bucket: BUCKET })).toThrow(UsageError)
  })

  it('looks rows up with SELECT only and never deletes in the plan itself', () => {
    const plan = buildCleanupPlan({ reportIds: ['r-1'], routeIds: ['route-1'] }, { bucket: BUCKET })
    expect(plan.lookupOrder).toEqual(['reports', 'routes'])
    for (const statement of plan.lookupStatements) expect(statement).toMatch(/^SELECT/)
    expect(plan.lookupSql).not.toMatch(/\bDELETE\b/)
  })
})

describe('cleanup-test-data R2 key rules', () => {
  it('only deletes keys that belong to the report being deleted', () => {
    expect(isOwnedReportImageKey('danger-reports/u1/r1/a.webp', 'r1', 'u1')).toBe(true)
    expect(isOwnedReportImageKey('danger-reports/u2/r1/a.webp', 'r1', 'u1')).toBe(false)
    expect(isOwnedReportImageKey('danger-reports/u1/r2/a.webp', 'r1', 'u1')).toBe(false)
    expect(isOwnedReportImageKey('hunter-photos/u1/r1/a.webp', 'r1', 'u1')).toBe(false)
    expect(isOwnedReportImageKey('danger-reports/u1/r1/../a.webp', 'r1', 'u1')).toBe(false)
    expect(isOwnedReportImageKey('danger-reports/u1/r1/a.webp', 'r1', null)).toBe(false)
  })

  it('builds one wrangler r2 object delete per key and keeps unexpected keys', () => {
    const { deletions, skipped } = planR2Deletions([{
      id: 'r1',
      user_id: 'u1',
      image_key: 'danger-reports/u1/r1/a.webp',
      processed_image_keys: '["danger-reports/u1/r1/a.webp","legacy/a.webp"]',
      extra_image_keys: '[]',
    }], BUCKET)
    expect(deletions.map((deletion) => deletion.args)).toEqual([
      ['r2', 'object', 'delete', `${BUCKET}/danger-reports/u1/r1/a.webp`, '--remote'],
    ])
    expect(skipped.map((item) => item.key)).toEqual(['legacy/a.webp'])
  })
})

describe('cleanup-test-data against the D1 schema', () => {
  let database: TestDatabase
  beforeEach(() => {
    database = createTestDatabase()
    seed(database)
  })
  afterEach(() => database.sqlite.close())

  it('deletes exactly the found rows with cascades and reports the 20pt reward revocation', () => {
    const plan = buildCleanupPlan({ reportIds: ['r-approved', 'r-pending', 'r-missing'], routeIds: ['route-a'] }, { bucket: BUCKET })
    const lookups = plan.lookupStatements.map((statement) => ({ results: database.sqlite.prepare(statement).all() as Record<string, unknown>[] }))
    const resolved = resolveCleanup(plan, lookups)

    expect(resolved.reportIds).toEqual(['r-approved', 'r-pending'])
    expect(resolved.missingReportIds).toEqual(['r-missing'])
    expect(resolved.r2Deletions.map((deletion) => deletion.key)).toEqual([
      'danger-reports/tester/r-approved/a.webp',
      'danger-reports/tester/r-approved/b.webp',
      'danger-reports/tester/r-pending/x.webp',
    ])
    expect(resolved.skippedKeys.map((item) => item.key)).toEqual(['danger-reports/other/r-approved/c.webp', 'legacy/x.webp'])
    expect(resolved.pointImpact).toEqual([{ userId: 'tester', reports: 1, points: -20 }])

    for (const statement of resolved.deleteStatements) database.sqlite.prepare(statement).run()

    expect(count(database, 'danger_reports')).toBe(1)
    expect(count(database, 'danger_reports', "id = 'r-keep'")).toBe(1)
    expect(count(database, 'report_images')).toBe(0)
    expect(count(database, 'danger_report_moderation_log')).toBe(0)
    expect(count(database, 'user_routes')).toBe(1)
    expect(count(database, 'route_learning_sessions')).toBe(0)
    expect(pointsOf(database, 'tester')).toBe(60 - 20)
    expect(pointsOf(database, 'real')).toBe(100)
  })
})

describe('cleanup-test-data main', () => {
  let database: TestDatabase
  const input = JSON.stringify({ reportIds: ['r-approved', 'r-pending'], routeIds: ['route-a'] })
  beforeEach(() => {
    database = createTestDatabase()
    seed(database)
  })
  afterEach(() => database.sqlite.close())

  it('is a dry run by default and never calls wrangler', async () => {
    const fake = createFakeWrangler(database.sqlite)
    const deps = createTestDeps({ runner: fake.runner, files: { 'input.json': input } })

    await expect(main(['--input=input.json'], deps)).resolves.toBe(0)

    expect(fake.calls).toEqual([])
    expect(deps.lines.join('\n')).toContain('ドライラン')
    expect(deps.lines.join('\n')).toContain(BUCKET)
    expect(count(database, 'danger_reports')).toBe(3)
  })

  it('refuses --apply without the confirmation variable', async () => {
    const fake = createFakeWrangler(database.sqlite)
    const deps = createTestDeps({ runner: fake.runner, files: { 'input.json': input }, env: { [CLEANUP_CONFIRM_ENV]: 'no' } })

    await expect(main(['--input=input.json', '--apply'], deps)).resolves.toBe(1)

    expect(fake.calls).toEqual([])
    expect(count(database, 'danger_reports')).toBe(3)
  })

  it('looks up, deletes R2 images first and only then the D1 rows', async () => {
    const fake = createFakeWrangler(database.sqlite)
    const deps = createTestDeps({ runner: fake.runner, files: { 'input.json': input }, env: { [CLEANUP_CONFIRM_ENV]: 'yes' } })

    await expect(main(['--input=input.json', '--apply'], deps)).resolves.toBe(0)

    expect(fake.calls.map((call) => call[0])).toEqual(['d1', 'r2', 'r2', 'r2', 'd1'])
    expect(fake.calls[0][6]).toMatch(/^SELECT/)
    expect(fake.calls[4][6]).toMatch(/^DELETE FROM danger_reports/)
    expect(fake.r2Deleted).toEqual([
      `${BUCKET}/danger-reports/tester/r-approved/a.webp`,
      `${BUCKET}/danger-reports/tester/r-approved/b.webp`,
      `${BUCKET}/danger-reports/tester/r-pending/x.webp`,
    ])
    expect(count(database, 'danger_reports')).toBe(1)
    expect(count(database, 'user_routes')).toBe(1)
  })

  it('stops before touching D1 when an R2 delete fails', async () => {
    const fake = createFakeWrangler(database.sqlite, { failR2At: 1 })
    const deps = createTestDeps({ runner: fake.runner, files: { 'input.json': input }, env: { [CLEANUP_CONFIRM_ENV]: 'yes' } })

    await expect(main(['--input=input.json', '--apply'], deps)).resolves.toBe(1)

    expect(fake.calls.map((call) => call[0])).toEqual(['d1', 'r2', 'r2'])
    expect(count(database, 'danger_reports')).toBe(3)
    expect(count(database, 'user_routes')).toBe(2)
  })

  it('refuses empty and oversized inputs before contacting anything', async () => {
    const fake = createFakeWrangler(database.sqlite)
    const env = { [CLEANUP_CONFIRM_ENV]: 'yes' }
    const empty = createTestDeps({ runner: fake.runner, env, files: { 'input.json': '{"reportIds":[],"routeIds":[]}' } })
    const huge = createTestDeps({ runner: fake.runner, env, files: { 'input.json': JSON.stringify({ reportIds: ids('r', MAX_CLEANUP_IDS + 1) }) } })

    await expect(main(['--input=input.json', '--apply'], empty)).resolves.toBe(1)
    await expect(main(['--input=input.json', '--apply'], huge)).resolves.toBe(1)
    await expect(main(['--apply'], createTestDeps({ runner: fake.runner, env }))).resolves.toBe(1)
    expect(fake.calls).toEqual([])
  })
})
