// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { drizzle } from 'drizzle-orm/d1'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSchoolDistrictRepo } from '@/lib/db/repos/school-districts.repo'
import { createPushRepo } from '@/lib/db/repos/push.repo'
import * as schema from '@/lib/db/schema'
import { can } from '@/lib/db/authz'

const require = createRequire(import.meta.url)
const { Miniflare, convertV4MiniflareOptions } = require(require.resolve('miniflare', { paths: [path.dirname(require.resolve('wrangler/package.json'))] }))

describe('school district queries on actual local D1', { timeout: 30000 }, () => {
  let emulator: InstanceType<typeof Miniflare>
  let binding: Parameters<typeof drizzle>[0]
  let db: ReturnType<typeof drizzle<typeof schema>>
  const anon = { kind: 'anon' } as const
  const service = { kind: 'service' } as const
  beforeAll(async () => {
    emulator = new Miniflare(convertV4MiniflareOptions({ name: 'school-district-tests', modules: true, script: 'export default { fetch() { return new Response("ok") } }', compatibilityDate: '2026-08-22', d1Databases: ['DB'] }))
    binding = await emulator.getD1Database('DB')
    await binding.prepare('CREATE TABLE local_safety_alerts(id TEXT PRIMARY KEY, prefecture TEXT, city TEXT, category TEXT, description TEXT, source_url TEXT, occurred_at TEXT, push_notified_at TEXT, created_at TEXT)').run()
    const migration = fs.readFileSync('lib/db/migrations/20261010090000_school_district_alerts.sql', 'utf8')
    await binding.batch(migration.split(';').map(s => s.trim()).filter(Boolean).map(sql => binding.prepare(sql)))
    db = drizzle(binding, { schema })
    await db.insert(schema.schoolDistricts).values(['a', 'b'].map((id, i) => ({ id, municipalityCode: `1310${i}`, schoolCode: `B${i}`, prefecture: '東京都', city: i ? '別区' : '新宿区', name: '第一小学校', sourceUrl: 'https://nlftp.mlit.go.jp/', dataYear: 2023 })))
    await db.insert(schema.schoolDistrictBoundaries).values(['a', 'b'].map(id => ({ id: `${id}-boundary`, districtId: id, minLng: 139, minLat: 35, maxLng: 139.02, maxLat: 35.02, geometry: { type: 'Polygon' as const, coordinates: [[[139, 35], [139.02, 35], [139.02, 35.02], [139, 35.02], [139, 35]]] } })))
  }, 60000)
  afterAll(async () => { await emulator?.dispose() })
  it('lists master options even when there are no alerts and disambiguates same names', async () => {
    const repo = createSchoolDistrictRepo(db)
    expect((await repo.options(anon, '東京都')).cities).toEqual(['別区', '新宿区'])
    expect((await repo.options(anon, '東京都', '新宿区')).districts.map(d => d.id)).toEqual(['a'])
    expect(await repo.options(anon, '北海道')).toEqual({ cities: [], districts: [] })
  })
  it('filters by district BEFORE limiting the newest 50 records', async () => {
    for (let i = 0; i < 60; i++) {
      await db.insert(schema.localSafetyAlerts).values({ id: `alert-${i}`, prefecture: '東京都', city: '新宿区', category: 'suspicious', description: '事案情報', occurredAt: `2026-10-10T00:${String(i).padStart(2, '0')}:00.000Z` })
    }
    await db.insert(schema.localAlertDistricts).values({ alertId: 'alert-0', districtId: 'a' })
    const rows = await createPushRepo(db).listAlerts(anon, { since: '2026-10-09T00:00:00.000Z', schoolDistrictId: 'a', limit: 50 })
    expect(rows.map(row => row.id)).toEqual(['alert-0'])
  })
  it('matches overlap then atomically clears matches when location becomes unknown', async () => {
    const repo = createSchoolDistrictRepo(db)
    const location = { address: '新宿区1-2-3', evidence: '原文', sourceUrl: 'https://city.example.lg.jp', longitude: 139.01, latitude: 35.01, status: 'verified' }
    expect(await repo.associate(service, 'alert-0', location, '東京都')).toEqual({ status: 'verified', matched: 2 })
    expect(await repo.associate(service, 'alert-0', { ...location, longitude: null, latitude: null, status: 'missing_location' }, '東京都')).toEqual({ status: 'missing_location', matched: 0 })
    expect(await db.select().from(schema.localAlertDistricts)).toEqual([])
  })
  it('keeps coordinates and evidence private and rejects anonymous association writes', async () => {
    expect(can(anon, 'select', 'local_alert_locations')).toBe(false)
    expect(can(anon, 'select', 'school_district_boundaries')).toBe(false)
    expect(can(anon, 'select', 'school_districts')).toBe(true)
    await expect(createSchoolDistrictRepo(db).associate(anon, 'alert-0', { address: null, evidence: null, sourceUrl: null, longitude: null, latitude: null, status: 'missing_location' }, '東京都')).rejects.toThrow()
  })
})
