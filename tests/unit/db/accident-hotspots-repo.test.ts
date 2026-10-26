import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import {
  createAccidentHotspotsRepo,
  distanceToLineMeters,
  distanceToSegmentMeters,
} from '@/lib/db/repos/accident-hotspots.repo'
import type { AppDb } from '@/lib/db/client'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { HOTSPOT_DATASET_VERSION } from '@/lib/traffic-accident/hotspot-config'

const user: Actor = { kind: 'user', id: 'user-1', email: 'user@example.com', isAdmin: false }
const anon: Actor = { kind: 'anon' }
const METERS_PER_DEGREE_LAT = 110_574

describe('accident hotspots repository', () => {
  let database: TestDatabase

  beforeEach(() => {
    database = createTestDatabase()
    const insert = database.sqlite.prepare(`
      insert into accident_hotspots (
        id, dataset_version, lat, lng, radius_meters, min_year, max_year, accident_count, fatal_count,
        pedestrian_count, young_count, by_year_json, by_class_json, peak_hour, prefecture_code,
        municipality_code, national_rank
      ) values (?, ?, ?, ?, 30, 2021, 2025, ?, 0, 1, 2, ?, ?, 8, 30, '112', ?)
    `)
    insert.run(1, HOTSPOT_DATASET_VERSION, 35.0, 139.0, 12, '{"2021":2,"2025":10}', '{"車両相互":9,"人対車両":3}', 5)
    insert.run(2, HOTSPOT_DATASET_VERSION, 35.0 + 100 / METERS_PER_DEGREE_LAT, 139.0, 6, '{}', 'broken', 900)
    insert.run(3, HOTSPOT_DATASET_VERSION, 35.1, 139.1, 20, '{}', '{}', 2)
    insert.run(4, 'old-version', 35.0, 139.0, 99, '{}', '{}', 1)
  })

  afterEach(() => {
    database.sqlite.close()
  })

  const repo = () => createAccidentHotspotsRepo(database.db as unknown as AppDb)

  it('returns hotspots in the bbox, busiest first, only from the current dataset version', async () => {
    const result = await repo().hotspotsInBbox(user, { minLng: 138.99, minLat: 34.99, maxLng: 139.01, maxLat: 35.01 })
    expect(result.truncated).toBe(false)
    expect(result.hotspots.map((spot) => spot.id)).toEqual([1, 2])
    expect(result.hotspots[0]).toMatchObject({
      accidentCount: 12,
      byYear: { '2021': 2, '2025': 10 },
      byClass: { 車両相互: 9, 人対車両: 3 },
      minYear: 2021,
      maxYear: 2025,
      nationalRank: 5,
      distanceMeters: null,
    })
    expect(result.hotspots[1].byClass).toEqual({})
  })

  it('reports truncation when the bbox holds more than the limit', async () => {
    const result = await repo().hotspotsInBbox(user, { minLng: 138, minLat: 34, maxLng: 140, maxLat: 36, limit: 2 })
    expect(result.hotspots.map((spot) => spot.id)).toEqual([3, 1])
    expect(result.truncated).toBe(true)
  })

  it('finds hotspots within a radius and returns the distance', async () => {
    const near = await repo().hotspotsNearPoint(user, { latitude: 35, longitude: 139, radiusMeters: 300 })
    expect(near.hotspots.map((spot) => [spot.id, spot.distanceMeters])).toEqual([[1, 0], [2, 100]])
    expect(near.total).toBe(2)
    const tight = await repo().hotspotsNearPoint(user, { latitude: 35, longitude: 139, radiusMeters: 50 })
    expect(tight.hotspots.map((spot) => spot.id)).toEqual([1])
  })

  it('reports the full count when only the top hotspots are returned', async () => {
    const near = await repo().hotspotsNearPoint(user, { latitude: 35, longitude: 139, radiusMeters: 300, limit: 1 })
    expect(near.hotspots.map((spot) => spot.id)).toEqual([1])
    expect(near.total).toBe(2)
  })

  it('finds hotspots along a route within the buffer', async () => {
    // 東西に走る経路。地点1は線上、地点2は100m北なので対象外
    const result = await repo().hotspotsAlongRoute(user, [[138.999, 35.0], [139.001, 35.0]])
    expect(result.hotspots.map((spot) => spot.id)).toEqual([1])
    expect(result.hotspots[0].distanceMeters).toBe(0)
  })

  it('rejects anonymous access and malformed input', async () => {
    await expect(repo().hotspotsInBbox(anon, { minLng: 138, minLat: 34, maxLng: 140, maxLat: 36 })).rejects.toThrow()
    await expect(repo().hotspotsInBbox(user, { minLng: 140, minLat: 34, maxLng: 138, maxLat: 36 })).rejects.toThrow(RangeError)
    await expect(repo().hotspotsAlongRoute(user, [])).rejects.toThrow(RangeError)
    await expect(repo().hotspotsAlongRoute(user, [['x', 35]])).rejects.toThrow(RangeError)
    await expect(repo().hotspotsNearPoint(user, { latitude: 35, longitude: 139, radiusMeters: 5000 })).rejects.toThrow(RangeError)
  })
})

describe('distance to route', () => {
  const origin = { lat: 35, lng: 139 }
  const north = (meters: number) => ({ lat: 35 + meters / METERS_PER_DEGREE_LAT, lng: 139 })

  it('measures the perpendicular distance to a segment', () => {
    const start = { lat: 35, lng: 138.999 }
    const end = { lat: 35, lng: 139.001 }
    expect(distanceToSegmentMeters(north(40), start, end)).toBeCloseTo(40, 0)
    expect(distanceToSegmentMeters(origin, start, start)).toBeGreaterThan(90)
  })

  it('takes the nearest segment of a polyline', () => {
    const line = [{ lat: 35, lng: 139.002 }, north(-100), north(100)]
    expect(distanceToLineMeters(origin, line)).toBeLessThan(1)
    expect(distanceToLineMeters(origin, [north(30)])).toBeCloseTo(30, 0)
  })
})
