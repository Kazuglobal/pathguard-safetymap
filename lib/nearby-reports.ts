/**
 * 近隣の危険報告の検索(純粋関数)
 *
 * 詳細モーダルの「この近くの他の報告」セクションと、事故ポップアップの
 * 「近くの報告を見る」導線の両方がこれを使う。半径は事故統計セクション
 * (useAccidentStats の radiusMeters=300)と同じ300mに揃える。
 */

import { calculateDistance } from "@/lib/ar-utils"
import { isValidCoordinates } from "@/lib/coordinates"
import type { DangerReport } from "@/lib/types"

/** 事故統計セクションと同じ検索半径(メートル) */
export const NEARBY_REPORTS_RADIUS_M = 300

/** セクションに表示する最大件数(多すぎるとモーダルが縦に伸びすぎる) */
export const NEARBY_REPORTS_MAX = 5

export interface NearbyReport {
  report: DangerReport
  /** 基準点からの距離(メートル、四捨五入) */
  distanceM: number
}

/**
 * 基準点から半径内にある他の報告を近い順に返す。
 * - excludeId(通常は表示中の報告自身)は除外
 * - 座標が不正な報告は除外
 */
export function findNearbyReports(params: {
  latitude: number
  longitude: number
  reports: DangerReport[]
  excludeId?: string
  radiusM?: number
  max?: number
}): NearbyReport[] {
  const {
    latitude,
    longitude,
    reports,
    excludeId,
    radiusM = NEARBY_REPORTS_RADIUS_M,
    max = NEARBY_REPORTS_MAX,
  } = params

  if (!isValidCoordinates(latitude, longitude)) return []

  const results: NearbyReport[] = []
  for (const report of reports) {
    if (excludeId && report.id === excludeId) continue
    if (!isValidCoordinates(report.latitude, report.longitude)) continue

    const distanceM = calculateDistance(latitude, longitude, report.latitude, report.longitude)
    if (distanceM > radiusM) continue

    results.push({ report, distanceM: Math.round(distanceM) })
  }

  results.sort((a, b) => a.distanceM - b.distanceM)
  return results.slice(0, max)
}

/** 距離の表示用フォーマット(例: 40m / 0m は「すぐ近く」) */
export function formatNearbyDistance(distanceM: number): string {
  if (distanceM < 10) return "すぐ近く"
  return `約${distanceM}m`
}
