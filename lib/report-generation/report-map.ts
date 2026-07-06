/**
 * Route Danger Report — Map URL Generation
 *
 * Mapbox Static Images API 用のURL生成と座標正規化。
 * route-danger-report.ts から抽出したモジュール(挙動は同一)。
 * 公開APIの互換のため route-danger-report.ts からも re-export される。
 */

import type { DangerReport } from '@/lib/types'
import { getDangerLevelPresentation } from './danger-level-presentation'

export interface MapDimensions {
  width: number
  height: number
}

interface NormalizedDangerPoint {
  danger: DangerReport
  lng: number
  lat: number
}

interface BoundingBox {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

const DEFAULT_MAP_DIMENSIONS: MapDimensions = {
  width: 600,
  height: 400,
}

const MAX_STATIC_IMAGE_DIMENSION = 1280
const HI_DPI_SCALE = 2
const MAP_BBOX_PADDING_RATIO = 0.22
const MIN_BBOX_SPAN_DEGREES = 0.004
const MAP_MARKER_LABELS = '1234567890abcdefghijklmnopqrstuvwxyz'
const MAP_MARKER_LIMIT = MAP_MARKER_LABELS.length

/** 地図注釈(コールアウト)の最大表示件数 */
export const MAP_CALLOUT_LIMIT = 20
/** コールアウトにサムネイルを添える最大件数 */
export const MAP_CALLOUT_THUMBNAIL_LIMIT = 12

/**
 * Generates a Mapbox Static Images API URL for the route overview map.
 *
 * @param routeGeometry - The LineString geometry of the route
 * @param dangers - Array of danger reports to mark on the map
 * @param mapboxToken - Mapbox access token
 * @param dimensions - Optional custom dimensions (default: 600x400)
 * @returns The URL for the static map image
 */
export function generateOverviewMapUrl(
  routeGeometry: GeoJSON.LineString,
  dangers: DangerReport[],
  mapboxToken: string,
  dimensions: MapDimensions = DEFAULT_MAP_DIMENSIONS
): string {
  const { width, height } = dimensions
  const style = 'mapbox/streets-v12'
  const normalizedRouteCoords = normalizeRouteCoordinates(routeGeometry)
  const normalizedDangerPoints = dangers
    .map((danger) => toNormalizedDangerPoint(danger))
    .filter((point): point is NormalizedDangerPoint => point !== null)
    .slice(0, MAP_MARKER_LIMIT)

  // Encode route as coordinate path for Mapbox Static Images API.
  // Only use normalized coordinates to avoid generating invalid map URLs.
  const routePathCoordinates =
    normalizedRouteCoords.length > 1 ? normalizedRouteCoords : []
  const pathOverlay = buildPathOverlay(routePathCoordinates)

  // Create numbered markers for dangers.
  const markerOverlays = normalizedDangerPoints
    .map(({ danger, lng, lat }, index) => {
      const color = getDangerLevelPresentation(danger.danger_level).pinColor
      const label = getMapMarkerLabel(index)
      return `pin-l-${label}+${color}(${lng},${lat})`
    })
    .join(',')

  // Build the URL
  const overlays = [pathOverlay, markerOverlays].filter(Boolean).join(',')
  const overlaySegment = overlays ? `${overlays}/` : ''

  // Calculate focused map view around school route and danger points.
  const focusedBBox = calculateFocusedBoundingBox(
    normalizedRouteCoords,
    normalizedDangerPoints
  )
  const viewport = focusedBBox
    ? formatBoundingBox(focusedBBox)
    : buildFallbackViewport(normalizedRouteCoords, normalizedDangerPoints)

  const safeWidth = Math.min(width, MAX_STATIC_IMAGE_DIMENSION)
  const safeHeight = Math.min(height, MAX_STATIC_IMAGE_DIMENSION)
  const canUseHiDpi =
    safeWidth * HI_DPI_SCALE <= MAX_STATIC_IMAGE_DIMENSION &&
    safeHeight * HI_DPI_SCALE <= MAX_STATIC_IMAGE_DIMENSION
  const pixelRatio = canUseHiDpi ? '@2x' : ''
  const url = `https://api.mapbox.com/styles/v1/${style}/static/${overlaySegment}${viewport}/${safeWidth}x${safeHeight}${pixelRatio}?padding=48&access_token=${encodeURIComponent(mapboxToken)}`

  return url
}

/** 地図ピンとカード見出しで共有する連番ラベル(1〜9,0,a〜z)。 */
export function getMapMarkerLabel(index: number): string {
  return MAP_MARKER_LABELS[index] ?? MAP_MARKER_LABELS[MAP_MARKER_LABELS.length - 1]
}

function buildPathOverlay(routeCoordinates: [number, number][]): string {
  if (routeCoordinates.length < 2) {
    return ''
  }

  const coordinatePath = routeCoordinates
    .map(([lng, lat]) => `${lng},${lat}`)
    .join(';')
  return `path-4+3b82f6-0.7(${encodeURIComponent(coordinatePath)})`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeLngLat(rawLng: unknown, rawLat: unknown): [number, number] | null {
  if (!isFiniteNumber(rawLng) || !isFiniteNumber(rawLat)) {
    return null
  }

  if (rawLng >= -180 && rawLng <= 180 && rawLat >= -90 && rawLat <= 90) {
    return [rawLng, rawLat]
  }

  // Fallback for accidentally swapped coordinates.
  if (rawLat >= -180 && rawLat <= 180 && rawLng >= -90 && rawLng <= 90) {
    return [rawLat, rawLng]
  }

  return null
}

function normalizeRouteCoordinates(routeGeometry: GeoJSON.LineString): [number, number][] {
  return routeGeometry.coordinates
    .map(([lng, lat]) => normalizeLngLat(lng, lat))
    .filter((coord): coord is [number, number] => coord !== null)
}

function toNormalizedDangerPoint(danger: DangerReport): NormalizedDangerPoint | null {
  const normalized = normalizeLngLat(danger.longitude, danger.latitude)
  if (!normalized) {
    return null
  }

  return {
    danger,
    lng: normalized[0],
    lat: normalized[1],
  }
}

function calculateFocusedBoundingBox(
  routeCoordinates: [number, number][],
  dangerPoints: NormalizedDangerPoint[]
): BoundingBox | null {
  const allPoints: [number, number][] = [
    ...routeCoordinates,
    ...dangerPoints.map((point): [number, number] => [point.lng, point.lat]),
  ]

  if (allPoints.length === 0) {
    return null
  }

  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  for (const [lng, lat] of allPoints) {
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }

  const spanLng = Math.max(maxLng - minLng, MIN_BBOX_SPAN_DEGREES)
  const spanLat = Math.max(maxLat - minLat, MIN_BBOX_SPAN_DEGREES)
  const padLng = Math.max(spanLng * MAP_BBOX_PADDING_RATIO, MIN_BBOX_SPAN_DEGREES / 2)
  const padLat = Math.max(spanLat * MAP_BBOX_PADDING_RATIO, MIN_BBOX_SPAN_DEGREES / 2)

  return {
    minLng: clamp(minLng - padLng, -180, 180),
    minLat: clamp(minLat - padLat, -90, 90),
    maxLng: clamp(maxLng + padLng, -180, 180),
    maxLat: clamp(maxLat + padLat, -90, 90),
  }
}

function formatBoundingBox(bbox: BoundingBox): string {
  return `[${bbox.minLng.toFixed(6)},${bbox.minLat.toFixed(6)},${bbox.maxLng.toFixed(6)},${bbox.maxLat.toFixed(6)}]`
}

function buildFallbackViewport(
  routeCoordinates: [number, number][],
  dangerPoints: NormalizedDangerPoint[]
): string {
  const firstRoutePoint = routeCoordinates[0]
  if (firstRoutePoint) {
    const [lng, lat] = firstRoutePoint
    return `${lng.toFixed(6)},${lat.toFixed(6)},15`
  }

  const firstDangerPoint = dangerPoints[0]
  if (firstDangerPoint) {
    return `${firstDangerPoint.lng.toFixed(6)},${firstDangerPoint.lat.toFixed(6)},15`
  }

  // Last-resort fallback that still produces a valid static-map URL.
  return '0,0,1'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
