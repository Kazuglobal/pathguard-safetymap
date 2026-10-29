// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { distanceMeters } from '@/lib/route-privacy'
import {
  buildRouteUpdate,
  main,
  MAX_STATEMENT_LENGTH,
  planRouteChange,
  ROUTE_COARSEN_CONFIRM_ENV,
} from '@/scripts/ops/coarsen-existing-routes'

import { createFakeWrangler, createTestDeps } from './ops-fake-wrangler'

const HOME: [number, number] = [139.691706, 35.689634]
const SCHOOL: [number, number] = [139.700512, 35.689634]

let database: TestDatabase

function addRoute(id: string, fields: { geometry?: unknown; startAddress?: string; start?: [number, number] }) {
  const [lng, lat] = fields.start ?? HOME
  database.sqlite.prepare(`insert into user_routes (id, user_id, name, start_lat, start_lng, end_lat, end_lng, start_address, end_address, route_geometry)
    values (?, 'user-1', '通学路', ?, ?, ?, ?, ?, '東京都新宿区西新宿3丁目', ?)`)
    .run(id, lat, lng, SCHOOL[1], SCHOOL[0], fields.startAddress ?? '〒160-0023 東京都新宿区西新宿2丁目8-1', fields.geometry === undefined ? null : JSON.stringify(fields.geometry))
}

function row(id: string) {
  const value = database.sqlite.prepare('select start_lat, start_lng, start_address, end_address, route_geometry from user_routes where id = ?').get(id) as Record<string, unknown>
  return { ...value, route_geometry: value.route_geometry ? JSON.parse(String(value.route_geometry)) : null }
}

beforeEach(() => {
  database = createTestDatabase()
  addRoute('long', { geometry: { type: 'LineString', coordinates: [HOME, SCHOOL] } })
  addRoute('short', { geometry: { type: 'LineString', coordinates: [HOME, [139.693, 35.689634]] } })
  addRoute('no-line', {})
})

afterEach(() => {
  database.sqlite.close()
})

describe('coarsen-existing-routes', () => {
  it('ドライランは件数だけを表示し、何も書き換えない(住所・座標は出さない)', async () => {
    const deps = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner })

    expect(await main([], deps)).toBe(0)

    const output = [...deps.lines, ...deps.errors].join('\n')
    expect(output).toContain('通学路 3 本のうち、変えるもの 3 本')
    expect(output).toContain('道すじの両端を削る 1 本 / 短い・壊れた道すじの保存をやめる 1 本')
    for (const secret of ['西新宿', '139.69', '35.68', 'user-1']) expect(output).not.toContain(secret)
    expect(row('long').start_address).toBe('〒160-0023 東京都新宿区西新宿2丁目8-1')
  })

  it('--apply と確認で、両端を削り・丸め・住所を市区町村までにする。流し直しても変わらない', async () => {
    const env = { [ROUTE_COARSEN_CONFIRM_ENV]: 'yes' }
    expect(await main(['--apply'], createTestDeps({ runner: createFakeWrangler(database.sqlite).runner }))).toBe(1)

    expect(await main(['--apply'], createTestDeps({ runner: createFakeWrangler(database.sqlite).runner, env }))).toBe(0)

    const long = row('long')
    expect(long).toMatchObject({ start_lat: 35.69, start_lng: 139.69, start_address: '東京都新宿区', end_address: '東京都新宿区' })
    expect(long.route_geometry.trimmedEndsMeters).toBe(200)
    // 端ごとに 200〜350m(乱数)を削る
    expect(distanceMeters(HOME, long.route_geometry.coordinates[0])).toBeGreaterThanOrEqual(199.5)
    expect(distanceMeters(HOME, long.route_geometry.coordinates[0])).toBeLessThanOrEqual(350.5)
    expect(row('short').route_geometry).toBeNull()

    const again = createTestDeps({ runner: createFakeWrangler(database.sqlite).runner, env })
    expect(await main(['--apply'], again)).toBe(0)
    expect(again.lines.join('\n')).toContain('変えるもの 0 本')
    expect(row('long').route_geometry).toEqual(long.route_geometry)
  })

  it('新しいコードで保存した線(削った印つき)は、もう一度削らない', () => {
    const trimmed = { type: 'LineString', coordinates: [[139.6939, 35.6896], [139.6983, 35.6896]], trimmedEndsMeters: 200 }
    const change = planRouteChange({
      id: 'r', userId: 'u', startLat: 35.69, startLng: 139.69, endLat: 35.69, endLng: 139.7,
      startAddress: '東京都新宿区', endAddress: '東京都新宿区', routeGeometry: trimmed,
    })
    expect(change).toBeNull()
  })

  it('長すぎる線は内側の点を縮め、それでも長ければ書き換えずに知らせる', () => {
    const many = Array.from({ length: 2_000 }, (_, index) => [139.69 + index * 0.0000123456789, 35.689634 + index * 0.0000098765432])
    const change = planRouteChange({
      id: 'r', userId: 'u', startLat: HOME[1], startLng: HOME[0], endLat: SCHOOL[1], endLng: SCHOOL[0],
      startAddress: 'x', endAddress: 'y', routeGeometry: { type: 'LineString', coordinates: many },
    })!
    const statement = buildRouteUpdate(change)
    expect(statement === null || statement.length <= MAX_STATEMENT_LENGTH).toBe(true)

    const huge = Array.from({ length: 4_900 }, (_, index) => [139.69 + index * 0.00001, 35.6 + index * 0.00001])
    const hugeChange = planRouteChange({
      id: 'r', userId: 'u', startLat: 35.6, startLng: 139.69, endLat: 35.65, endLng: 139.74,
      startAddress: 'x', endAddress: 'y', routeGeometry: { type: 'LineString', coordinates: huge },
    })!
    expect(buildRouteUpdate(hugeChange)).toBeNull()
  })
})
