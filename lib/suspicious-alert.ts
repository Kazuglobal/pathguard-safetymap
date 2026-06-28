// =============================================
// 不審者アラート 地図化ユーティリティ
// 設計書: docs/plans/2026-06-28-suspicious-alert-map-visualization-plan.md
// turf による「半径つき危険エリア円」のGeoJSON生成・bbox計算・既定半径の正規化、
// および共有用 Mapbox Static Images URL の生成（円オーバーレイ／中心ピンのみフォールバック）。
// 純関数中心でユニットテスト可能にする。
// =============================================

import * as turf from "@turf/turf"
import polyline from "@mapbox/polyline"
import type { DangerReport } from "@/lib/types"

/** danger_type の不審者アラート判別値 */
export const SUSPICIOUS_DANGER_TYPE = "suspicious"

/** 半径未指定時のクライアント既定（メートル） */
export const DEFAULT_ALERT_RADIUS_M = 300

/** 半径の許可値（DBのCHECK制約と一致させる） */
export const ALERT_RADIUS_OPTIONS = [200, 300, 500, 1000] as const

export type AlertRadiusOption = (typeof ALERT_RADIUS_OPTIONS)[number]

/** 円ポリゴンの分割数。地図表示は滑らかに、共有URLは短くするため別定数。 */
const CIRCLE_STEPS_MAP = 64
const CIRCLE_STEPS_SHARE = 32

/** Mapbox Static Images API のURL長上限の安全側目安（超えたら中心ピンのみへフォールバック） */
export const MAX_STATIC_MAP_URL_LENGTH = 8000

/**
 * 半径を許可値に正規化する。未指定・不正値は既定300mにフォールバックする。
 * 許可値以外の数値は最も近い許可値に丸める（DB制約違反の保存を防ぐ）。
 */
export function resolveAlertRadius(value: unknown): AlertRadiusOption {
  if (typeof value === "number" && Number.isFinite(value)) {
    if ((ALERT_RADIUS_OPTIONS as readonly number[]).includes(value)) {
      return value as AlertRadiusOption
    }
    // 最近傍の許可値に丸める
    let nearest: AlertRadiusOption = DEFAULT_ALERT_RADIUS_M
    let minDiff = Number.POSITIVE_INFINITY
    for (const option of ALERT_RADIUS_OPTIONS) {
      const diff = Math.abs(option - value)
      if (diff < minDiff) {
        minDiff = diff
        nearest = option
      }
    }
    return nearest
  }
  return DEFAULT_ALERT_RADIUS_M
}

function isValidCenter(center: unknown): center is [number, number] {
  return (
    Array.isArray(center) &&
    center.length >= 2 &&
    Number.isFinite(center[0]) &&
    Number.isFinite(center[1]) &&
    (center[0] as number) >= -180 &&
    (center[0] as number) <= 180 &&
    (center[1] as number) >= -90 &&
    (center[1] as number) <= 90
  )
}

/**
 * 中心点[lng,lat]と半径(m)から円ポリゴンFeatureを生成する。
 * properties に id / radiusM を保持し、フォーカス強調やクリック判定に使えるようにする。
 */
export function buildAlertCircle(
  center: [number, number],
  radiusM: number = DEFAULT_ALERT_RADIUS_M,
  properties: Record<string, unknown> = {},
  steps: number = CIRCLE_STEPS_MAP,
): GeoJSON.Feature<GeoJSON.Polygon> | null {
  if (!isValidCenter(center)) return null
  const radius = resolveAlertRadius(radiusM)
  // turf.circle/bbox は @turf/turf の名前空間型に出ないことがあるため any 経由で呼ぶ（実行時は存在する）。
  const circle = (turf as any).circle([center[0], center[1]], radius / 1000, {
    units: "kilometers",
    steps,
  })
  circle.properties = { ...properties, radiusM: radius }
  return circle as GeoJSON.Feature<GeoJSON.Polygon>
}

/**
 * suspicious レポート配列から円ポリゴンの FeatureCollection を構築する。
 * 中心点が不正なレポートはスキップする。
 */
export function buildAlertCircleCollection(
  reports: DangerReport[],
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = []
  for (const report of reports) {
    if (report.danger_type !== SUSPICIOUS_DANGER_TYPE) continue
    const center: [number, number] = [report.longitude, report.latitude]
    const circle = buildAlertCircle(center, report.alert_radius_m ?? DEFAULT_ALERT_RADIUS_M, {
      id: report.id,
      danger_level: report.danger_level,
    })
    if (circle) features.push(circle)
  }
  return { type: "FeatureCollection", features }
}

/**
 * 円全体を画面に収めるための bbox [west, south, east, north] を返す。
 * map.fitBounds([[w,s],[e,n]]) に渡せる形に変換するヘルパーも別途用意する。
 */
export function getAlertBBox(
  center: [number, number],
  radiusM: number = DEFAULT_ALERT_RADIUS_M,
): [number, number, number, number] | null {
  const circle = buildAlertCircle(center, radiusM)
  if (!circle) return null
  const bbox = (turf as any).bbox(circle) as [number, number, number, number]
  return [bbox[0], bbox[1], bbox[2], bbox[3]]
}

/** fitBounds 用の [[w,s],[e,n]] 形式に変換する。 */
export function getAlertFitBounds(
  center: [number, number],
  radiusM: number = DEFAULT_ALERT_RADIUS_M,
): [[number, number], [number, number]] | null {
  const bbox = getAlertBBox(center, radiusM)
  if (!bbox) return null
  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ]
}

export interface StaticMapOptions {
  center: [number, number]
  radiusM?: number
  mapboxToken: string
  width?: number
  height?: number
  /** 円オーバーレイの分割数（共有URLは短くするため既定32） */
  steps?: number
}

const STATIC_STYLE = "mapbox/streets-v12"
const ALERT_COLOR_HEX = "f97316" // orange-500（# なし、Static API 形式）

/**
 * 円ポリゴンを Mapbox Static Images の `path` オーバーレイ文字列に変換する。
 * polyline.encode は [lat,lng] ペアを取る点に注意（GeoJSON は [lng,lat]）。
 */
export function buildCirclePathOverlay(
  circle: GeoJSON.Feature<GeoJSON.Polygon>,
): string {
  const ring = circle.geometry.coordinates[0] ?? []
  const latLngs: [number, number][] = ring.map(([lng, lat]) => [lat, lng])
  const encoded = polyline.encode(latLngs)
  // path-{strokeWidth}+{strokeColor}-{strokeOpacity}+{fillColor}-{fillOpacity}({encoded})
  return `path-3+${ALERT_COLOR_HEX}-0.9+${ALERT_COLOR_HEX}-0.18(${encodeURIComponent(encoded)})`
}

/** 中心ピンのオーバーレイ文字列。 */
export function buildCenterPinOverlay(center: [number, number]): string {
  return `pin-l+${ALERT_COLOR_HEX}(${center[0]},${center[1]})`
}

export interface StaticMapResult {
  url: string
  /** 円を描けず中心ピンのみにフォールバックしたか */
  fallback: boolean
}

/**
 * 共有用の静的地図URLを生成する。
 * 通常は「中心ピン＋半径円」。URLが長すぎる/円生成に失敗した場合は中心ピンのみへフォールバックする。
 * フォールバック有無を返してテスト可能にする。
 */
export function buildSuspiciousAlertStaticMapUrl(
  options: StaticMapOptions,
): StaticMapResult | null {
  const { center, mapboxToken } = options
  if (!isValidCenter(center) || !mapboxToken) return null

  const radiusM = resolveAlertRadius(options.radiusM ?? DEFAULT_ALERT_RADIUS_M)
  const width = Math.min(options.width ?? 600, 1280)
  const height = Math.min(options.height ?? 400, 1280)
  const steps = options.steps ?? CIRCLE_STEPS_SHARE

  const pinOverlay = buildCenterPinOverlay(center)

  const buildUrl = (overlaySegment: string) =>
    `https://api.mapbox.com/styles/v1/${STATIC_STYLE}/static/${overlaySegment}/auto/${width}x${height}?padding=80&access_token=${encodeURIComponent(mapboxToken)}`

  const circle = buildAlertCircle(center, radiusM, {}, steps)
  if (circle) {
    const pathOverlay = buildCirclePathOverlay(circle)
    const fullUrl = buildUrl(`${pathOverlay},${pinOverlay}`)
    if (fullUrl.length <= MAX_STATIC_MAP_URL_LENGTH) {
      return { url: fullUrl, fallback: false }
    }
  }

  // フォールバック: 中心ピンのみ（円なし）
  return { url: buildUrl(pinOverlay), fallback: true }
}
