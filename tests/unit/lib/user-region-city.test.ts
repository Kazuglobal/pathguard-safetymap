import { beforeEach, describe, expect, it } from "vitest"
import {
  CITY_STORAGE_KEY,
  NATIONWIDE,
  getStoredCity,
  setStoredCity,
} from "@/lib/user-region"

describe("市町村の選択保存(getStoredCity / setStoredCity)", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("保存した市町村を同じ県で復元できる", () => {
    setStoredCity("東京都", "千代田区")
    expect(getStoredCity("東京都")).toBe("千代田区")
  })

  it("県が異なる場合は復元しない(県またぎの適用防止)", () => {
    setStoredCity("東京都", "千代田区")
    expect(getStoredCity("大阪府")).toBeNull()
  })

  it("null を保存すると削除される", () => {
    setStoredCity("東京都", "千代田区")
    setStoredCity("東京都", null)
    expect(window.localStorage.getItem(CITY_STORAGE_KEY)).toBeNull()
    expect(getStoredCity("東京都")).toBeNull()
  })

  it("全国や不正な県名では保存せず削除する", () => {
    setStoredCity("東京都", "千代田区")
    setStoredCity(NATIONWIDE, "千代田区")
    expect(window.localStorage.getItem(CITY_STORAGE_KEY)).toBeNull()

    setStoredCity("東京都", "千代田区")
    setStoredCity("架空県", "どこか市")
    expect(window.localStorage.getItem(CITY_STORAGE_KEY)).toBeNull()
  })

  it("壊れたJSONが保存されていても null を返す", () => {
    window.localStorage.setItem(CITY_STORAGE_KEY, "{broken json")
    expect(getStoredCity("東京都")).toBeNull()
  })

  it("未保存なら null", () => {
    expect(getStoredCity("東京都")).toBeNull()
  })
})
