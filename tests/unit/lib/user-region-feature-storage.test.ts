import { beforeEach, describe, expect, it } from "vitest"
import {
  ALERTS_REGION_STORAGE_KEY,
  CITY_STORAGE_KEY,
  NATIONWIDE,
  REGION_STORAGE_KEY,
  REPORT_REGION_STORAGE_KEY,
  SCHOOL_DISTRICT_STORAGE_KEY,
  getReportRegionCity,
  getStoredAlertsRegion,
  getStoredCity,
  getStoredRegion,
  getStoredReportRegion,
  getStoredSchoolDistrict,
  setStoredAlertsRegion,
  setStoredReportRegion,
} from "@/lib/user-region"

const stored = (key: string) => {
  const raw = window.localStorage.getItem(key)
  return raw === null ? null : JSON.parse(raw)
}

function seedLegacy({ prefecture, city, district }: {
  prefecture?: string
  city?: { prefecture: string; city: string }
  district?: { prefecture: string; city: string; id: string }
}) {
  if (prefecture) window.localStorage.setItem(REGION_STORAGE_KEY, prefecture)
  if (city) window.localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify(city))
  if (district) window.localStorage.setItem(SCHOOL_DISTRICT_STORAGE_KEY, JSON.stringify(district))
}

describe("地域アラートの選択(専用キー)", () => {
  beforeEach(() => window.localStorage.clear())

  it("専用キーが無ければ旧共有キーから一度だけ引き継ぎ、専用キーへ書く", () => {
    seedLegacy({
      prefecture: "東京都",
      city: { prefecture: "東京都", city: "新宿区" },
      district: { prefecture: "東京都", city: "新宿区", id: "13104:B1" },
    })

    expect(getStoredAlertsRegion()).toEqual({ prefecture: "東京都", city: "新宿区", schoolDistrictId: "13104:B1" })
    expect(stored(ALERTS_REGION_STORAGE_KEY)).toEqual({ prefecture: "東京都", city: "新宿区", schoolDistrictId: "13104:B1" })

    // 移行後は旧キーが他の機能に書き換えられても読まない
    window.localStorage.setItem(REGION_STORAGE_KEY, "大阪府")
    window.localStorage.setItem(CITY_STORAGE_KEY, JSON.stringify({ prefecture: "大阪府", city: "大阪市" }))
    window.localStorage.removeItem(SCHOOL_DISTRICT_STORAGE_KEY)
    expect(getStoredAlertsRegion()).toEqual({ prefecture: "東京都", city: "新宿区", schoolDistrictId: "13104:B1" })
  })

  it("引き継ぎは旧キーを消さない・書き換えない(他の機能と旧版のため)", () => {
    seedLegacy({
      prefecture: "東京都",
      city: { prefecture: "東京都", city: "港区" },
      district: { prefecture: "東京都", city: "新宿区", id: "13104:B1" },
    })

    getStoredAlertsRegion()

    expect(getStoredRegion()).toBe("東京都")
    expect(getStoredCity("東京都")).toBe("港区")
    expect(getStoredSchoolDistrict("東京都", "新宿区")).toBe("13104:B1")
  })

  it("小学校区の旧キー(地域アラートだけが書いていた)は、共有の県・市町村キーより優先して引き継ぐ", () => {
    // 報告フィルタが共有キーを大阪府・大阪市へ書き換えた後でも、アラートの最後の選択を復元する
    seedLegacy({
      prefecture: "大阪府",
      city: { prefecture: "大阪府", city: "大阪市" },
      district: { prefecture: "東京都", city: "新宿区", id: "13104:B1" },
    })

    expect(getStoredAlertsRegion()).toEqual({ prefecture: "東京都", city: "新宿区", schoolDistrictId: "13104:B1" })
  })

  it("小学校区の旧キーが無ければ、共有の県と同じ県の市町村だけを引き継ぐ", () => {
    seedLegacy({ prefecture: "東京都", city: { prefecture: "東京都", city: "新宿区" } })
    expect(getStoredAlertsRegion()).toEqual({ prefecture: "東京都", city: "新宿区", schoolDistrictId: null })

    window.localStorage.clear()
    seedLegacy({ prefecture: "東京都", city: { prefecture: "大阪府", city: "大阪市" } })
    expect(getStoredAlertsRegion()).toEqual({ prefecture: "東京都", city: null, schoolDistrictId: null })
  })

  it("旧キーも無い・全国なら未選択として専用キーを作り、以後は旧キーを読まない", () => {
    seedLegacy({ prefecture: NATIONWIDE })
    expect(getStoredAlertsRegion()).toEqual({ prefecture: "", city: null, schoolDistrictId: null })
    expect(stored(ALERTS_REGION_STORAGE_KEY)).toEqual({ prefecture: "", city: null, schoolDistrictId: null })

    window.localStorage.setItem(REGION_STORAGE_KEY, "東京都")
    expect(getStoredAlertsRegion().prefecture).toBe("")
  })

  it("壊れた専用キーは未選択として扱い、旧キーへ戻らない", () => {
    seedLegacy({ prefecture: "東京都" })
    window.localStorage.setItem(ALERTS_REGION_STORAGE_KEY, "{broken")
    expect(getStoredAlertsRegion()).toEqual({ prefecture: "", city: null, schoolDistrictId: null })

    window.localStorage.setItem(ALERTS_REGION_STORAGE_KEY, JSON.stringify({ prefecture: "架空県", city: "どこか市", schoolDistrictId: "x" }))
    expect(getStoredAlertsRegion()).toEqual({ prefecture: "", city: null, schoolDistrictId: null })

    window.localStorage.setItem(ALERTS_REGION_STORAGE_KEY, JSON.stringify({ prefecture: "東京都", city: "新宿区", schoolDistrictId: "x".repeat(161) }))
    expect(getStoredAlertsRegion()).toEqual({ prefecture: "東京都", city: "新宿区", schoolDistrictId: null })
  })

  it("保存は専用キーだけに書き、共有キーには触れない", () => {
    seedLegacy({ prefecture: "大阪府", city: { prefecture: "大阪府", city: "大阪市" } })

    setStoredAlertsRegion({ prefecture: "東京都", city: "新宿区", schoolDistrictId: "13104:B1" })

    expect(stored(ALERTS_REGION_STORAGE_KEY)).toEqual({ prefecture: "東京都", city: "新宿区", schoolDistrictId: "13104:B1" })
    expect(window.localStorage.getItem(REGION_STORAGE_KEY)).toBe("大阪府")
    expect(stored(CITY_STORAGE_KEY)).toEqual({ prefecture: "大阪府", city: "大阪市" })
  })

  it("市区町村の無い小学校区や県の無い市区町村は保存しない", () => {
    setStoredAlertsRegion({ prefecture: "", city: "新宿区", schoolDistrictId: "13104:B1" })
    expect(stored(ALERTS_REGION_STORAGE_KEY)).toEqual({ prefecture: "", city: null, schoolDistrictId: null })

    setStoredAlertsRegion({ prefecture: "東京都", city: null, schoolDistrictId: "13104:B1" })
    expect(stored(ALERTS_REGION_STORAGE_KEY)).toEqual({ prefecture: "東京都", city: null, schoolDistrictId: null })
  })
})

describe("報告一覧の地域フィルタの選択(専用キー)", () => {
  beforeEach(() => window.localStorage.clear())

  it("専用キーが無ければ旧共有キー(県・市町村)を一度だけ引き継ぐ", () => {
    seedLegacy({ prefecture: "大阪府", city: { prefecture: "東京都", city: "港区" } })

    const region = getStoredReportRegion()

    expect(region).toEqual({ prefecture: "大阪府", lastCity: { prefecture: "東京都", city: "港区" } })
    expect(stored(REPORT_REGION_STORAGE_KEY)).toEqual(region)
    // 旧キーはそのまま
    expect(getStoredRegion()).toBe("大阪府")
    expect(getStoredCity("東京都")).toBe("港区")

    window.localStorage.setItem(REGION_STORAGE_KEY, "北海道")
    window.localStorage.removeItem(CITY_STORAGE_KEY)
    expect(getStoredReportRegion()).toEqual(region)
  })

  it("未保存なら全国・市町村なし", () => {
    expect(getStoredReportRegion()).toEqual({ prefecture: NATIONWIDE, lastCity: null })
  })

  it("壊れた値・知らない県は全国・市町村なしへ正規化する", () => {
    window.localStorage.setItem(REPORT_REGION_STORAGE_KEY, "{broken")
    expect(getStoredReportRegion()).toEqual({ prefecture: NATIONWIDE, lastCity: null })

    window.localStorage.setItem(
      REPORT_REGION_STORAGE_KEY,
      JSON.stringify({ prefecture: "架空県", lastCity: { prefecture: "架空県", city: "どこか市" } }),
    )
    expect(getStoredReportRegion()).toEqual({ prefecture: NATIONWIDE, lastCity: null })
  })

  it("保存は専用キーだけに書き、地域アラートや共有キーには触れない", () => {
    setStoredAlertsRegion({ prefecture: "東京都", city: "新宿区", schoolDistrictId: "13104:B1" })
    seedLegacy({ prefecture: "東京都", city: { prefecture: "東京都", city: "新宿区" } })

    setStoredReportRegion({ prefecture: "大阪府", lastCity: { prefecture: "大阪府", city: "大阪市" } })

    expect(stored(REPORT_REGION_STORAGE_KEY)).toEqual({ prefecture: "大阪府", lastCity: { prefecture: "大阪府", city: "大阪市" } })
    expect(stored(ALERTS_REGION_STORAGE_KEY)).toEqual({ prefecture: "東京都", city: "新宿区", schoolDistrictId: "13104:B1" })
    expect(window.localStorage.getItem(REGION_STORAGE_KEY)).toBe("東京都")
    expect(stored(CITY_STORAGE_KEY)).toEqual({ prefecture: "東京都", city: "新宿区" })
  })

  it("最後に選んだ市町村は同じ県のときだけ使う", () => {
    const lastCity = { prefecture: "東京都", city: "港区" }
    expect(getReportRegionCity(lastCity, "東京都")).toBe("港区")
    expect(getReportRegionCity(lastCity, "大阪府")).toBeNull()
    expect(getReportRegionCity(lastCity, NATIONWIDE)).toBeNull()
    expect(getReportRegionCity(null, "東京都")).toBeNull()
  })
})
