import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { markSpotGuideSeen, shouldShowSpotGuide } from "@/lib/spot-guide-storage"

describe("spot-guide-storage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("まだ見ていなければ出す", () => {
    expect(shouldShowSpotGuide("map")).toBe(true)
    expect(shouldShowSpotGuide("ar")).toBe(true)
  })

  it("見たあとは出さない。地図とARは別に覚える", () => {
    markSpotGuideSeen("map")

    expect(shouldShowSpotGuide("map")).toBe(false)
    expect(shouldShowSpotGuide("ar")).toBe(true)
  })

  it("古い版の記録や、こわれた記録では、もう一度出す/出さないを安全側に決める", () => {
    localStorage.setItem("pathguard-map-guide", JSON.stringify({ version: 0 }))
    expect(shouldShowSpotGuide("map")).toBe(true)

    localStorage.setItem("pathguard-map-guide", JSON.stringify({ seenAt: "x" }))
    expect(shouldShowSpotGuide("map")).toBe(true)

    // 読めない記録は、毎回出てしまわないよう「出さない」
    localStorage.setItem("pathguard-map-guide", "{not json")
    expect(shouldShowSpotGuide("map")).toBe(false)
  })

  it("自動操作のブラウザ(E2E)では、まだ見ていなくても自分からは出さない", () => {
    // jsdom の navigator には webdriver が無いので、この検査のあいだだけ足す
    Object.defineProperty(navigator, "webdriver", { value: true, configurable: true })
    try {
      expect(shouldShowSpotGuide("map")).toBe(false)
      expect(shouldShowSpotGuide("map-details")).toBe(false)
      expect(shouldShowSpotGuide("ar")).toBe(false)
    } finally {
      Reflect.deleteProperty(navigator, "webdriver")
    }
    expect(shouldShowSpotGuide("map")).toBe(true)
  })

  it("保存先が使えないときは出さず、記録に失敗しても落ちない", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied")
    })

    expect(shouldShowSpotGuide("ar")).toBe(false)
    expect(() => markSpotGuideSeen("ar")).not.toThrow()
  })
})
