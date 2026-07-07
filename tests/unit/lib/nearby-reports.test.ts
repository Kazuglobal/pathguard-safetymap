/**
 * Unit Tests: Nearby Reports Search
 *
 * 詳細モーダルの「この近くの他の報告」と事故ポップアップの
 * 「近くの報告を見る」が共用する近隣検索の検証。
 *
 * Target: lib/nearby-reports.ts
 */

import { describe, it, expect } from "vitest"
import {
  findNearbyReports,
  formatNearbyDistance,
  NEARBY_REPORTS_RADIUS_M,
  NEARBY_REPORTS_MAX,
} from "@/lib/nearby-reports"
import type { DangerReport } from "@/lib/types"

// 東京駅付近を基準にする。緯度0.001度 ≒ 111m
const BASE_LAT = 35.6812
const BASE_LNG = 139.7671

function makeReport(overrides: Partial<DangerReport> & { id: string }): DangerReport {
  return {
    title: `報告 ${overrides.id}`,
    description: null,
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    danger_type: "traffic",
    danger_level: 3,
    status: "approved",
    image_url: null,
    processed_image_url: null,
    processed_image_urls: null,
    created_at: "2026-07-01T00:00:00Z",
    user_id: "user-1",
    ...overrides,
  } as DangerReport
}

describe("findNearbyReports", () => {
  it("半径300m以内の報告を近い順に返す", () => {
    const reports = [
      makeReport({ id: "far", latitude: BASE_LAT + 0.01 }), // 約1.1km → 対象外
      makeReport({ id: "near-200m", latitude: BASE_LAT + 0.0018 }), // 約200m
      makeReport({ id: "near-50m", latitude: BASE_LAT + 0.00045 }), // 約50m
    ]

    const result = findNearbyReports({
      latitude: BASE_LAT,
      longitude: BASE_LNG,
      reports,
    })

    expect(result.map((r) => r.report.id)).toEqual(["near-50m", "near-200m"])
    expect(result[0].distanceM).toBeGreaterThan(30)
    expect(result[0].distanceM).toBeLessThan(70)
    expect(result[1].distanceM).toBeLessThanOrEqual(NEARBY_REPORTS_RADIUS_M)
  })

  it("excludeId(表示中の報告自身)を除外する", () => {
    const reports = [
      makeReport({ id: "self" }),
      makeReport({ id: "other", latitude: BASE_LAT + 0.0009 }),
    ]

    const result = findNearbyReports({
      latitude: BASE_LAT,
      longitude: BASE_LNG,
      reports,
      excludeId: "self",
    })

    expect(result.map((r) => r.report.id)).toEqual(["other"])
  })

  it("座標が不正な報告を除外する", () => {
    const reports = [
      makeReport({ id: "invalid-lat", latitude: 999 }),
      makeReport({ id: "nan", latitude: Number.NaN }),
      makeReport({ id: "valid", latitude: BASE_LAT + 0.0009 }),
    ]

    const result = findNearbyReports({
      latitude: BASE_LAT,
      longitude: BASE_LNG,
      reports,
    })

    expect(result.map((r) => r.report.id)).toEqual(["valid"])
  })

  it("基準点自体が不正なら空を返す", () => {
    const reports = [makeReport({ id: "any" })]
    expect(
      findNearbyReports({ latitude: Number.NaN, longitude: BASE_LNG, reports }),
    ).toEqual([])
  })

  it("最大件数(5件)で打ち切る(近い順に残る)", () => {
    const reports = Array.from({ length: 8 }, (_, i) =>
      makeReport({ id: `r-${i}`, latitude: BASE_LAT + 0.0002 * (i + 1) }),
    )

    const result = findNearbyReports({
      latitude: BASE_LAT,
      longitude: BASE_LNG,
      reports,
    })

    expect(result).toHaveLength(NEARBY_REPORTS_MAX)
    expect(result[0].report.id).toBe("r-0")
    expect(result[NEARBY_REPORTS_MAX - 1].report.id).toBe(`r-${NEARBY_REPORTS_MAX - 1}`)
  })

  it("不審者情報(danger_type=suspicious)も対象に含まれる", () => {
    const reports = [
      makeReport({ id: "sus", danger_type: "suspicious", latitude: BASE_LAT + 0.0009 }),
    ]

    const result = findNearbyReports({
      latitude: BASE_LAT,
      longitude: BASE_LNG,
      reports,
    })

    expect(result.map((r) => r.report.id)).toEqual(["sus"])
  })
})

describe("formatNearbyDistance", () => {
  it("10m未満は「すぐ近く」", () => {
    expect(formatNearbyDistance(0)).toBe("すぐ近く")
    expect(formatNearbyDistance(9)).toBe("すぐ近く")
  })

  it("10m以上は「約Nm」", () => {
    expect(formatNearbyDistance(10)).toBe("約10m")
    expect(formatNearbyDistance(250)).toBe("約250m")
  })
})
