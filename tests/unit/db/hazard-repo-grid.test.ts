import type { Polygon } from 'geojson'
import { describe, expect, it, vi } from 'vitest'

import type { Actor } from '@/lib/db/authz'
import type { AppDb } from '@/lib/db/client'
import { createHazardRepo } from '@/lib/db/repos/hazard.repo'
import {
  createHazardGridReader,
  gridCellsAlongRoute,
  hazardGridKey,
  MAX_ROUTE_GRID_CELLS,
  type GridCellIndex,
  type HazardGridBucket,
  type HazardGridCoverage,
  type HazardGridZone,
} from '@/lib/hazard-grid'
import type { HazardType } from '@/lib/types'

const actor: Actor = { kind: 'user', id: 'user-1', email: 'user@example.com', isAdmin: false }

/** D1 must not be touched when the grid is bound. */
const unusedDb = new Proxy({}, {
  get() { throw new Error('D1 must not be queried when the hazard grid is bound') },
}) as unknown as AppDb

const square = (minLng: number, minLat: number, maxLng: number, maxLat: number): Polygon => ({
  type: 'Polygon',
  coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]],
})

const zone = (id: string, geometry: Polygon, overrides: Partial<HazardGridZone> = {}): HazardGridZone => ({
  id, group: 'A31b-test:[0.5,3]', source: 'A31b-test', risk: 2, depthMin: 0.5, depthMax: 3,
  context: 'riverside', geometry, ...overrides,
})

const coverage = (id: string, geometry: Polygon): HazardGridCoverage => ({
  id, source: 'A31b-test', region: '5339:0', label: '国土数値情報（国土交通省）', importedAt: '2026-11-04T00:00:00Z', geometry,
})

type CellContent = { zones?: HazardGridZone[]; coverage?: HazardGridCoverage[] }

function bucketWith(cells: Array<[HazardType, GridCellIndex, CellContent]>) {
  const objects = new Map(cells.map(([type, cell, content]) => [hazardGridKey(type, cell), JSON.stringify({
    schemaVersion: 1, hazardType: type, cellsPerDegree: 100, cell,
    zones: content.zones ?? [], coverage: content.coverage ?? [],
  })]))
  const get = vi.fn(async (key: string) => {
    const text = objects.get(key)
    return text === undefined ? null : { text: async () => text }
  })
  return { bucket: { get } satisfies HazardGridBucket, get }
}

// One zone 139.005–139.015 × 35.002–35.008, cut at the 139.01 cell edge.
const splitZone: Array<[HazardType, GridCellIndex, CellContent]> = [
  ['flood', [3500, 13900], {
    zones: [zone('mlit:a', square(139.005, 35.002, 139.01, 35.008))],
    coverage: [coverage('cov:0', square(139.005, 35.002, 139.01, 35.008))],
  }],
  ['flood', [3500, 13901], {
    zones: [zone('mlit:a', square(139.01, 35.002, 139.015, 35.008))],
    coverage: [coverage('cov:0', square(139.01, 35.002, 139.015, 35.008))],
  }],
]

describe('hazard repository with the R2 grid', () => {
  it('finds a zone from the one cell around the point without querying D1', async () => {
    const { bucket, get } = bucketWith(splitZone)
    const repo = createHazardRepo(unusedDb, createHazardGridReader(bucket))

    const hits = await repo.zonesAtPoint(actor, { longitude: 139.007, latitude: 35.005, hazardType: 'flood' })

    expect(hits).toEqual([expect.objectContaining({ id: 'mlit:a', risk_level: 2, depth_min_m: 0.5, depth_max_m: 3 })])
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('hazard-grid/v1/flood/3500/13900.json')
  })

  it('returns a zone cut at a cell edge once when the point is on that edge', async () => {
    const repo = createHazardRepo(unusedDb, createHazardGridReader(bucketWith(splitZone).bucket))

    const hits = await repo.zonesAtPoint(actor, { longitude: 139.01, latitude: 35.005, hazardType: 'flood' })

    expect(hits.map((hit) => hit.id)).toEqual(['mlit:a'])
  })

  it('reads the neighbouring cell when the tolerance reaches across the edge', async () => {
    const neighbourOnly: Array<[HazardType, GridCellIndex, CellContent]> = [
      ['flood', [3500, 13901], { zones: [zone('mlit:b', square(139.0101, 35.004, 139.012, 35.006))] }],
    ]
    const repo = createHazardRepo(unusedDb, createHazardGridReader(bucketWith(neighbourOnly).bucket))

    const exact = await repo.zonesAtPoint(actor, { longitude: 139.0099, latitude: 35.005, hazardType: 'flood' })
    const near = await repo.zonesAtPoint(actor, {
      longitude: 139.0099, latitude: 35.005, hazardType: 'flood', toleranceMeters: 30,
    })

    expect(exact).toEqual([])
    expect(near.map((hit) => hit.id)).toEqual(['mlit:b'])
  })

  it('separates covered, unpublished and unreadable cells', async () => {
    const { bucket, get } = bucketWith(splitZone)
    const repo = createHazardRepo(unusedDb, createHazardGridReader(bucket))

    await expect(repo.coverageAtPoint(actor, { longitude: 139.012, latitude: 35.005, hazardType: 'flood' }))
      .resolves.toEqual([{ sourceLayer: 'A31b-test', region: '5339:0', source: '国土数値情報（国土交通省）', importedAt: '2026-11-04T00:00:00Z' }])
    await expect(repo.hasCoverageAtPoint(actor, { longitude: 141.5, latitude: 38.5, hazardType: 'flood' }))
      .resolves.toBe(false)

    get.mockRejectedValueOnce(new Error('R2 unavailable'))
    await expect(repo.hasCoverageAtPoint(actor, { longitude: 140.5, latitude: 37.5, hazardType: 'tsunami' }))
      .rejects.toThrow('R2 unavailable')
  })

  it('rejects an object stored under the wrong cell', async () => {
    const wrongCell = JSON.stringify({ schemaVersion: 1, hazardType: 'flood', cellsPerDegree: 100, cell: [1, 2], zones: [], coverage: [] })
    const bucket: HazardGridBucket = { get: async () => ({ text: async () => wrongCell }) }
    const repo = createHazardRepo(unusedDb, createHazardGridReader(bucket))

    await expect(repo.zonesAtPoint(actor, { longitude: 139.007, latitude: 35.005, hazardType: 'flood' }))
      .rejects.toThrow('does not match')
  })

  it('keeps one route marker per official zone across cells and separate zones apart', async () => {
    const cells: Array<[HazardType, GridCellIndex, CellContent]> = [
      ...splitZone,
      ['tsunami', [3500, 13902], {
        zones: [zone('mlit:t', square(139.021, 35.004, 139.025, 35.006), {
          source: 'A40-test', group: 'A40-test:[3,5]', risk: 3, depthMin: 3, depthMax: 5, context: 'coastal',
        })],
      }],
    ]
    const repo = createHazardRepo(unusedDb, createHazardGridReader(bucketWith(cells).bucket))

    const result = await repo.routeIntersections(actor, {
      type: 'LineString', coordinates: [[139.001, 35.005], [139.028, 35.005]],
    })

    expect(result.truncated).toBe(false)
    expect(result.markers.map((marker) => [marker.id, marker.hazard_type])).toEqual([
      ['mlit:t', 'tsunami'],
      ['mlit:a', 'flood'],
    ])
  })

  it('marks long routes as truncated instead of reading every cell', async () => {
    const { bucket, get } = bucketWith([])
    const repo = createHazardRepo(unusedDb, createHazardGridReader(bucket))

    const result = await repo.routeIntersections(actor, {
      type: 'LineString', coordinates: [[139, 35.005], [140.5, 35.005]],
    })

    expect(result.truncated).toBe(true)
    expect(get).toHaveBeenCalledTimes(MAX_ROUTE_GRID_CELLS * 2)
  })
})

describe('hazard grid reader', () => {
  it('serves repeated reads from the cache until the entry expires', async () => {
    const { bucket, get } = bucketWith(splitZone)
    let now = 0
    const reader = createHazardGridReader(bucket, () => now)

    await reader.readCell('flood', [3500, 13900])
    await reader.readCell('flood', [3500, 13900])
    expect(get).toHaveBeenCalledTimes(1)

    now = 11 * 60 * 1000
    await reader.readCell('flood', [3500, 13900])
    expect(get).toHaveBeenCalledTimes(2)
  })

  it('lists only the cells a diagonal route passes through', () => {
    const cells = gridCellsAlongRoute({ type: 'LineString', coordinates: [[139.001, 35.001], [139.039, 35.039]] })

    expect(cells[0]).toEqual([3500, 13900])
    expect(cells.at(-1)).toEqual([3503, 13903])
    expect(cells).not.toContainEqual([3500, 13903])
    expect(cells).not.toContainEqual([3503, 13900])
  })
})
