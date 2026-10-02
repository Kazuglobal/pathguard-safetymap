import { and, desc, eq, gte, lte } from 'drizzle-orm'

import { HOTSPOT_DATASET_VERSION } from '@/lib/traffic-accident/hotspot-config'
import type { AccidentHotspotList, AccidentHotspotSummary } from '@/lib/traffic-accident/hotspot-types'
import { distanceMeters } from '@/lib/traffic-accident/hotspots'

import { assertCan, type Actor } from '../authz'
import { getTrafficDb, type AppDb } from '../client'
import { accidentHotspots } from '../schema'

const MAX_BBOX_RESULTS = 2_000
const MAX_RADIUS_METERS = 1_000
const MAX_ROUTE_CANDIDATES = 5_000
const MAX_ROUTE_POINTS = 5_000
/** 経路の線から多発地点の中心までの距離。多発地点の半径(30m)に経路線の誤差を足した値。 */
export const ROUTE_HOTSPOT_BUFFER_METERS = 50
const METERS_PER_DEGREE_LAT = 110_574
const METERS_PER_DEGREE_LNG_AT_EQUATOR = 111_320

type HotspotRow = typeof accidentHotspots.$inferSelect
type LatLng = { lat: number; lng: number }

export interface HotspotBboxInput {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
  limit?: number
}

export interface HotspotNearPointInput {
  latitude: number
  longitude: number
  radiusMeters: number
  limit?: number
}

function assertFiniteInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}`)
  }
}

function parseCounts(json: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]),
      ),
    )
  } catch {
    return {}
  }
}

function toSummary(row: HotspotRow, distance: number | null): AccidentHotspotSummary {
  return {
    id: row.id,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radiusMeters,
    minYear: row.minYear,
    maxYear: row.maxYear,
    accidentCount: row.accidentCount,
    fatalCount: row.fatalCount,
    pedestrianCount: row.pedestrianCount,
    youngCount: row.youngCount,
    byYear: parseCounts(row.byYearJson),
    byClass: parseCounts(row.byClassJson),
    peakHour: row.peakHour,
    nationalRank: row.nationalRank,
    distanceMeters: distance == null ? null : Math.round(distance),
  }
}

function boxAround(latitude: number, longitude: number, meters: number) {
  const latDelta = meters / METERS_PER_DEGREE_LAT
  const lngScale = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01)
  const lngDelta = meters / (METERS_PER_DEGREE_LNG_AT_EQUATOR * lngScale)
  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  }
}

/** 点から線分までの距離（m、数km以内の正距円筒近似）。 */
export function distanceToSegmentMeters(point: LatLng, start: LatLng, end: LatLng): number {
  const scaleX = METERS_PER_DEGREE_LNG_AT_EQUATOR * Math.cos((point.lat * Math.PI) / 180)
  const toXY = (p: LatLng) => ({
    x: (p.lng - point.lng) * scaleX,
    y: (p.lat - point.lat) * METERS_PER_DEGREE_LAT,
  })
  const a = toXY(start)
  const b = toXY(end)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared))
  return Math.hypot(a.x + t * dx, a.y + t * dy)
}

/** 点から折れ線までの最短距離（m）。 */
export function distanceToLineMeters(point: LatLng, line: readonly LatLng[]): number {
  if (line.length === 1) return distanceMeters(point, line[0])
  let best = Number.POSITIVE_INFINITY
  for (let i = 1; i < line.length; i += 1) {
    best = Math.min(best, distanceToSegmentMeters(point, line[i - 1], line[i]))
  }
  return best
}

/** GeoJSON LineString の coordinates（[lng, lat] の配列）を検証して読む。 */
function parseLine(coordinates: unknown): LatLng[] {
  if (!Array.isArray(coordinates)) throw new RangeError('route coordinates must be an array')
  if (coordinates.length === 0 || coordinates.length > MAX_ROUTE_POINTS) {
    throw new RangeError(`route must have 1 to ${MAX_ROUTE_POINTS} points`)
  }
  return coordinates.map((pair) => {
    if (!Array.isArray(pair) || pair.length < 2) throw new RangeError('route point must be a lng/lat pair')
    const [lng, lat] = pair as [unknown, unknown]
    if (typeof lng !== 'number' || typeof lat !== 'number') throw new RangeError('route point must be numbers')
    assertFiniteInRange('route longitude', lng, -180, 180)
    assertFiniteInRange('route latitude', lat, -90, 90)
    return { lat, lng }
  })
}

export function createAccidentHotspotsRepo(db: AppDb) {
  async function inBox(box: { minLat: number; maxLat: number; minLng: number; maxLng: number }, limit: number) {
    return db
      .select()
      .from(accidentHotspots)
      .where(and(
        eq(accidentHotspots.datasetVersion, HOTSPOT_DATASET_VERSION),
        gte(accidentHotspots.latitude, box.minLat),
        lte(accidentHotspots.latitude, box.maxLat),
        gte(accidentHotspots.longitude, box.minLng),
        lte(accidentHotspots.longitude, box.maxLng),
      ))
      .orderBy(desc(accidentHotspots.accidentCount))
      .limit(limit)
  }

  return {
    /** 地図の表示範囲内の多発地点（件数の多い順）。 */
    async hotspotsInBbox(actor: Actor, input: HotspotBboxInput): Promise<AccidentHotspotList> {
      assertCan(actor, 'select', 'accident_hotspots')
      assertFiniteInRange('minLng', input.minLng, -180, 180)
      assertFiniteInRange('maxLng', input.maxLng, -180, 180)
      assertFiniteInRange('minLat', input.minLat, -90, 90)
      assertFiniteInRange('maxLat', input.maxLat, -90, 90)
      if (input.minLng > input.maxLng || input.minLat > input.maxLat) {
        throw new RangeError('bbox minimums must not exceed maximums')
      }
      const limit = Math.min(Math.max(Math.floor(input.limit ?? MAX_BBOX_RESULTS), 1), MAX_BBOX_RESULTS)
      const rows = await inBox(input, limit + 1)
      return {
        hotspots: rows.slice(0, limit).map((row) => toSummary(row, null)),
        truncated: rows.length > limit,
      }
    },

    /** ある地点から半径 radiusMeters 以内の多発地点（件数の多い順、既定3件）。 */
    async hotspotsNearPoint(actor: Actor, input: HotspotNearPointInput): Promise<AccidentHotspotSummary[]> {
      assertCan(actor, 'select', 'accident_hotspots')
      assertFiniteInRange('latitude', input.latitude, -90, 90)
      assertFiniteInRange('longitude', input.longitude, -180, 180)
      assertFiniteInRange('radiusMeters', input.radiusMeters, 1, MAX_RADIUS_METERS)
      const center = { lat: input.latitude, lng: input.longitude }
      const rows = await inBox(boxAround(input.latitude, input.longitude, input.radiusMeters), MAX_BBOX_RESULTS)
      return rows
        .map((row) => ({ row, distance: distanceMeters(center, { lat: row.latitude, lng: row.longitude }) }))
        .filter(({ distance }) => distance <= input.radiusMeters)
        .slice(0, input.limit ?? 3)
        .map(({ row, distance }) => toSummary(row, distance))
    },

    /** 経路の近く（ROUTE_HOTSPOT_BUFFER_METERS 以内）を通る多発地点（件数の多い順）。 */
    async hotspotsAlongRoute(actor: Actor, coordinates: unknown): Promise<AccidentHotspotList> {
      assertCan(actor, 'select', 'accident_hotspots')
      const line = parseLine(coordinates)
      let minLat = Number.POSITIVE_INFINITY
      let maxLat = Number.NEGATIVE_INFINITY
      let minLng = Number.POSITIVE_INFINITY
      let maxLng = Number.NEGATIVE_INFINITY
      for (const point of line) {
        minLat = Math.min(minLat, point.lat)
        maxLat = Math.max(maxLat, point.lat)
        minLng = Math.min(minLng, point.lng)
        maxLng = Math.max(maxLng, point.lng)
      }
      const southWest = boxAround(minLat, minLng, ROUTE_HOTSPOT_BUFFER_METERS)
      const northEast = boxAround(maxLat, maxLng, ROUTE_HOTSPOT_BUFFER_METERS)
      const rows = await inBox({
        minLat: southWest.minLat,
        maxLat: northEast.maxLat,
        minLng: Math.min(southWest.minLng, northEast.minLng),
        maxLng: Math.max(southWest.maxLng, northEast.maxLng),
      }, MAX_ROUTE_CANDIDATES + 1)
      const hotspots = rows
        .slice(0, MAX_ROUTE_CANDIDATES)
        .map((row) => ({ row, distance: distanceToLineMeters({ lat: row.latitude, lng: row.longitude }, line) }))
        .filter(({ distance }) => distance <= ROUTE_HOTSPOT_BUFFER_METERS)
        .map(({ row, distance }) => toSummary(row, distance))
      return { hotspots, truncated: rows.length > MAX_ROUTE_CANDIDATES }
    },
  }
}

export function hotspotsInBbox(actor: Actor, input: HotspotBboxInput) {
  return createAccidentHotspotsRepo(getTrafficDb()).hotspotsInBbox(actor, input)
}

export function hotspotsNearPoint(actor: Actor, input: HotspotNearPointInput) {
  return createAccidentHotspotsRepo(getTrafficDb()).hotspotsNearPoint(actor, input)
}

export function hotspotsAlongRoute(actor: Actor, coordinates: unknown) {
  return createAccidentHotspotsRepo(getTrafficDb()).hotspotsAlongRoute(actor, coordinates)
}
