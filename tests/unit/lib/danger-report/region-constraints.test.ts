import { describe, expect, it } from "vitest"

import { buildRegionConstraints } from "@/lib/danger-report/region-constraints"

function hazard(x: number, y: number, width = 0.1, height = 0.1, type = "cracked wall") {
  return { type, bbox: { x, y, width, height } }
}

describe("buildRegionConstraints", () => {
  it("ハザード0件・bbox全欠落では空文字を返す", () => {
    expect(buildRegionConstraints([])).toBe("")
    expect(buildRegionConstraints([{ type: "a" }, { type: "b", bbox: null }])).toBe("")
  })

  it("数値bboxと3x3グリッド位置語を併記する", () => {
    const out = buildRegionConstraints([hazard(0.05, 0.05)]) // 中心(0.1,0.1) → top-left
    expect(out).toContain("bbox=[0.050, 0.050, 0.100, 0.100]")
    expect(out).toContain("top-left")
    expect(out).toContain("label='cracked wall'")
  })

  it("グリッド語の境界: 中心が1/3・2/3をまたぐと列・行が切り替わる", () => {
    // cx = x + w/2。w=0 で中心を直接制御する
    expect(buildRegionConstraints([hazard(0.32, 0.5, 0, 0)])).toContain("middle-left")
    expect(buildRegionConstraints([hazard(0.34, 0.5, 0, 0)])).toContain("center")
    expect(buildRegionConstraints([hazard(0.7, 0.5, 0, 0)])).toContain("middle-right")
    // 行境界は中心列だと "center" に畳まれるため、非中心列(left)で確認する
    expect(buildRegionConstraints([hazard(0.1, 0.65, 0, 0)])).toContain("middle-left")
    expect(buildRegionConstraints([hazard(0.1, 0.67, 0, 0)])).toContain("bottom-left")
    expect(buildRegionConstraints([hazard(0.5, 0.67, 0, 0)])).toContain("bottom-center")
  })

  it("middle-center は 'center' 単独表記になる", () => {
    const out = buildRegionConstraints([hazard(0.45, 0.45)])
    expect(out).toContain("roughly the center of the frame")
    expect(out).not.toContain("middle-center")
  })

  it("優先順位文とアンカー接地文を含む(ヒントに過ぎず本文が優先)", () => {
    const out = buildRegionConstraints([hazard(0.1, 0.1)])
    expect(out).toContain("placement hints only")
    expect(out).toContain("the main instruction wins")
    expect(out).toContain("never move or re-render the object itself")
  })

  it("bbox欠落ハザードはスキップし、bbox保有分のみ連番になる", () => {
    const out = buildRegionConstraints([
      { type: "no-box" },
      hazard(0.1, 0.1, 0.1, 0.1, "first"),
      hazard(0.7, 0.7, 0.1, 0.1, "second"),
    ])
    expect(out).toContain("1) label='first'")
    expect(out).toContain("2) label='second'")
    expect(out).not.toContain("no-box")
  })
})
