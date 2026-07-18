import { describe, expect, it } from "vitest"
import {
  PREVIEW_COORD_SLACK_KM,
  SCHOOL_RADIUS_KM,
  buildMunicipalityOptions,
  distanceKm,
  isWithinSchoolRadius,
  latLngBoundsForRadius,
} from "@/lib/region-filter"

describe("buildMunicipalityOptions", () => {
  it("空値・空白を除外して重複をまとめる", () => {
    const options = buildMunicipalityOptions([
      "千代田区",
      null,
      undefined,
      "  ",
      "千代田区",
      "青森市",
    ])
    expect(options).toEqual(["千代田区", "青森市"])
  })

  it("報告件数の多い順、同数は五十音順で並べる", () => {
    const options = buildMunicipalityOptions([
      "港区",
      "青森市",
      "港区",
      "渋谷区",
      "青森市",
      "港区",
    ])
    expect(options[0]).toBe("港区")
    // 青森市(あ)と渋谷区(し)は同数2件 → 五十音順で青森市が先
    expect(options.slice(1)).toEqual(["青森市", "渋谷区"])
  })

  it("入力が空なら空配列を返す", () => {
    expect(buildMunicipalityOptions([])).toEqual([])
  })
})

describe("latLngBoundsForRadius", () => {
  it("中心から対称な矩形を返し、日本の緯度では経度側の幅が広い", () => {
    const bounds = latLngBoundsForRadius(35.68, 139.76, 2)
    expect(bounds.maxLat - 35.68).toBeCloseTo(35.68 - bounds.minLat, 10)
    expect(bounds.maxLng - 139.76).toBeCloseTo(139.76 - bounds.minLng, 10)
    // 緯度2km ≒ 0.01797°
    expect(bounds.maxLat - bounds.minLat).toBeCloseTo((2 / 111.32) * 2, 4)
    // 経度は cos(35.68°) で割るぶん広くなる
    expect(bounds.maxLng - bounds.minLng).toBeGreaterThan(bounds.maxLat - bounds.minLat)
  })
})

describe("distanceKm", () => {
  it("同一地点は0", () => {
    expect(distanceKm(35.68, 139.76, 35.68, 139.76)).toBe(0)
  })

  it("東京駅→新宿駅はおよそ6.3km", () => {
    // 東京駅(35.6812,139.7671) → 新宿駅(35.6896,139.7006)
    const d = distanceKm(35.6812, 139.7671, 35.6896, 139.7006)
    expect(d).toBeGreaterThan(5.5)
    expect(d).toBeLessThan(7)
  })

  it("浮動小数点誤差が最大になる逆蹠点でも有限の距離を返す", () => {
    const d = distanceKm(0, 0, 0, 180)
    expect(Number.isFinite(d)).toBe(true)
    expect(d).toBeCloseTo(Math.PI * 6371, 6)
  })
})

describe("isWithinSchoolRadius", () => {
  const school = { id: "s1", name: "テスト小学校", latitude: 35.68, longitude: 139.76 }

  it("圏内(半径2km以内)は true", () => {
    // 約1.1km北
    expect(isWithinSchoolRadius({ latitude: 35.69, longitude: 139.76 }, school)).toBe(true)
  })

  it("半径+丸め許容幅を超える地点は false", () => {
    // 約5.5km北
    expect(isWithinSchoolRadius({ latitude: 35.73, longitude: 139.76 }, school)).toBe(false)
  })

  it("座標丸め許容幅ぶんは圏内として扱う", () => {
    // 半径ちょうど+許容幅の内側(約2.5km北 ≒ 0.0225°)
    const withinSlack = { latitude: 35.68 + 2.5 / 111.32, longitude: 139.76 }
    expect(SCHOOL_RADIUS_KM + PREVIEW_COORD_SLACK_KM).toBeGreaterThan(2.5)
    expect(isWithinSchoolRadius(withinSlack, school)).toBe(true)
  })

  it("座標が null の報告は false", () => {
    expect(isWithinSchoolRadius({ latitude: null, longitude: 139.76 }, school)).toBe(false)
    expect(isWithinSchoolRadius({ latitude: 35.68, longitude: null }, school)).toBe(false)
  })
})
