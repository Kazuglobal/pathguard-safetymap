/**
 * Unit Tests: Danger Type Presentation
 *
 * 危険の種類の絵・ラベルの一元定義。
 *
 * Target: lib/map/danger-type-presentation.ts
 */

import { describe, it, expect } from "vitest"
import {
  DANGER_TYPE_ORDER,
  getDangerTypePresentation,
} from "@/lib/map/danger-type-presentation"
import { buildPointPinSvg, PIN_PATH } from "@/lib/map/pin-shape"
import { getRouteHazardPresentation } from "@/lib/map/route-hazard-presentation"
import { getDangerLevelPresentation } from "@/lib/report-generation/danger-level-presentation"

describe("getDangerTypePresentation", () => {
  it.each([
    ["traffic", "交通"],
    ["crime", "犯罪"],
    ["disaster", "災害"],
    ["suspicious", "不審者"],
    ["other", "その他"],
  ])("%s は %s として表示する", (type, label) => {
    const presentation = getDangerTypePresentation(type)
    expect(presentation.id).toBe(type)
    expect(presentation.label).toBe(label)
  })

  it("種類ごとに別の絵を使う(絵だけで見分けられる)", () => {
    const icons = DANGER_TYPE_ORDER.map((id) => getDangerTypePresentation(id).icon)
    expect(new Set(icons).size).toBe(DANGER_TYPE_ORDER.length)
  })

  it.each([["unknown-type"], [""], [null], [undefined], ["toString"], ["__proto__"]])(
    "未知の種類 %s は「その他」にフォールバックする",
    (type) => {
      expect(getDangerTypePresentation(type).id).toBe("other")
    },
  )
})

describe("getRouteHazardPresentation", () => {
  it("洪水と津波は絵・色・ラベルがすべて異なる", () => {
    const flood = getRouteHazardPresentation("flood")
    const tsunami = getRouteHazardPresentation("tsunami")

    expect(flood.label).toBe("洪水")
    expect(tsunami.label).toBe("津波")
    expect(flood.icon).not.toBe(tsunami.icon)
    expect(flood.colorHex).not.toBe(tsunami.colorHex)
  })

  it("危険度ピンの色(黄〜赤)と同じ色を使わない", () => {
    const levelColors = [1, 2, 3, 4].map((level) => getDangerLevelPresentation(level).colorHex)
    for (const hazardType of ["flood", "tsunami"] as const) {
      expect(levelColors).not.toContain(getRouteHazardPresentation(hazardType).colorHex)
    }
  })
})

describe("buildPointPinSvg", () => {
  it("報告地点と送信済みで中の絵だけが変わる", () => {
    const select = buildPointPinSvg("select")
    const submitted = buildPointPinSvg("submitted")

    expect(select).toContain(PIN_PATH)
    expect(submitted).toContain(PIN_PATH)
    expect(select).not.toBe(submitted)
  })
})
