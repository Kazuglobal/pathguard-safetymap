import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createHazardRepo } from '@/lib/db/repos/hazard.repo'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

const actor: Actor = {
  kind: 'user',
  id: 'user-1',
  email: 'user@example.com',
  isAdmin: false,
}

const square = (minLng: number, minLat: number, maxLng: number, maxLat: number) => ({
  type: 'Polygon' as const,
  coordinates: [[
    [minLng, minLat],
    [maxLng, minLat],
    [maxLng, maxLat],
    [minLng, maxLat],
    [minLng, minLat],
  ]],
})

describe('hazard repository spatial replacements', () => {
  let database: TestDatabase

  beforeEach(() => {
    database = createTestDatabase()
    const zone = database.sqlite.prepare(`
      insert into hazard_zones (
        id, zone_group_id, hazard_type, source_layer, risk_level,
        depth_min_m, depth_max_m, area_context, properties, geojson,
        bbox_min_lng, bbox_min_lat, bbox_max_lng, bbox_max_lat
      ) values (?, ?, ?, 'mlit', ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?)
    `)
    zone.run('zone-a-1', 'zone-a', 'flood', 4, 1, 2, 'riverside', JSON.stringify(square(139, 35, 139.01, 35.01)), 139, 35, 139.01, 35.01)
    zone.run('zone-a-2', 'zone-a', 'flood', 4, 1, 2, 'riverside', JSON.stringify(square(139.01, 35, 139.02, 35.01)), 139.01, 35, 139.02, 35.01)
    zone.run('zone-b', 'zone-b', 'tsunami', 5, 3, 5, 'coastal', JSON.stringify(square(140, 36, 140.01, 36.01)), 140, 36, 140.01, 36.01)

    database.sqlite.prepare(`
      insert into hazard_zone_coverage (
        id, coverage_group_id, hazard_type, region_label, source, source_layer,
        geojson, bbox_min_lng, bbox_min_lat, bbox_max_lng, bbox_max_lat,
        imported_features, imported_at
      ) values ('coverage-1', 'coverage-group', 'flood', 'Tokyo', 'mlit', 'mlit', ?, 138.9, 34.9, 139.2, 35.2, 2, '2026-08-22T00:00:00Z')
    `).run(JSON.stringify(square(138.9, 34.9, 139.2, 35.2)))
  })

  afterEach(() => database.sqlite.close())

  it('uses bbox prefilter plus exact/tolerance point checks', async () => {
    const repo = createHazardRepo(database.db as unknown as AppDb)

    const inside = await repo.zonesAtPoint(actor, {
      longitude: 139.005,
      latitude: 35.005,
      hazardType: 'flood',
    })
    const nearBoundary = await repo.zonesAtPoint(actor, {
      longitude: 139.0102,
      latitude: 35.005,
      hazardType: 'flood',
      toleranceMeters: 30,
    })

    expect(inside).toHaveLength(1)
    expect(inside[0]).toMatchObject({ id: 'zone-a-1', hazard_type: 'flood', risk_level: 4 })
    expect(nearBoundary.map((zone) => zone.id)).toContain('zone-a-1')
  })

  it('distinguishes covered points from missing hazard coverage', async () => {
    const repo = createHazardRepo(database.db as unknown as AppDb)

    await expect(repo.hasCoverageAtPoint(actor, {
      longitude: 139.05,
      latitude: 35.05,
      hazardType: 'flood',
    })).resolves.toBe(true)
    await expect(repo.hasCoverageAtPoint(actor, {
      longitude: 141,
      latitude: 35,
      hazardType: 'flood',
    })).resolves.toBe(false)
  })

  it('deduplicates split polygons by zone group for route markers', async () => {
    const repo = createHazardRepo(database.db as unknown as AppDb)

    const result = await repo.routeIntersections(actor, {
      type: 'LineString',
      coordinates: [[138.99, 35.005], [139.03, 35.005]],
    })

    expect(result.truncated).toBe(false)
    expect(result.markers).toHaveLength(1)
    expect(result.markers[0]).toMatchObject({
      id: 'zone-a',
      hazard_type: 'flood',
      risk_level: 4,
      depth_label: '1.0m〜2.0m',
      area_label: '河川沿い',
      scenario_key: 'standard-riverside',
    })
    expect(result.markers[0].longitude).toBeGreaterThanOrEqual(139)
    expect(result.markers[0].latitude).toBeCloseTo(35.005, 5)
  })
})
