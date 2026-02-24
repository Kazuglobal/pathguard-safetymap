/**
 * AR機能のためのユーティリティ関数
 * 位置情報と方角の計算、3D座標変換など
 */

import type { DangerReport } from "./types"
import {
  DEFAULT_FOV,
  DEFAULT_MAX_DISTANCE,
  FOV_SAFE_MAX,
  FOV_SAFE_MIN,
  MAX_ANGLE_DEGREES,
} from "./ar-constants"

const isValidCoordinate = (lat: number, lon: number): boolean => {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

/**
 * 2点間の距離を計算（ハーバーサイン公式）
 * @param lat1 地点1の緯度
 * @param lon1 地点1の経度
 * @param lat2 地点2の緯度
 * @param lon2 地点2の経度
 * @returns 距離（メートル）
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000 // 地球の半径（メートル）
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

/**
 * 2点間の方角を計算（方位角）
 * @param lat1 現在地の緯度
 * @param lon1 現在地の経度
 * @param lat2 目的地の緯度
 * @param lon2 目的地の経度
 * @returns 方角（度、0-360、0が北）
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180

  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)

  const θ = Math.atan2(y, x)
  const bearing = ((θ * 180) / Math.PI + 360) % 360

  return bearing
}

/**
 * 危険個所のAR表示用データを計算
 * @param userLat ユーザーの緯度
 * @param userLon ユーザーの経度
 * @param userHeading ユーザーの向き（度、0-360、0が北）
 * @param reports 危険個所のリスト
 * @param maxDistance 最大表示距離（メートル、デフォルト500m）
 * @returns AR表示用の危険個所データ
 */
export interface ARHazardData {
  report: DangerReport
  distance: number // メートル
  bearing: number // 度（0-360、0が北）
  relativeAngle: number // ユーザーの向きからの相対角度（度、-180〜180）
  x: number // AR空間でのX座標（-1〜1）
  y: number // AR空間でのY座標（-1〜1）
  z: number // AR空間でのZ座標（距離に基づく）
}

export interface ARHazardOptions {
  maxDistance?: number // 最大表示距離（メートル、デフォルト500m）
  maxAngle?: number // 最大表示角度（度、デフォルト90度 = 前方のみ）
  showBehind?: boolean // 後方の地点も表示するか（デフォルトfalse）
  fov?: number // 視野角（度、デフォルト60度）
}

export function calculateARHazardData(
  userLat: number,
  userLon: number,
  userHeading: number,
  reports: DangerReport[],
  options: number | ARHazardOptions = 500
): ARHazardData[] {
  // 後方互換性のため、数値が渡された場合はmaxDistanceとして扱う
  const opts: ARHazardOptions = typeof options === 'number'
    ? { maxDistance: options }
    : options

  const maxDistance = opts.maxDistance ?? DEFAULT_MAX_DISTANCE
  const maxAngle = opts.maxAngle ?? MAX_ANGLE_DEGREES
  const showBehind = opts.showBehind ?? false
  const safeMaxDistance = maxDistance > 0 ? maxDistance : 1
  const safeFov = (() => {
    const rawFov = opts.fov ?? DEFAULT_FOV
    if (!Number.isFinite(rawFov)) return DEFAULT_FOV
    return Math.min(FOV_SAFE_MAX, Math.max(FOV_SAFE_MIN, rawFov))
  })()

  if (!isValidCoordinate(userLat, userLon)) {
    return []
  }

  return reports
    .map((report) => {
      if (!isValidCoordinate(report.latitude, report.longitude)) {
        return null
      }
      const distance = calculateDistance(
        userLat,
        userLon,
        report.latitude,
        report.longitude
      )

      if (distance > safeMaxDistance) {
        return null
      }

      const bearing = calculateBearing(
        userLat,
        userLon,
        report.latitude,
        report.longitude
      )

      // ユーザーの向きからの相対角度を計算（-180〜180度）
      let relativeAngle = bearing - userHeading
      if (relativeAngle > 180) relativeAngle -= 360
      if (relativeAngle < -180) relativeAngle += 360

      // 後方の地点をフィルタリング（通過済みの地点を非表示）
      if (!showBehind && Math.abs(relativeAngle) > maxAngle) {
        return null
      }

      // AR空間での座標を計算
      // 視野角を考慮して、-1〜1の範囲にマッピング
      const x = Math.tan((relativeAngle * Math.PI) / 180) / Math.tan((safeFov / 2) * Math.PI / 180)
      const y = 0 // 水平面での表示を想定
      const z = Math.min(distance / safeMaxDistance, 1) // 正規化された距離

      return {
        report,
        distance,
        bearing,
        relativeAngle,
        x: Math.max(-1, Math.min(1, x)), // -1〜1の範囲に制限
        y,
        z,
      }
    })
    .filter((data): data is ARHazardData => data !== null)
    .sort((a, b) => a.distance - b.distance) // 距離順にソート
}

/**
 * 距離を読みやすい形式にフォーマット
 * @param distance 距離（メートル）
 * @returns フォーマットされた文字列
 */
export function formatDistance(distance: number): string {
  if (distance < 1000) {
    return `${Math.round(distance)}m`
  }
  return `${(distance / 1000).toFixed(1)}km`
}

/**
 * 方角を読みやすい形式にフォーマット
 * @param bearing 方角（度、0-360）
 * @returns フォーマットされた文字列（例: "北東"）
 */
export function formatBearing(bearing: number): string {
  const directions = [
    "北",
    "北北東",
    "北東",
    "東北東",
    "東",
    "東南東",
    "南東",
    "南南東",
    "南",
    "南南西",
    "南西",
    "西南西",
    "西",
    "西北西",
    "北西",
    "北北西",
  ]
  const index = Math.round(bearing / 22.5) % 16
  return directions[index]
}

