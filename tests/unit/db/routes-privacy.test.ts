// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createRoutesRepo } from '@/lib/db/repos/routes.repo'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { distanceMeters } from '@/lib/route-privacy'

const owner: Actor = { kind: 'user', id: 'user-1', email: 'owner@example.com', isAdmin: false }

let database: TestDatabase

beforeEach(() => {
  database = createTestDatabase()
})

afterEach(() => {
  database.sqlite.close()
})

function stored(id: string) {
  const row = database.sqlite.prepare('select start_lat, start_lng, end_lat, end_lng, start_address, end_address, route_geometry from user_routes where id = ?').get(id) as Record<string, unknown>
  return { ...row, route_geometry: row.route_geometry ? JSON.parse(String(row.route_geometry)) : null }
}

const HOME: [number, number] = [139.691706, 35.689634]
const SCHOOL: [number, number] = [139.700512, 35.689634]

describe('通学路はサーバーに粗くして保存する(UIUX改装 項目59)', () => {
  it('両端200mの道すじ・起点と終点の細かい座標・番地まで含む住所を保存しない', async () => {
    const route = await createRoutesRepo(database.db as unknown as AppDb).create(owner, {
      name: '登校ルート',
      startLat: HOME[1], startLng: HOME[0], endLat: SCHOOL[1], endLng: SCHOOL[0],
      startAddress: '〒160-0023 東京都新宿区西新宿2丁目8-1', endAddress: '35.6896, 139.7005',
      routeGeometry: { type: 'LineString', coordinates: [HOME, SCHOOL] },
    })

    const row = stored(route.id)
    expect(row).toMatchObject({
      start_lat: 35.69, start_lng: 139.69, end_lat: 35.69, end_lng: 139.7,
      start_address: '東京都新宿区', end_address: '到着地',
    })
    const [first, last] = [row.route_geometry.coordinates[0], row.route_geometry.coordinates.at(-1)]
    // 端ごとに 200〜350m(乱数)を削る
    for (const distance of [distanceMeters(HOME, first), distanceMeters(SCHOOL, last)]) {
      expect(distance).toBeGreaterThanOrEqual(199.5)
      expect(distance).toBeLessThanOrEqual(350.5)
    }
    expect(JSON.stringify(row)).not.toContain('8-1')
  })

  it('「粗く保存」の人の通学路は、道すじを保存しない', async () => {
    database.sqlite.prepare("insert into profiles (id, email, location_precision) values ('user-1', 'owner@example.com', 'coarse')").run()
    const route = await createRoutesRepo(database.db as unknown as AppDb).create(owner, {
      name: '登校ルート', startLat: HOME[1], startLng: HOME[0], endLat: SCHOOL[1], endLng: SCHOOL[0],
      startAddress: '東京都新宿区西新宿2丁目8-1', endAddress: '東京都新宿区西新宿3丁目',
      routeGeometry: { type: 'LineString', coordinates: [HOME, SCHOOL] },
    })

    expect(stored(route.id)).toMatchObject({ start_lat: 35.7, start_lng: 139.7, end_lat: 35.7, end_lng: 139.7, route_geometry: null })
  })

  it('保存してある線をそのまま送り直されても、もう一度は削らない(削るたびに短くならない)', async () => {
    const repo = createRoutesRepo(database.db as unknown as AppDb)
    const route = await repo.create(owner, {
      name: '登校ルート', startLat: HOME[1], startLng: HOME[0], endLat: SCHOOL[1], endLng: SCHOOL[0],
      startAddress: '東京都新宿区', endAddress: '東京都新宿区',
      routeGeometry: { type: 'LineString', coordinates: [HOME, SCHOOL] },
    })
    const saved = stored(route.id).route_geometry

    await repo.update(owner, route.id, { name: '名前だけ変えた', routeGeometry: saved })

    expect(stored(route.id).route_geometry).toEqual(saved)
  })

  it('道すじを書き換えるときも同じように粗くする(書き換えない項目はそのまま)', async () => {
    const repo = createRoutesRepo(database.db as unknown as AppDb)
    const route = await repo.create(owner, {
      name: '登校ルート', startLat: 35.69, startLng: 139.69, endLat: 35.69, endLng: 139.7,
      startAddress: '東京都新宿区', endAddress: '東京都新宿区',
    })

    await repo.update(owner, route.id, { endAddress: '東京都渋谷区神南1丁目', routeGeometry: { type: 'LineString', coordinates: [HOME, SCHOOL] } })

    const row = stored(route.id)
    expect(row.end_address).toBe('東京都渋谷区')
    expect(row.start_address).toBe('東京都新宿区')
    expect(distanceMeters(HOME, row.route_geometry.coordinates[0])).toBeGreaterThanOrEqual(199.5)
  })
})
