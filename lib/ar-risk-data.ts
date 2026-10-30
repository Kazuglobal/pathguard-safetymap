import { calculateBearing, calculateDistance } from '@/lib/ar-utils'
import type { AccidentFeature, AccidentHeatmapFilters, ViewportBounds } from '@/lib/traffic-accident-heatmap'

export interface ARPoint { lat: number; lon: number }
export interface ARAccident {
  feature: AccidentFeature
  distance: number
  relativeAngle: number
  x: number
}
export const AR_ACCIDENT_FETCH_MOVE_M = 300
export const AR_HAZARD_FETCH_MOVE_M = 50
export const AR_HAZARD_FETCH_INTERVAL_MS = 10_000

export function arAccidentBounds(point: ARPoint, distance: number): ViewportBounds {
  const radius = distance + AR_ACCIDENT_FETCH_MOVE_M
  const latDelta = radius / 111_000
  const lonDelta = radius / (111_000 * Math.max(.01, Math.cos(point.lat * Math.PI / 180)))
  return { minLat: point.lat - latDelta, maxLat: point.lat + latDelta,
    minLng: point.lon - lonDelta, maxLng: point.lon + lonDelta }
}

export function shouldRefreshARPoint(previous: ARPoint | null, next: ARPoint, distance: number): boolean {
  return !previous || calculateDistance(previous.lat, previous.lon, next.lat, next.lon) >= distance
}

export function projectARAccidents(features: AccidentFeature[], point: ARPoint, heading: number,
  distance: number, orientation: boolean, fov = 60): ARAccident[] {
  const tangent = Math.tan(Math.max(1, Math.min(179, fov)) * Math.PI / 360)
  return features.flatMap(feature => {
    const [lon, lat] = feature.geometry.coordinates
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return []
    const meters = calculateDistance(point.lat, point.lon, lat, lon)
    const angle = ((calculateBearing(point.lat, point.lon, lat, lon) - heading + 540) % 360) - 180
    if (meters > distance || (orientation && Math.abs(angle) > fov / 2)) return []
    return [{ feature, distance: meters, relativeAngle: angle,
      x: Math.max(-1, Math.min(1, Math.tan(angle * Math.PI / 180) / tangent)) }]
  }).sort((a, b) => a.distance - b.distance || a.feature.properties.id - b.feature.properties.id).slice(0, 20)
}

export function accidentFilterLabel(filters: AccidentHeatmapFilters): string {
  const labels = [`${filters.minYear}〜${filters.maxYear}年`, filters.severityFilter === 'fatal' ? '死亡事故' : '全事故']
  if (filters.childFilter) labels.push('子ども関与（補充票確認分）')
  if (filters.youngFilter) labels.push('若年者関与（24歳以下コード）')
  if (filters.pedestrianFilter) labels.push('歩行者関与')
  return labels.join('・')
}
