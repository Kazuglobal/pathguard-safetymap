import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import { createAccidentsRepo } from '@/lib/db/repos/accidents.repo'
import type { AppDb } from '@/lib/db/client'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

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
      ) values (?, ?, 13, '001', ?, ?, 2026, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    insert.run(1, 'near-fatal', 35, 139, 1, 1, 0, 1, 0, 1, '人対車両', '2026-04-01T08:00:00.000Z', '晴', '交差点')
    insert.run(2, 'near-child', 35.0005, 139.0005, 2, 0, 2, 0, 1, 2, '車両相互', '2026-05-01T15:00:00.000Z', '雨', '単路')
    insert.run(3, 'far', 35.02, 139.02, 2, 0, 1, 0, 0, null, '車両単独', '2026-06-01T12:00:00.000Z', '晴', '単路')
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
      minYear: 2026,
      maxYear: 2026,
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
      currentYear: 2026,
    })

    expect(result).toMatchObject({
      total_accidents: 2,
      total_fatalities: 1,
      total_injuries: 2,
      child_involved: 1,
      pedestrian_involved: 1,
      fatal_accidents: 1,
      by_year: { '2026': 2 },
      risk_score: 60,
      search_params: {
        latitude: 35,
        longitude: 139,
        radius_meters: 200,
        years: 5,
      },
    })
    expect(result.nearest_accidents).toHaveLength(2)
    expect(result.nearest_accidents[0]).toMatchObject({ distance_m: 0, year: 2026 })
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
