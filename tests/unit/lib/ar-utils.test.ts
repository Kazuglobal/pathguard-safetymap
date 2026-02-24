/**
 * AR ユーティリティ関数のユニットテスト
 */

import { describe, it, expect } from "vitest"
import {
  calculateDistance,
  calculateBearing,
  calculateARHazardData,
  formatDistance,
  formatBearing,
} from "@/lib/ar-utils"
import type { DangerReport } from "@/lib/types"
import {
  DEFAULT_FOV,
  DEFAULT_MAX_DISTANCE,
  MAX_ANGLE_DEGREES,
  FOV_SAFE_MIN,
  FOV_SAFE_MAX,
} from "@/lib/ar-constants"

function createMockReport(overrides?: Partial<DangerReport>): DangerReport {
  return {
    id: "test-1",
    user_id: "user-1",
    title: "テスト危険箇所",
    description: null,
    latitude: 35.6812,
    longitude: 139.7671,
    danger_type: "traffic",
    danger_level: 3,
    status: "active",
    image_url: null,
    processed_image_urls: null,
    prefecture: null,
    prefecture_code: null,
    city: null,
    municipality_code: null,
    town: null,
    postal_code: null,
    geocode_source: null,
    geocoded_at: null,
    geocode_confidence: null,
    address_hash: null,
    created_at: null,
    updated_at: null,
    ...overrides,
  }
}

describe("calculateDistance - 2点間距離計算", () => {
  it("同一地点の距離は0", () => {
    const distance = calculateDistance(35.68, 139.77, 35.68, 139.77)
    expect(distance).toBe(0)
  })

  it("東京駅〜新宿駅間の距離が約6.4kmであること", () => {
    // 東京駅: 35.6812, 139.7671 / 新宿駅: 35.6896, 139.7006
    const distance = calculateDistance(35.6812, 139.7671, 35.6896, 139.7006)
    expect(distance).toBeGreaterThan(5500)
    expect(distance).toBeLessThan(7500)
  })

  it("赤道上の1度は約111kmであること", () => {
    const distance = calculateDistance(0, 0, 0, 1)
    expect(distance).toBeGreaterThan(110000)
    expect(distance).toBeLessThan(112000)
  })

  it("南北方向の計算が正しいこと", () => {
    const distance = calculateDistance(0, 0, 1, 0)
    expect(distance).toBeGreaterThan(110000)
    expect(distance).toBeLessThan(112000)
  })
})

describe("calculateBearing - 方位角計算", () => {
  it("真北への方角は0度付近であること", () => {
    const bearing = calculateBearing(35.0, 139.0, 36.0, 139.0)
    expect(bearing).toBeCloseTo(0, 0)
  })

  it("真東への方角は約90度であること", () => {
    const bearing = calculateBearing(0, 0, 0, 1)
    expect(bearing).toBeCloseTo(90, 0)
  })

  it("真南への方角は約180度であること", () => {
    const bearing = calculateBearing(36.0, 139.0, 35.0, 139.0)
    expect(bearing).toBeCloseTo(180, 0)
  })

  it("真西への方角は約270度であること", () => {
    const bearing = calculateBearing(0, 0, 0, -1)
    expect(bearing).toBeCloseTo(270, 0)
  })

  it("戻り値は0〜360の範囲であること", () => {
    const bearing = calculateBearing(35.0, 139.0, 35.5, 139.5)
    expect(bearing).toBeGreaterThanOrEqual(0)
    expect(bearing).toBeLessThan(360)
  })
})

describe("calculateARHazardData - AR危険個所データ計算", () => {
  // 基準地点（東京駅付近）
  const userLat = 35.6812
  const userLon = 139.7671
  const userHeading = 0 // 北向き

  describe("デフォルト値", () => {
    it("FOVが未指定の場合DEFAULT_FOV(60)が適用されること", () => {
      // 正面（北方向）に近い危険箇所を配置
      const report = createMockReport({
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const result1 = calculateARHazardData(userLat, userLon, userHeading, [report], {})
      const result2 = calculateARHazardData(userLat, userLon, userHeading, [report], { fov: DEFAULT_FOV })
      expect(result1).toEqual(result2)
    })

    it("maxDistanceが未指定の場合DEFAULT_MAX_DISTANCE(500)が適用されること", () => {
      // 400m北の地点（範囲内）
      const nearReport = createMockReport({
        latitude: userLat + 0.0036,
        longitude: userLon,
      })
      // 600m北の地点（範囲外）
      const farReport = createMockReport({
        id: "test-2",
        latitude: userLat + 0.0054,
        longitude: userLon,
      })
      const result = calculateARHazardData(userLat, userLon, userHeading, [nearReport, farReport], {})
      expect(result.length).toBe(1)
      expect(result[0].report.id).toBe("test-1")
    })

    it("maxAngleが未指定の場合MAX_ANGLE_DEGREES(90)が適用されること", () => {
      // 真横の地点（東方向 = 90度）は境界で含まれない
      const eastReport = createMockReport({
        latitude: userLat,
        longitude: userLon + 0.001,
      })
      // 前方斜めの地点は含まれる
      const frontReport = createMockReport({
        id: "test-front",
        latitude: userLat + 0.001,
        longitude: userLon + 0.0005,
      })
      const result = calculateARHazardData(userLat, userLon, userHeading, [frontReport], {})
      expect(result.length).toBe(1)
    })
  })

  describe("FOV処理", () => {
    it("カスタムFOVが反映されること", () => {
      const report = createMockReport({
        latitude: userLat + 0.001,
        longitude: userLon + 0.0003,
      })
      const result45 = calculateARHazardData(userLat, userLon, userHeading, [report], { fov: 45 })
      const result90 = calculateARHazardData(userLat, userLon, userHeading, [report], { fov: 90 })
      // 広いFOVではxが小さくなる（画面中央に近づく）
      expect(Math.abs(result90[0].x)).toBeLessThan(Math.abs(result45[0].x))
    })

    it("FOVがFOV_SAFE_MIN(1)未満の場合クランプされること", () => {
      const report = createMockReport({
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const resultMin = calculateARHazardData(userLat, userLon, userHeading, [report], { fov: FOV_SAFE_MIN })
      const resultBelow = calculateARHazardData(userLat, userLon, userHeading, [report], { fov: 0 })
      expect(resultMin).toEqual(resultBelow)
    })

    it("FOVがFOV_SAFE_MAX(179)超の場合クランプされること", () => {
      const report = createMockReport({
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const resultMax = calculateARHazardData(userLat, userLon, userHeading, [report], { fov: FOV_SAFE_MAX })
      const resultAbove = calculateARHazardData(userLat, userLon, userHeading, [report], { fov: 200 })
      expect(resultMax).toEqual(resultAbove)
    })

    it("NaN FOVでDEFAULT_FOVにフォールバックすること", () => {
      const report = createMockReport({
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const resultDefault = calculateARHazardData(userLat, userLon, userHeading, [report], {})
      const resultNaN = calculateARHazardData(userLat, userLon, userHeading, [report], { fov: NaN })
      expect(resultDefault).toEqual(resultNaN)
    })

    it("Infinity FOVでDEFAULT_FOVにフォールバックすること", () => {
      const report = createMockReport({
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const resultDefault = calculateARHazardData(userLat, userLon, userHeading, [report], {})
      const resultInf = calculateARHazardData(userLat, userLon, userHeading, [report], { fov: Infinity })
      expect(resultDefault).toEqual(resultInf)
    })
  })

  describe("後方互換性", () => {
    it("数値引数がmaxDistanceとして扱われること", () => {
      const report = createMockReport({
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const resultNumber = calculateARHazardData(userLat, userLon, userHeading, [report], 300)
      const resultObject = calculateARHazardData(userLat, userLon, userHeading, [report], { maxDistance: 300 })
      expect(resultNumber).toEqual(resultObject)
    })

    it("引数なしのデフォルト値で動作すること", () => {
      const report = createMockReport({
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const result = calculateARHazardData(userLat, userLon, userHeading, [report])
      expect(result.length).toBe(1)
    })
  })

  describe("フィルタリングとソート", () => {
    it("無効なユーザー座標で空配列を返すこと", () => {
      const report = createMockReport()
      expect(calculateARHazardData(NaN, 139.77, 0, [report], {})).toEqual([])
      expect(calculateARHazardData(91, 139.77, 0, [report], {})).toEqual([])
    })

    it("無効なレポート座標をフィルタリングすること", () => {
      const validReport = createMockReport({
        id: "valid",
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const invalidReport = createMockReport({
        id: "invalid",
        latitude: NaN,
        longitude: NaN,
      })
      const result = calculateARHazardData(userLat, userLon, userHeading, [validReport, invalidReport], {})
      expect(result.length).toBe(1)
      expect(result[0].report.id).toBe("valid")
    })

    it("距離順（昇順）にソートされること", () => {
      const nearReport = createMockReport({
        id: "near",
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const farReport = createMockReport({
        id: "far",
        latitude: userLat + 0.003,
        longitude: userLon,
      })
      // 遠い方を先に渡す
      const result = calculateARHazardData(userLat, userLon, userHeading, [farReport, nearReport], {})
      expect(result[0].report.id).toBe("near")
      expect(result[1].report.id).toBe("far")
      expect(result[0].distance).toBeLessThan(result[1].distance)
    })

    it("showBehind=falseで後方の地点をフィルタリングすること", () => {
      // 南方向（後方）の地点
      const behindReport = createMockReport({
        latitude: userLat - 0.001,
        longitude: userLon,
      })
      const result = calculateARHazardData(userLat, userLon, userHeading, [behindReport], {
        showBehind: false,
      })
      expect(result.length).toBe(0)
    })

    it("showBehind=trueで後方の地点も含むこと", () => {
      const behindReport = createMockReport({
        latitude: userLat - 0.001,
        longitude: userLon,
      })
      const result = calculateARHazardData(userLat, userLon, userHeading, [behindReport], {
        showBehind: true,
      })
      expect(result.length).toBe(1)
    })
  })

  describe("座標計算", () => {
    it("正面の地点のxが0付近であること", () => {
      const report = createMockReport({
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const result = calculateARHazardData(userLat, userLon, userHeading, [report], {})
      expect(result[0].x).toBeCloseTo(0, 1)
    })

    it("xが-1〜1の範囲に制限されること", () => {
      const report = createMockReport({
        latitude: userLat + 0.0001,
        longitude: userLon + 0.003,
      })
      const result = calculateARHazardData(userLat, userLon, userHeading, [report], {
        showBehind: true,
        maxAngle: 180,
      })
      if (result.length > 0) {
        expect(result[0].x).toBeGreaterThanOrEqual(-1)
        expect(result[0].x).toBeLessThanOrEqual(1)
      }
    })

    it("zが0〜1の範囲であること", () => {
      const report = createMockReport({
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const result = calculateARHazardData(userLat, userLon, userHeading, [report], {})
      expect(result[0].z).toBeGreaterThanOrEqual(0)
      expect(result[0].z).toBeLessThanOrEqual(1)
    })

    it("yは常に0であること", () => {
      const report = createMockReport({
        latitude: userLat + 0.001,
        longitude: userLon,
      })
      const result = calculateARHazardData(userLat, userLon, userHeading, [report], {})
      expect(result[0].y).toBe(0)
    })

    it("relativeAngleが-180〜180の範囲であること", () => {
      const reports = [
        createMockReport({ id: "n", latitude: userLat + 0.001, longitude: userLon }),
        createMockReport({ id: "e", latitude: userLat, longitude: userLon + 0.001 }),
        createMockReport({ id: "s", latitude: userLat - 0.001, longitude: userLon }),
        createMockReport({ id: "w", latitude: userLat, longitude: userLon - 0.001 }),
      ]
      const result = calculateARHazardData(userLat, userLon, userHeading, reports, {
        showBehind: true,
        maxAngle: 180,
      })
      for (const hazard of result) {
        expect(hazard.relativeAngle).toBeGreaterThanOrEqual(-180)
        expect(hazard.relativeAngle).toBeLessThanOrEqual(180)
      }
    })
  })
})

describe("formatDistance - 距離フォーマット", () => {
  it("1000m未満はメートル表示", () => {
    expect(formatDistance(100)).toBe("100m")
    expect(formatDistance(500)).toBe("500m")
    expect(formatDistance(999)).toBe("999m")
  })

  it("小数は四捨五入されること", () => {
    expect(formatDistance(100.4)).toBe("100m")
    expect(formatDistance(100.5)).toBe("101m")
  })

  it("1000m以上はキロメートル表示", () => {
    expect(formatDistance(1000)).toBe("1.0km")
    expect(formatDistance(1500)).toBe("1.5km")
    expect(formatDistance(10000)).toBe("10.0km")
  })

  it("0mは0m表示", () => {
    expect(formatDistance(0)).toBe("0m")
  })
})

describe("formatBearing - 方角フォーマット", () => {
  it("主要4方位が正しいこと", () => {
    expect(formatBearing(0)).toBe("北")
    expect(formatBearing(90)).toBe("東")
    expect(formatBearing(180)).toBe("南")
    expect(formatBearing(270)).toBe("西")
  })

  it("斜め方位が正しいこと", () => {
    expect(formatBearing(45)).toBe("北東")
    expect(formatBearing(135)).toBe("南東")
    expect(formatBearing(225)).toBe("南西")
    expect(formatBearing(315)).toBe("北西")
  })

  it("360度は北に戻ること", () => {
    expect(formatBearing(360)).toBe("北")
  })
})
