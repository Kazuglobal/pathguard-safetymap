import * as turf from '@turf/turf'
import { and, eq, gte, lte } from 'drizzle-orm'
import type { LineString, MultiPolygon, Point, Polygon } from 'geojson'

import type { HazardAreaContext, HazardType } from '@/lib/types'

import { assertCan, type Actor } from '../authz'
import { getDb, type AppDb } from '../client'
import { hazardImageCache, hazardZoneCoverage, hazardZones, imageGenerationGateLog } from '../schema'

const JAPAN_BOUNDS = { minLng: 122, minLat: 20, maxLng: 154, maxLat: 46 } as const
const MAX_ROUTE_CANDIDATES = 500

type Feature<G> = { type: 'Feature'; geometry: G; properties: Record<string, unknown> }
type PointFeatureCollection = { features: Array<Feature<Point>> }
type AreaGeometry = Polygon | MultiPolygon

const turfOps = turf as unknown as {
  point(coordinates: [number, number]): Feature<Point>
  lineString(coordinates: number[][]): Feature<LineString>
  polygon(coordinates: number[][][]): Feature<Polygon>
  multiPolygon(coordinates: number[][][][]): Feature<MultiPolygon>
  booleanPointInPolygon(point: Feature<Point>, polygon: Feature<AreaGeometry>): boolean
  booleanIntersects(left: Feature<LineString>, right: Feature<Polygon>): boolean
  lineIntersect(left: Feature<LineString>, right: Feature<Polygon>): PointFeatureCollection
  pointToLineDistance(
    point: Feature<Point>,
    line: Feature<LineString>,
    options: { units: 'kilometers' },
  ): number
}

export interface HazardPointInput {
  longitude: number
  latitude: number
  hazardType: HazardType
  toleranceMeters?: number
}

export interface HazardZoneRow {
  id: string
  hazard_type: string
  source_layer: string
  risk_level: number
  depth_min_m: number | null
  depth_max_m: number | null
  area_context: string
}

export interface RouteHazardMarkerRow extends HazardZoneRow {
  depth_label: string
  area_label: string
  title: string
  summary: string
  explanation: string
  evacuation_points: string[]
  longitude: number
  latitude: number
  scenario_key: string
}

export interface HazardGateLogInput {
  route: 'hazard-image' | 'generate-image' | 'generate-prompts'
  mode: 'log' | 'enforce'
  situation: string | null
  verdict: 'inside' | 'outside' | 'no_coverage' | 'unavailable'
  zoneId: string | null
  latitude: number | null
  longitude: number | null
  userId: string | null
  latencyMs: number
}

export interface HazardImageCacheInput {
  hazardType: HazardType
  riskLevel: number
  areaContext: HazardAreaContext
  scenarioKey: string
  provider: string
  depthLabel: string
  promptEn: string
  promptSignature: string
  objectKey: string
  generatedAt: string
}

function isInJapan(longitude: number, latitude: number): boolean {
  return Number.isFinite(longitude)
    && Number.isFinite(latitude)
    && longitude >= JAPAN_BOUNDS.minLng
    && longitude <= JAPAN_BOUNDS.maxLng
    && latitude >= JAPAN_BOUNDS.minLat
    && latitude <= JAPAN_BOUNDS.maxLat
}

function clampTolerance(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(50, Math.max(0, value ?? 0))
}

function polygonFeature(polygon: Polygon): Feature<Polygon> {
  return turfOps.polygon(polygon.coordinates as number[][][])
}

function areaFeature(geometry: AreaGeometry): Feature<AreaGeometry> {
  return geometry.type === 'Polygon'
    ? polygonFeature(geometry)
    : turfOps.multiPolygon(geometry.coordinates as number[][][][])
}

function distanceToPolygonBoundary(
  point: Feature<Point>,
  polygon: Polygon,
): number {
  let minimum = Number.POSITIVE_INFINITY
  for (const ring of polygon.coordinates) {
    const line = turfOps.lineString(ring as number[][])
    minimum = Math.min(
      minimum,
      turfOps.pointToLineDistance(point, line, { units: 'kilometers' }) * 1_000,
    )
  }
  return minimum
}

function pointMatchesPolygon(
  longitude: number,
  latitude: number,
  polygon: Polygon,
  toleranceMeters: number,
): boolean {
  const point = turfOps.point([longitude, latitude])
  if (turfOps.booleanPointInPolygon(point, polygonFeature(polygon))) return true
  return toleranceMeters > 0 && distanceToPolygonBoundary(point, polygon) <= toleranceMeters
}

function pointMatchesArea(longitude: number, latitude: number, geometry: AreaGeometry): boolean {
  return turfOps.booleanPointInPolygon(turfOps.point([longitude, latitude]), areaFeature(geometry))
}

function routeBounds(route: LineString) {
  const longitudes = route.coordinates.map((coordinate) => coordinate[0])
  const latitudes = route.coordinates.map((coordinate) => coordinate[1])
  return {
    minLng: Math.min(...longitudes),
    minLat: Math.min(...latitudes),
    maxLng: Math.max(...longitudes),
    maxLat: Math.max(...latitudes),
  }
}

function validateRoute(route: LineString): void {
  if (route.type !== 'LineString' || route.coordinates.length < 2) {
    throw new RangeError('route must be a LineString with at least two points')
  }
  for (const coordinate of route.coordinates) {
    if (coordinate.length < 2 || !isInJapan(coordinate[0], coordinate[1])) {
      throw new RangeError('route coordinates must be finite points inside the Japan bounds')
    }
  }
}

function depthLabel(minimum: number | null, maximum: number | null, empty = '深さ情報なし'): string {
  if (minimum != null && maximum != null) return `${minimum.toFixed(1)}m〜${maximum.toFixed(1)}m`
  if (minimum != null) return `${minimum.toFixed(1)}m以上`
  if (maximum != null) return `${maximum.toFixed(1)}m以下`
  return empty
}

function areaLabel(context: HazardAreaContext): string {
  if (context === 'residential-school-route') return '住宅街の通学路'
  if (context === 'riverside') return '河川沿い'
  return '海岸近く'
}

function representativePoint(route: LineString, polygon: Polygon): [number, number] | null {
  const routeFeature = turfOps.lineString(route.coordinates as number[][])
  const zoneFeature = polygonFeature(polygon)
  if (!turfOps.booleanIntersects(routeFeature, zoneFeature)) return null

  const intersections = turfOps.lineIntersect(routeFeature, zoneFeature).features
  const firstIntersection = intersections[0]?.geometry.coordinates
  if (firstIntersection) return [firstIntersection[0], firstIntersection[1]]

  for (const coordinate of route.coordinates) {
    if (turfOps.booleanPointInPolygon(
      turfOps.point([coordinate[0], coordinate[1]]),
      zoneFeature,
    )) {
      return [coordinate[0], coordinate[1]]
    }
  }
  return null
}

function markerFromZone(
  zone: typeof hazardZones.$inferSelect,
  coordinate: [number, number],
): RouteHazardMarkerRow {
  const hazardType = zone.hazardType as HazardType
  const context = zone.areaContext as HazardAreaContext
  const riskName = hazardType === 'tsunami' ? '津波' : '洪水'
  const label = depthLabel(zone.depthMinM, zone.depthMaxM)
  const summaryDepth = depthLabel(zone.depthMinM, zone.depthMaxM, '情報なし')
  const evacuationPoints = hazardType === 'tsunami'
    ? [
        '避難場所と高台への経路を家族で確認しておく',
        '津波警報が出たら海や川から離れてすぐに避難する',
        '近くに高台がなければ高い建物へ垂直避難する',
      ]
    : [
        '日頃から避難場所を確認しておく',
        '警報が出たら早めに行動する',
        '高い場所や丈夫な建物の上階へ避難する',
      ]

  return {
    id: zone.zoneGroupId,
    hazard_type: hazardType,
    source_layer: zone.sourceLayer,
    risk_level: zone.riskLevel,
    depth_min_m: zone.depthMinM,
    depth_max_m: zone.depthMaxM,
    depth_label: label,
    area_context: context,
    area_label: areaLabel(context),
    title: `${riskName}リスク レベル${zone.riskLevel}`,
    summary: `${riskName}リスク レベル${zone.riskLevel} / 想定浸水深${summaryDepth}`,
    explanation: hazardType === 'tsunami'
      ? 'この地点では津波による浸水が想定されます。'
      : 'この地点では大雨や河川氾濫時の浸水が想定されます。',
    evacuation_points: evacuationPoints,
    longitude: coordinate[0],
    latitude: coordinate[1],
    scenario_key: hazardType === 'tsunami' && context === 'coastal'
      ? 'standard-coastal'
      : context === 'riverside'
        ? 'standard-riverside'
        : context === 'residential-school-route'
          ? 'standard-residential'
          : 'standard-base',
  }
}

export function createHazardRepo(db: AppDb) {
  return {
    async getCachedImage(actor: Actor, input: Pick<HazardImageCacheInput,
      'hazardType' | 'riskLevel' | 'areaContext' | 'scenarioKey' | 'provider' | 'promptSignature'>) {
      assertCan(actor, 'select', 'hazard_image_cache')
      const [row] = await db.select().from(hazardImageCache).where(and(
        eq(hazardImageCache.hazardType, input.hazardType),
        eq(hazardImageCache.riskLevel, input.riskLevel),
        eq(hazardImageCache.areaContext, input.areaContext),
        eq(hazardImageCache.scenarioKey, input.scenarioKey),
        eq(hazardImageCache.provider, input.provider),
        eq(hazardImageCache.promptSignature, input.promptSignature),
      )).limit(1)
      return row ?? null
    },

    async upsertCachedImage(actor: Actor, input: HazardImageCacheInput) {
      assertCan(actor, 'insert', 'hazard_image_cache')
      const now = new Date().toISOString()
      const values = { id: crypto.randomUUID(), ...input, status: 'ready', createdAt: now, updatedAt: now }
      const [row] = await db.insert(hazardImageCache).values(values).onConflictDoUpdate({
        target: [
          hazardImageCache.hazardType, hazardImageCache.riskLevel, hazardImageCache.areaContext,
          hazardImageCache.scenarioKey, hazardImageCache.provider, hazardImageCache.promptSignature,
        ],
        set: {
          depthLabel: input.depthLabel, promptEn: input.promptEn, objectKey: input.objectKey,
          status: 'ready', generatedAt: input.generatedAt, updatedAt: now,
        },
      }).returning()
      return row
    },

    async logGateVerdict(actor: Actor, input: HazardGateLogInput): Promise<void> {
      assertCan(actor, 'insert', 'image_generation_gate_log')
      await db.insert(imageGenerationGateLog).values({
        id: crypto.randomUUID(),
        route: input.route,
        mode: input.mode,
        situation: input.situation,
        verdict: input.verdict,
        zoneId: input.zoneId,
        latRounded: input.latitude == null ? null : Math.round(input.latitude * 1_000) / 1_000,
        lngRounded: input.longitude == null ? null : Math.round(input.longitude * 1_000) / 1_000,
        userId: input.userId,
        latencyMs: Math.max(0, Math.round(input.latencyMs)),
      })
    },

    async zonesAtPoint(actor: Actor, input: HazardPointInput): Promise<HazardZoneRow[]> {
      assertCan(actor, 'select', 'hazard_zones')
      if (!isInJapan(input.longitude, input.latitude)) return []
      const toleranceMeters = clampTolerance(input.toleranceMeters)
      const latitudeDelta = toleranceMeters / 111_320
      const longitudeScale = Math.max(Math.cos((input.latitude * Math.PI) / 180), 0.01)
      const longitudeDelta = toleranceMeters / (111_320 * longitudeScale)
      const candidates = await db.select().from(hazardZones).where(and(
        eq(hazardZones.hazardType, input.hazardType),
        lte(hazardZones.bboxMinLng, input.longitude + longitudeDelta),
        gte(hazardZones.bboxMaxLng, input.longitude - longitudeDelta),
        lte(hazardZones.bboxMinLat, input.latitude + latitudeDelta),
        gte(hazardZones.bboxMaxLat, input.latitude - latitudeDelta),
      ))

      return candidates
        .filter((zone) => pointMatchesPolygon(
          input.longitude,
          input.latitude,
          zone.geojson,
          toleranceMeters,
        ))
        .sort((left, right) => right.riskLevel - left.riskLevel
          || (right.depthMaxM ?? -Infinity) - (left.depthMaxM ?? -Infinity)
          || left.id.localeCompare(right.id))
        .map((zone) => ({
          id: zone.id,
          hazard_type: zone.hazardType,
          source_layer: zone.sourceLayer,
          risk_level: zone.riskLevel,
          depth_min_m: zone.depthMinM,
          depth_max_m: zone.depthMaxM,
          area_context: zone.areaContext,
        }))
    },

    async hasCoverageAtPoint(actor: Actor, input: Omit<HazardPointInput, 'toleranceMeters'>): Promise<boolean> {
      assertCan(actor, 'select', 'hazard_zone_coverage')
      if (!isInJapan(input.longitude, input.latitude)) return false
      const candidates = await db.select().from(hazardZoneCoverage).where(and(
        eq(hazardZoneCoverage.hazardType, input.hazardType),
        lte(hazardZoneCoverage.bboxMinLng, input.longitude),
        gte(hazardZoneCoverage.bboxMaxLng, input.longitude),
        lte(hazardZoneCoverage.bboxMinLat, input.latitude),
        gte(hazardZoneCoverage.bboxMaxLat, input.latitude),
      ))
      return candidates.some((coverage) => pointMatchesArea(input.longitude, input.latitude, coverage.geojson))
    },

    async routeIntersections(actor: Actor, route: LineString) {
      assertCan(actor, 'select', 'hazard_zones')
      validateRoute(route)
      const bounds = routeBounds(route)
      const candidates = await db.select().from(hazardZones).where(and(
        lte(hazardZones.bboxMinLng, bounds.maxLng),
        gte(hazardZones.bboxMaxLng, bounds.minLng),
        lte(hazardZones.bboxMinLat, bounds.maxLat),
        gte(hazardZones.bboxMaxLat, bounds.minLat),
      )).limit(MAX_ROUTE_CANDIDATES + 1)

      const truncated = candidates.length > MAX_ROUTE_CANDIDATES
      const byGroup = new Map<string, RouteHazardMarkerRow>()
      for (const zone of candidates.slice(0, MAX_ROUTE_CANDIDATES)) {
        const coordinate = representativePoint(route, zone.geojson)
        if (!coordinate) continue
        const marker = markerFromZone(zone, coordinate)
        const existing = byGroup.get(zone.zoneGroupId)
        if (!existing || marker.risk_level > existing.risk_level) {
          byGroup.set(zone.zoneGroupId, marker)
        }
      }

      return {
        markers: [...byGroup.values()].sort((left, right) => right.risk_level - left.risk_level
          || left.id.localeCompare(right.id)),
        truncated,
      }
    },
  }
}

export function zonesAtPoint(actor: Actor, input: HazardPointInput) {
  return createHazardRepo(getDb()).zonesAtPoint(actor, input)
}

export function hasCoverageAtPoint(actor: Actor, input: Omit<HazardPointInput, 'toleranceMeters'>) {
  return createHazardRepo(getDb()).hasCoverageAtPoint(actor, input)
}

export function routeIntersections(actor: Actor, route: LineString) {
  return createHazardRepo(getDb()).routeIntersections(actor, route)
}

export function logGateVerdict(actor: Actor, input: HazardGateLogInput) {
  return createHazardRepo(getDb()).logGateVerdict(actor, input)
}

export function getCachedHazardImage(actor: Actor, input: Parameters<ReturnType<typeof createHazardRepo>['getCachedImage']>[1]) {
  return createHazardRepo(getDb()).getCachedImage(actor, input)
}

export function upsertCachedHazardImage(actor: Actor, input: HazardImageCacheInput) {
  return createHazardRepo(getDb()).upsertCachedImage(actor, input)
}
