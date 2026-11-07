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
/** Route reads stop once this much cell JSON is loaded and report truncation. */
export const MAX_ROUTE_GRID_CHARS = 16_000_000
export const HAZARD_GRID_MANIFEST_KEY = `${HAZARD_GRID_KEY_PREFIX}/manifest.json`
const ROUTE_READ_CONCURRENCY = 8

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
  /** Size of the stored JSON; 0 for a cell with no published object. */
  chars: number
}

export interface HazardGridBounds {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

export type GridCellIndex = readonly [latitudeIndex: number, longitudeIndex: number]

const EMPTY_CELL: HazardGridCell = Object.freeze({ zones: [], coverage: [], chars: 0 }) as HazardGridCell

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
  return { zones, coverage, chars: text.length }
}

interface CacheEntry {
  cell: HazardGridCell
  expiresAt: number
}

export interface HazardGridReader {
  readCell(hazardType: HazardType, cell: GridCellIndex): Promise<HazardGridCell>
}

/**
 * Reads cells with a small per-isolate LRU cache. AR re-checks the same spot
 * every few seconds, and a point check reads zones and coverage of the same
 * cell in parallel; concurrent reads of one key share a single R2 request.
 * Read failures throw so callers report "unavailable" rather than "no coverage".
 */
export function createHazardGridReader(bucket: HazardGridBucket, now: () => number = Date.now): HazardGridReader {
  const cache = new Map<string, CacheEntry>()
  const inFlight = new Map<string, Promise<HazardGridCell>>()
  let cachedChars = 0

  const forget = (key: string) => {
    const entry = cache.get(key)
    if (!entry) return
    cache.delete(key)
    cachedChars -= entry.cell.chars
  }

  const remember = (key: string, entry: CacheEntry) => {
    forget(key)
    cache.set(key, entry)
    cachedChars += entry.cell.chars
    for (const oldest of cache.keys()) {
      if (cache.size <= CACHE_MAX_ENTRIES && cachedChars <= CACHE_MAX_CHARS) break
      forget(oldest)
    }
  }

  const fetchCell = async (key: string, hazardType: HazardType, cell: GridCellIndex) => {
    const object = await bucket.get(key)
    const parsed = object ? parseCell(await object.text(), hazardType, cell) : EMPTY_CELL
    remember(key, { cell: parsed, expiresAt: now() + CACHE_TTL_MS })
    return parsed
  }

  return {
    readCell(hazardType, cell) {
      const key = hazardGridKey(hazardType, cell)
      const cached = cache.get(key)
      if (cached && cached.expiresAt > now()) {
        remember(key, cached)
        return Promise.resolve(cached.cell)
      }
      const pending = inFlight.get(key)
      if (pending) return pending
      const request = fetchCell(key, hazardType, cell).finally(() => inFlight.delete(key))
      inFlight.set(key, request)
      return request
    },
  }
}

/**
 * Reads route cells a few at a time and stops at the size budget, so a long
 * route cannot load hundreds of cells into one isolate at once.
 */
export async function readRouteCells(
  reader: HazardGridReader,
  hazardTypes: readonly HazardType[],
  cells: readonly GridCellIndex[],
): Promise<{ cells: Array<{ hazardType: HazardType; cell: HazardGridCell }>; truncated: boolean }> {
  const jobs = cells.slice(0, MAX_ROUTE_GRID_CELLS)
    .flatMap((cell) => hazardTypes.map((hazardType) => ({ hazardType, cell })))
  const loaded: Array<{ hazardType: HazardType; cell: HazardGridCell }> = []
  let chars = 0
  for (let start = 0; start < jobs.length; start += ROUTE_READ_CONCURRENCY) {
    if (chars > MAX_ROUTE_GRID_CHARS) return { cells: loaded, truncated: true }
    const batch = jobs.slice(start, start + ROUTE_READ_CONCURRENCY)
    const results = await Promise.all(batch.map((job) => reader.readCell(job.hazardType, job.cell)))
    results.forEach((cell, index) => {
      loaded.push({ hazardType: batch[index].hazardType, cell })
      chars += cell.chars
    })
  }
  return { cells: loaded, truncated: cells.length > MAX_ROUTE_GRID_CELLS }
}

interface PublishedGrid {
  bucket: HazardGridBucket
  reader: HazardGridReader | null
  checkedAt: number
}

let published: PublishedGrid | null = null
let manifestCheck: { bucket: HazardGridBucket; request: Promise<HazardGridReader | null> } | null = null

function isCompleteManifest(text: string): boolean {
  const manifest = JSON.parse(text) as Record<string, unknown>
  return manifest.schemaVersion === HAZARD_GRID_SCHEMA_VERSION
    && manifest.cellsPerDegree === HAZARD_GRID_CELLS_PER_DEGREE
    && manifest.complete === true
}

/**
 * The grid is used only after its manifest is published (the uploader writes it
 * last, after every cell). An unbound bucket or a bucket without a complete
 * manifest returns null so the caller keeps using D1; an R2 error throws.
 * One reader per bucket so the cell cache survives across requests.
 */
export async function publishedHazardGrid(
  bucket: HazardGridBucket | null | undefined,
  now: () => number = Date.now,
): Promise<HazardGridReader | null> {
  if (!bucket) return null
  if (published?.bucket === bucket && now() - published.checkedAt < CACHE_TTL_MS) return published.reader
  if (manifestCheck?.bucket === bucket) return manifestCheck.request
  const request = (async () => {
    const object = await bucket.get(HAZARD_GRID_MANIFEST_KEY)
    const ready = object ? isCompleteManifest(await object.text()) : false
    const reader = ready
      ? (published?.bucket === bucket && published.reader) || createHazardGridReader(bucket, now)
      : null
    published = { bucket, reader, checkedAt: now() }
    return reader
  })().finally(() => { manifestCheck = null })
  manifestCheck = { bucket, request }
  return request
}
