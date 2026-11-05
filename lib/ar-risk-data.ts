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

// ---------------------------------------------------------------------------
// 画角外も含めた事故の位置づけ（どちらを向けば見えるか・地面のどこか）
// ---------------------------------------------------------------------------

export const AR_ACCIDENT_MAX_RECORDS = 20
/** 地面のピン位置の計算に使う端末高。実測値ではない（ar-water-geometry と同じ仮定）。 */
export const AR_ACCIDENT_CAMERA_HEIGHT_M = 1.4

export interface ARAccidentAround extends ARAccident {
  /** 北を0とした方位（度）。 */
  bearing: number
  /** 方角が取れていて、カメラの画角内にあるか。 */
  inView: boolean
}

/** 表示距離内の事故を、画角に関係なく近い順に返す（上限20件）。 */
export function locateARAccidents(features: AccidentFeature[], point: ARPoint, heading: number,
  distance: number, orientation: boolean, fov = 60): ARAccidentAround[] {
  const tangent = Math.tan(Math.max(1, Math.min(179, fov)) * Math.PI / 360)
  return features.flatMap(feature => {
    const [lon, lat] = feature.geometry.coordinates
    if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) return []
    const meters = calculateDistance(point.lat, point.lon, lat, lon)
    if (meters > distance) return []
    const bearing = calculateBearing(point.lat, point.lon, lat, lon)
    const angle = ((bearing - heading + 540) % 360) - 180
    const inView = orientation && Math.abs(angle) <= fov / 2
    return [{ feature, distance: meters, relativeAngle: angle, bearing, inView,
      x: Math.max(-1, Math.min(1, Math.tan(angle * Math.PI / 180) / tangent)) }]
  }).sort((a, b) => a.distance - b.distance || a.feature.properties.id - b.feature.properties.id)
    .slice(0, AR_ACCIDENT_MAX_RECORDS)
}

const COMPASS_16 = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東',
  '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'] as const

/** 方位（度）を16方位の日本語にする。 */
export function compassLabel(bearing: number): string {
  const normalized = ((bearing % 360) + 360) % 360
  return COMPASS_16[Math.round(normalized / 22.5) % 16]
}

/** 向いている方向から見た相対方向（正面・右前・右・右後ろ・後ろ…）。 */
export function relativeDirectionLabel(relativeAngle: number): string {
  const abs = Math.abs(relativeAngle)
  const side = relativeAngle > 0 ? '右' : '左'
  if (abs <= 15) return '正面'
  if (abs <= 60) return `${side}前`
  if (abs <= 120) return side
  if (abs <= 160) return `${side}後ろ`
  return '後ろ'
}

/** 画角外の事故を、向き直す方向ごとにまとめる。後ろ寄り（|角度|>135°）は back。 */
export function summarizeOffscreen(items: ARAccidentAround[]): Record<'left' | 'right' | 'back', ARAccidentAround[]> {
  const result: Record<'left' | 'right' | 'back', ARAccidentAround[]> = { left: [], right: [], back: [] }
  for (const item of items) {
    if (item.inView) continue
    const side = Math.abs(item.relativeAngle) > 135 ? 'back' : item.relativeAngle > 0 ? 'right' : 'left'
    result[side] = [...result[side], item]
  }
  return result
}

/**
 * 地面上の距離 d の点が、画面の上から何%の高さに見えるか。
 * 平らな地面と仮定した端末高からの俯角 atan(h/d) と、カメラの仰角・縦の画角で求める。
 * 測量ではなく目安。上部のタブ・下部のパネルに隠れないよう [minPct, maxPct] に収める。
 */
export function groundScreenYPercent(distanceM: number, pitchDeg: number, verticalFovDeg: number,
  { cameraHeightM = AR_ACCIDENT_CAMERA_HEIGHT_M, minPct = 38, maxPct = 50 } = {}): number {
  const depression = Math.atan2(cameraHeightM, Math.max(1, distanceM)) * 180 / Math.PI
  const half = Math.tan(Math.max(1, Math.min(179, verticalFovDeg)) * Math.PI / 360)
  const offset = Math.tan((-depression - pitchDeg) * Math.PI / 180) / half
  const y = 50 - offset * 50
  return Math.max(minPct, Math.min(maxPct, Number.isFinite(y) ? y : 50))
}

/** 横の画角と画面の縦横比から縦の画角を出す。 */
export function verticalFovFromHorizontal(horizontalFovDeg: number, aspectHeightOverWidth: number): number {
  const half = Math.tan(Math.max(1, Math.min(179, horizontalFovDeg)) * Math.PI / 360)
  const ratio = Number.isFinite(aspectHeightOverWidth) && aspectHeightOverWidth > 0 ? aspectHeightOverWidth : 16 / 9
  return Math.atan(half * ratio) * 360 / Math.PI
}

export interface ARScreenPin { left: number; top: number }

/**
 * 画面上で重なるピンを1つにまとめる。入力は近い順を想定し、各グループの先頭（最寄り）を基準に
 * 横 dx%・縦 dy% 以内に入ったものを同じグループにする。記録自体は統合しない（件数と選択の巡回に使う）。
 */
export function groupOverlappingPins<T extends ARScreenPin>(pins: T[], { dx = 18, dy = 10 } = {}): T[][] {
  const groups: T[][] = []
  for (const pin of pins) {
    const group = groups.find(list => Math.abs(list[0].left - pin.left) < dx && Math.abs(list[0].top - pin.top) < dy)
    if (group) group.push(pin)
    else groups.push([pin])
  }
  return groups
}

/** 重なったピンをタップしたときに次に選ぶ記録。選択中がグループ外なら先頭（最寄り）。 */
export function nextIdInGroup(ids: number[], selectedId: number | null): number {
  const index = selectedId === null ? -1 : ids.indexOf(selectedId)
  return ids[index < 0 ? 0 : (index + 1) % ids.length]
}

/** 画角内の事故の、画面上の横位置（%）。切り抜き後の水平画角で求めた x をそのまま使う。 */
export function pinLeftPercent(x: number): number {
  return Math.max(8, Math.min(92, 50 + x * 50))
}
