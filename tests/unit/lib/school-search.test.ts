import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { matchesSchoolCategory, searchSchools } from "@/lib/school-search"

const fetchMock = vi.fn()

function schoolFeature(
  overrides: { geometry?: unknown; properties?: Record<string, unknown> } = {},
) {
  return {
    id: "poi-1",
    geometry: overrides.geometry ?? { coordinates: [139.76, 35.68] },
    properties: {
      name: "テスト小学校",
      full_address: "東京都千代田区1-1",
      feature_type: "poi",
      poi_category: ["elementary_school"],
      ...(overrides.properties ?? {}),
    },
  }
}

describe("matchesSchoolCategory", () => {
  it("学校カテゴリを含めば true", () => {
    expect(matchesSchoolCategory(["restaurant", "elementary_school"])).toBe(true)
  })

  it("学校カテゴリが無ければ false", () => {
    expect(matchesSchoolCategory(["restaurant", "cafe"])).toBe(false)
    expect(matchesSchoolCategory([])).toBe(false)
  })
})

describe("searchSchools", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "pk.test-token")
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("トークン未設定なら throw する", async () => {
    vi.stubEnv("NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN", "")
    await expect(searchSchools("テスト小学校")).rejects.toThrow(
      "NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN",
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("学校POIを座標付きの結果へ変換する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ features: [schoolFeature()] }),
    })

    const results = await searchSchools("テスト小学校")

    expect(results).toEqual([
      {
        id: "poi-1",
        name: "テスト小学校",
        address: "東京都千代田区1-1",
        longitude: 139.76,
        latitude: 35.68,
      },
    ])
    const requestedUrl = String(fetchMock.mock.calls[0][0])
    expect(requestedUrl).toContain("search/searchbox/v1/forward")
    expect(requestedUrl).toContain("country=JP")
    expect(requestedUrl).toContain("types=poi")
  })

  it("学校カテゴリでも学校名でもないPOIは除外する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          schoolFeature({
            properties: { name: "テストカフェ", poi_category: ["cafe"] },
          }),
        ],
      }),
    })

    await expect(searchSchools("テスト")).resolves.toEqual([])
  })

  it("カテゴリ未付与でも名称が学校なら含める", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          schoolFeature({
            properties: { name: "市立第一中学校", poi_category: [] },
          }),
        ],
      }),
    })

    const results = await searchSchools("第一中学校")
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe("市立第一中学校")
  })

  it("座標が欠けた feature は除外する", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [schoolFeature({ geometry: { coordinates: [139.76] } })],
      }),
    })

    await expect(searchSchools("テスト小学校")).resolves.toEqual([])
  })

  it("HTTPエラー時は throw する", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    await expect(searchSchools("テスト小学校")).rejects.toThrow("500")
  })
})
