import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import { createAccidentsRepo } from '@/lib/db/repos/accidents.repo'
import type { AppDb } from '@/lib/db/client'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { HOTSPOT_DATASET_VERSION } from '@/lib/traffic-accident/hotspot-config'

const actor: Actor = {
  kind: 'user',
  id: 'user-1',
  email: 'user@example.com',
  isAdmin: false,
}

describe('accidents repository', () => {
  let database: TestDatabase

  beforeEach(() => {
    database = createTestDatabase()
    const insert = database.sqlite.prepare(`
      insert into traffic_accidents (
        id, record_number, prefecture_code, police_station_code,
        lat, lng, source_year, severity_code, fatalities, injuries,
        involves_child, involves_pedestrian, party_a_age,
        accident_type_label, occurred_at, weather_label, road_shape_label
      ) values (?, ?, 13, '001', ?, ?, 2025, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insert.run(1, 'near-fatal', 35, 139, 1, 1, 0, 1, 0, 1, '人対車両', '2025-04-01T08:00:00.000Z', '晴', '交差点')
    insert.run(2, 'near-child', 35.0005, 139.0005, 2, 0, 2, 0, 1, 2, '車両相互', '2025-05-01T15:00:00.000Z', '雨', '単路')
    insert.run(3, 'far', 35.02, 139.02, 2, 0, 1, 0, 0, null, '車両単独', '2025-06-01T12:00:00.000Z', '晴', '単路')
  })

  afterEach(() => {
    database.sqlite.close()
  })

  it('returns the legacy GeoJSON contract with D1 bbox filters', async () => {
    const repo = createAccidentsRepo(database.db as unknown as AppDb)

    const result = await repo.accidentsInBbox(actor, {
      minLng: 138.99,
      minLat: 34.99,
      maxLng: 139.01,
      maxLat: 35.01,
      minYear: 2025,
      maxYear: 2025,
      severity: 'fatal',
      young: true,
      limit: 10_000,
    })

    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(1)
    expect(result.features[0]).toMatchObject({
      geometry: { type: 'Point', coordinates: [139, 35] },
      properties: {
        id: 1,
        severity: 1,
        hasYoung: true,
        hasPedestrian: false,
      },
    })
  })

  it('uses a bbox prefilter and haversine distance before aggregating nearby stats', async () => {
    const repo = createAccidentsRepo(database.db as unknown as AppDb)

    const result = await repo.nearbyStats(actor, {
      latitude: 35,
      longitude: 139,
      radiusMeters: 200,
      years: 5,
    })

    expect(result).toMatchObject({
      total_accidents: 2,
      total_fatalities: 1,
      total_injuries: 2,
      child_involved: 1,
      pedestrian_involved: 1,
      fatal_accidents: 1,
      by_year: { '2025': 2 },
      risk_score: 60,
      search_params: {
        latitude: 35,
        longitude: 139,
        radius_meters: 200,
        years: 5,
      },
    })
    expect(result.nearest_accidents).toHaveLength(2)
    expect(result.nearest_accidents[0]).toMatchObject({ distance_m: 0, year: 2025 })
  })

  it('reads +09:00 times (2025 import) in Japan time but keeps legacy UTC rows as before', async () => {
    const insert = database.sqlite.prepare(`
      insert into traffic_accidents (id, record_number, prefecture_code, police_station_code, lat, lng, source_year, occurred_at)
      values (?, ?, 13, '001', 36.5, 140.5, 2025, ?)
    `)
    insert.run(30, 'jst-morning', '2025-01-01T07:30:00+09:00')
    insert.run(31, 'legacy-morning', '2024-06-01T07:30:00.000Z')
    const repo = createAccidentsRepo(database.db as unknown as AppDb)

    const result = await repo.nearbyStats(actor, { latitude: 36.5, longitude: 140.5, radiusMeters: 50, years: 5 })

    expect(result.by_time_of_day).toEqual({ '07-09_morning_commute': 2 })
    expect(result.time_analysis.by_hour).toEqual({ '7': 2 })
    expect(result.time_analysis.by_month).toEqual({ '1': 1, '6': 1 })
  })

  it('labels the real number of data years when more years are requested than exist', async () => {
    const repo = createAccidentsRepo(database.db as unknown as AppDb)

    const result = await repo.nearbyStats(actor, { latitude: 35, longitude: 139, radiusMeters: 200, years: 10 })

    expect(result.search_params).toMatchObject({ years: 7, min_year: 2019, max_year: 2025 })
    expect(result.situation_summary.total_text).toBe('2件の事故が過去7年間（2019〜2025年）に半径200m以内で発生')
  })

  it('attaches hotspots within the radius to the nearby stats', async () => {
    database.sqlite.prepare(`
      insert into accident_hotspots (
        id, dataset_version, lat, lng, radius_meters, min_year, max_year, accident_count, fatal_count,
        pedestrian_count, young_count, by_year_json, by_class_json, peak_hour, prefecture_code,
        municipality_code, national_rank
      ) values (1, ?, 35.0001, 139, 30, 2021, 2025, 7, 0, 2, 1, '{}', '{"人対車両":2,"車両相互":5}', 8, 30, '101', 40)
    `).run(HOTSPOT_DATASET_VERSION)
    const repo = createAccidentsRepo(database.db as unknown as AppDb)

    const result = await repo.nearbyStats(actor, { latitude: 35, longitude: 139, radiusMeters: 200, years: 5 })

    expect(result.hotspots).toHaveLength(1)
    expect(result.hotspot_count).toBe(1)
    expect(result.hotspots?.[0]).toMatchObject({ accidentCount: 7, distanceMeters: 11, nationalRank: 40 })
  })

  it('still returns the stats when the hotspot table is unavailable', async () => {
    database.sqlite.exec('drop table accident_hotspots')
    const repo = createAccidentsRepo(database.db as unknown as AppDb)

    const result = await repo.nearbyStats(actor, { latitude: 35, longitude: 139, radiusMeters: 200, years: 5 })

    expect(result.total_accidents).toBe(2)
    expect(result.hotspots).toEqual([])
    expect(result.hotspot_count).toBe(0)
  })

  it('counts "past N years" back from the latest data year, not the calendar year', async () => {
    const insert = database.sqlite.prepare(`
      insert into traffic_accidents (id, record_number, prefecture_code, police_station_code, lat, lng, source_year)
      values (?, ?, 13, '001', 35, 139, ?)
    `)
    insert.run(20, 'edge-2021', 2021)
    insert.run(21, 'outside-2020', 2020)
    const repo = createAccidentsRepo(database.db as unknown as AppDb)

    const result = await repo.nearbyStats(actor, { latitude: 35, longitude: 139, radiusMeters: 200, years: 5 })

    expect(result.by_year).toEqual({ '2021': 1, '2025': 2 })
    expect(result.search_params).toMatchObject({ years: 5, min_year: 2021, max_year: 2025 })
    expect(result.situation_summary.total_text).toBe('3件の事故が過去5年間（2021〜2025年）に半径200m以内で発生')
  })

  describe('with rows shaped like the production import (detail labels on major-class codes)', () => {
    beforeEach(() => {
      const insert = database.sqlite.prepare(`
        insert into traffic_accidents (
          id, record_number, prefecture_code, police_station_code, lat, lng, source_year,
          severity_code, fatalities, injuries, involves_child, involves_pedestrian,
          accident_type_code, accident_type_label
        ) values (?, ?, 13, '001', 36, 140, 2025, 2, 0, 1, 0, 0, ?, ?)
      `)
      insert.run(10, 'prod-vehicles', '21', '車両相互_正面衝突')
      insert.run(11, 'prod-pedestrian', '01', '人対車両_横断中')
      insert.run(12, 'prod-unknown-code', null, null)
    })

    it('aggregates by the major class derived from the code and counts 人対車両 as pedestrian', async () => {
      const repo = createAccidentsRepo(database.db as unknown as AppDb)

      const result = await repo.nearbyStats(actor, {
        latitude: 36,
        longitude: 140,
        radiusMeters: 100,
        years: 5,
      })

      expect(result.total_accidents).toBe(3)
      expect(result.by_accident_type).toMatchObject({ 車両相互: 1, 人対車両: 1 })
      expect(result.pedestrian_involved).toBe(1)
      expect(result.nearest_accidents.map((item) => item.type).filter(Boolean).sort()).toEqual(['人対車両', '車両相互'])
    })

    it('returns normalized labels on the map and includes 人対車両 in the pedestrian filter', async () => {
      const repo = createAccidentsRepo(database.db as unknown as AppDb)
      const bbox = { minLng: 139.99, minLat: 35.99, maxLng: 140.01, maxLat: 36.01, minYear: 2025, maxYear: 2025 }

      const all = await repo.accidentsInBbox(actor, bbox)
      const byId = Object.fromEntries(all.features.map((feature) => [feature.properties.id, feature.properties]))
      expect(byId[10]).toMatchObject({ type: '車両相互', hasPedestrian: false })
      expect(byId[11]).toMatchObject({ type: '人対車両', hasPedestrian: true })

      const pedestrian = await repo.accidentsInBbox(actor, { ...bbox, pedestrian: true })
      expect(pedestrian.features.map((feature) => feature.properties.id)).toEqual([11])

      const notPedestrian = await repo.accidentsInBbox(actor, { ...bbox, pedestrian: false })
      expect(notPedestrian.features.map((feature) => feature.properties.id).sort()).toEqual([10, 12])
    })
  })

  it('rejects unbounded nearby scans', async () => {
    const repo = createAccidentsRepo(database.db as unknown as AppDb)

    await expect(repo.nearbyStats(actor, {
      latitude: 35,
      longitude: 139,
      radiusMeters: 1001,
      years: 5,
    })).rejects.toThrow('radiusMeters')
  })
})
