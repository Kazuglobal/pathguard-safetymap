import type { LineString, Polygon } from 'geojson'

import type { HazardType } from '@/lib/types'

/**
 * Official inundation polygons cut at fixed 0.01° cells and stored in R2, one
 * object per hazard type and cell (scripts/migrate/build-hazard-grid.py).
 * A point lookup reads the one cell around it instead of scanning every D1 row
 * west of the point (#277). A missing object means no data was published for
 * that cell; it is never read as "outside the hazard area" by itself.
 */
export const HAZARD_GRID_CELLS_PER_DEGREE = 100
export const HAZARD_GRID_SCHEMA_VERSION = 1
export const HAZARD_GRID_KEY_PREFIX = `hazard-grid/v${HAZARD_GRID_SCHEMA_VERSION}`
export const MAX_ROUTE_GRID_CELLS = 120

const EDGE_EPSILON_DEGREES = 1e-9
const CACHE_MAX_ENTRIES = 48
const CACHE_MAX_CHARS = 24_000_000
const CACHE_TTL_MS = 10 * 60 * 1000

export interface HazardGridObject {
  text(): Promise<string>
}

export interface HazardGridBucket {
  get(key: string): Promise<HazardGridObject | null>
}

export interface HazardGridZone {
  id: string
  group: string
  source: string
  risk: number
  depthMin: number | null
  depthMax: number | null
  context: string
  geometry: Polygon
}

export interface HazardGridCoverage {
  id: string
  source: string
  region: string
  label: string
  importedAt: string
  geometry: Polygon
}

export interface HazardGridCell {
  zones: HazardGridZone[]
  coverage: HazardGridCoverage[]
}

export interface HazardGridBounds {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

export type GridCellIndex = readonly [latitudeIndex: number, longitudeIndex: number]

const EMPTY_CELL: HazardGridCell = Object.freeze({ zones: [], coverage: [] }) as HazardGridCell

export function hazardGridKey(hazardType: HazardType, cell: GridCellIndex): string {
  return `${HAZARD_GRID_KEY_PREFIX}/${hazardType}/${cell[0]}/${cell[1]}.json`
}

function cellIndex(value: number): number {
  return Math.floor(value * HAZARD_GRID_CELLS_PER_DEGREE)
}

/** Cells overlapping the bounds, widened slightly so edge points read both sides. */
export function gridCellsForBounds(bounds: HazardGridBounds): GridCellIndex[] {
  const cells: GridCellIndex[] = []
  for (let y = cellIndex(bounds.minLat - EDGE_EPSILON_DEGREES); y <= cellIndex(bounds.maxLat + EDGE_EPSILON_DEGREES); y += 1) {
    for (let x = cellIndex(bounds.minLng - EDGE_EPSILON_DEGREES); x <= cellIndex(bounds.maxLng + EDGE_EPSILON_DEGREES); x += 1) {
      cells.push([y, x])
    }
  }
  return cells
}

/** Cells a route passes through, in route order, without the empty bbox corners. */
export function gridCellsAlongRoute(route: LineString): GridCellIndex[] {
  const step = 1 / (HAZARD_GRID_CELLS_PER_DEGREE * 4)
  const seen = new Set<string>()
  const cells: GridCellIndex[] = []
  const add = (bounds: HazardGridBounds) => {
    for (const cell of gridCellsForBounds(bounds)) {
      const key = `${cell[0]}:${cell[1]}`
      if (seen.has(key)) continue
      seen.add(key)
      cells.push(cell)
    }
  }
  for (let index = 1; index < route.coordinates.length; index += 1) {
    const [startLng, startLat] = route.coordinates[index - 1]
    const [endLng, endLat] = route.coordinates[index]
    const pieces = Math.max(1, Math.ceil(Math.max(Math.abs(endLng - startLng), Math.abs(endLat - startLat)) / step))
    for (let piece = 0; piece < pieces; piece += 1) {
      const a = piece / pieces
      const b = (piece + 1) / pieces
      const lngA = startLng + (endLng - startLng) * a
      const lngB = startLng + (endLng - startLng) * b
      const latA = startLat + (endLat - startLat) * a
      const latB = startLat + (endLat - startLat) * b
      add({
        minLng: Math.min(lngA, lngB), maxLng: Math.max(lngA, lngB),
        minLat: Math.min(latA, latB), maxLat: Math.max(latA, latB),
      })
    }
  }
  return cells
}

function isPolygon(value: unknown): value is Polygon {
  const polygon = value as Polygon | null
  return polygon?.type === 'Polygon' && Array.isArray(polygon.coordinates) && polygon.coordinates.length > 0
}

function parseCell(text: string, hazardType: HazardType, cell: GridCellIndex): HazardGridCell {
  const body = JSON.parse(text) as Record<string, unknown>
  const [y, x] = Array.isArray(body.cell) ? body.cell : []
  if (body.schemaVersion !== HAZARD_GRID_SCHEMA_VERSION
    || body.hazardType !== hazardType
    || body.cellsPerDegree !== HAZARD_GRID_CELLS_PER_DEGREE
    || y !== cell[0] || x !== cell[1]
    || !Array.isArray(body.zones) || !Array.isArray(body.coverage)) {
    throw new Error('hazard grid object does not match the requested cell')
  }
  const zones = body.zones as HazardGridZone[]
  const coverage = body.coverage as HazardGridCoverage[]
  if (!zones.every((zone) => typeof zone.id === 'string' && isPolygon(zone.geometry))
    || !coverage.every((row) => typeof row.source === 'string' && isPolygon(row.geometry))) {
    throw new Error('hazard grid object contains an invalid record')
  }
  return { zones, coverage }
}

interface CacheEntry {
  cell: HazardGridCell
  chars: number
  expiresAt: number
}

export interface HazardGridReader {
  readCell(hazardType: HazardType, cell: GridCellIndex): Promise<HazardGridCell>
}

/**
 * Reads cells with a small per-isolate LRU cache. AR re-checks the same spot
 * every few seconds; the cache keeps those repeats off R2. Read failures throw
 * so callers report "unavailable" rather than "no coverage".
 */
export function createHazardGridReader(bucket: HazardGridBucket, now: () => number = Date.now): HazardGridReader {
  const cache = new Map<string, CacheEntry>()
  let cachedChars = 0

  const remember = (key: string, entry: CacheEntry) => {
    cache.set(key, entry)
    cachedChars += entry.chars
    for (const [oldest, old] of cache) {
      if (cache.size <= CACHE_MAX_ENTRIES && cachedChars <= CACHE_MAX_CHARS) break
      cache.delete(oldest)
      cachedChars -= old.chars
    }
  }

  return {
    async readCell(hazardType, cell) {
      const key = hazardGridKey(hazardType, cell)
      const cached = cache.get(key)
      if (cached) {
        cache.delete(key)
        cachedChars -= cached.chars
        if (cached.expiresAt > now()) {
          remember(key, cached)
          return cached.cell
        }
      }
      const object = await bucket.get(key)
      const text = object ? await object.text() : ''
      const parsed = object ? parseCell(text, hazardType, cell) : EMPTY_CELL
      remember(key, { cell: parsed, chars: text.length, expiresAt: now() + CACHE_TTL_MS })
      return parsed
    },
  }
}

let sharedReader: { bucket: HazardGridBucket; reader: HazardGridReader } | null = null

/** One reader per bound bucket so the cache survives across requests in an isolate. */
export function hazardGridReaderFor(bucket: HazardGridBucket | null | undefined): HazardGridReader | null {
  if (!bucket) return null
  if (sharedReader?.bucket !== bucket) {
    sharedReader = { bucket, reader: createHazardGridReader(bucket) }
  }
  return sharedReader.reader
}
