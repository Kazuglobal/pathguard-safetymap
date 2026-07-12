import { describe, expect, it } from "vitest"

import { salvageRegionScale, validateHunterResponse } from "@/lib/hunter/ai-schema"

function rawPoint(overrides: Record<string, unknown> = {}) {
  return {
    kind: "blind_corner",
    kidType: "見通しの悪い角",
    region: { x: 0.4, y: 0.5, w: 0.2, h: 0.2 },
    severity: "high",
    confidence: 0.8,
    whyDangerous: "曲がってくる車から見えにくいよ",
    safeAction: "止まって左右を見よう",
    accidentLink: "出会い頭",
    quiz: {
      kind: "choice",
      question: "見通しの悪い角ではどうする？",
      choices: ["止まって左右を見る", "走ってぬける", "車は来ないと決める", "スマホを見る"],
      explanation: "止まれば気づけるよ",
    },
    ...overrides,
  }
}

describe("salvageRegionScale", () => {
  it("0〜1 の正当な region は変換しない(境界値 1.0 も素通し)", () => {
    const point = rawPoint({ region: { x: 1.0, y: 0.5, w: 1.0, h: 0.2 } })
    expect(salvageRegionScale(point)).toBe(point)
  })

  it("0〜1000 スケールの region は 4値すべて 1000 で割って差し替える", () => {
    const point = rawPoint({ region: { x: 400, y: 520, w: 180, h: 200 } })
    const out = salvageRegionScale(point) as { region: { x: number; y: number; w: number; h: number } }
    expect(out.region).toEqual({ x: 0.4, y: 0.52, w: 0.18, h: 0.2 })
  })

  it("文字列座標も数値化して変換する", () => {
    const point = rawPoint({ region: { x: "400", y: "520", w: "180", h: "200" } })
    const out = salvageRegionScale(point) as { region: { x: number } }
    expect(out.region.x).toBeCloseTo(0.4, 5)
  })

  it("region 欠落・非オブジェクト・数値化不能は素通しする", () => {
    const noRegion = rawPoint({ region: undefined })
    expect(salvageRegionScale(noRegion)).toBe(noRegion)
    expect(salvageRegionScale(null)).toBe(null)
    expect(salvageRegionScale("x")).toBe("x")
    const nanRegion = rawPoint({ region: { x: "abc", y: 500, w: 100, h: 100 } })
    expect(salvageRegionScale(nanRegion)).toBe(nanRegion)
  })

  it("入力オブジェクトを破壊しない(新オブジェクトを返す)", () => {
    const region = { x: 400, y: 520, w: 180, h: 200 }
    const point = rawPoint({ region })
    const out = salvageRegionScale(point)
    expect(out).not.toBe(point)
    expect(region.x).toBe(400) // 元は不変
  })
})

describe("validateHunterResponse", () => {
  it("salvages 0〜1000 scale regions instead of dropping every point", () => {
    const r = validateHunterResponse({
      dangerPoints: [rawPoint({ region: { x: 400, y: 520, w: 180, h: 200 } })],
    })
    expect(r.dangerPoints).toHaveLength(1)
    expect(r.dangerPoints[0].region).toEqual({ x: 0.4, y: 0.52, w: 0.18, h: 0.2 })
  })

  it("keeps string evidence, absorbs non-string evidence, and keeps the point either way", () => {
    const r = validateHunterResponse({
      dangerPoints: [
        rawPoint({ evidence: "角の へいが 車を かくす" }),
        rawPoint({ evidence: 12345, kind: "popout_spot" }),
        rawPoint({ kind: "flood_dip" }), // evidence 欠落
      ],
    })
    expect(r.dangerPoints).toHaveLength(3)
    expect(r.dangerPoints[0].evidence).toBe("角の へいが 車を かくす")
    expect(r.dangerPoints[1].evidence).toBeUndefined()
    expect(r.dangerPoints[2].evidence).toBeUndefined()
  })
  it("accepts a well-formed response", () => {
    const r = validateHunterResponse({
      version: "hunter-1",
      imageUsable: true,
      dangerPoints: [rawPoint()],
      noHazardFollow: null,
    })
    expect(r.imageUsable).toBe(true)
    expect(r.dangerPoints).toHaveLength(1)
    expect(r.dangerPoints[0].kind).toBe("blind_corner")
    expect(r.dangerPoints[0].quiz.choices).toHaveLength(4)
  })

  it("drops only points whose region cannot be recovered (quiz breakage is salvaged)", () => {
    const r = validateHunterResponse({
      dangerPoints: [
        rawPoint(),
        rawPoint({ region: undefined }), // broken beyond repair: no tap target -> dropped
        rawPoint({ quiz: undefined }), // salvaged: kept, sanitize supplies the kind fallback quiz
        rawPoint({ kind: "popout_spot" }),
      ],
    })
    expect(r.dangerPoints).toHaveLength(3)
    expect(r.dangerPoints.map((p) => p.kind)).toEqual(["blind_corner", "blind_corner", "popout_spot"])
  })

  it("coerces an unknown kind to 'other'", () => {
    const r = validateHunterResponse({ dangerPoints: [rawPoint({ kind: "ufo_landing" })] })
    expect(r.dangerPoints).toHaveLength(1)
    expect(r.dangerPoints[0].kind).toBe("other")
  })

  it("keeps a point whose quiz has fewer than 2 choices (quiz nulled, point salvaged)", () => {
    const r = validateHunterResponse({
      dangerPoints: [rawPoint({ quiz: { question: "?", choices: ["one"], explanation: "x" } })],
    })
    expect(r.dangerPoints).toHaveLength(1)
    // 壊れたクイズは undefined 化され、点は保持される(sanitize が kind 既定クイズで補完)。
    expect(r.dangerPoints[0].quiz).toBeUndefined()
  })

  it("coerces an uppercase / padded severity instead of dropping the point", () => {
    const r = validateHunterResponse({
      dangerPoints: [rawPoint({ severity: "High" }), rawPoint({ kind: "flood_dip", severity: " LOW " })],
    })
    expect(r.dangerPoints).toHaveLength(2)
    expect(r.dangerPoints[0].severity).toBe("high")
    expect(r.dangerPoints[1].severity).toBe("low")
  })

  it("nulls an out-of-enum severity but keeps the point (sanitize fills from kind)", () => {
    const r = validateHunterResponse({ dangerPoints: [rawPoint({ severity: "critical" })] })
    expect(r.dangerPoints).toHaveLength(1)
    expect(r.dangerPoints[0].severity).toBeUndefined()
  })

  it("does not let a stringy imageUsable collapse the danger points", () => {
    const r = validateHunterResponse({
      imageUsable: "true", // 文字列。旧実装ではトップ検証が全滅し dangerPoints=[] になっていた
      dangerPoints: [rawPoint(), rawPoint({ kind: "popout_spot" })],
    })
    expect(r.imageUsable).toBe(true)
    expect(r.dangerPoints).toHaveLength(2)
  })

  it("honors a stringy imageUsable=false", () => {
    const r = validateHunterResponse({ imageUsable: "false", dangerPoints: [rawPoint()] })
    expect(r.imageUsable).toBe(false)
  })

  it("ignores a mistyped version field without dropping the danger points", () => {
    const r = validateHunterResponse({ version: 1, dangerPoints: [rawPoint()] })
    expect(r.dangerPoints).toHaveLength(1)
  })

  it("distinguishes imageUsable=false", () => {
    const r = validateHunterResponse({ imageUsable: false, dangerPoints: [] })
    expect(r.imageUsable).toBe(false)
  })

  it("defaults imageUsable to true when absent (does not falsely mark unusable)", () => {
    expect(validateHunterResponse({ dangerPoints: [] }).imageUsable).toBe(true)
  })

  it("returns an empty, usable result for non-object input", () => {
    const r = validateHunterResponse(42)
    expect(r.imageUsable).toBe(true)
    expect(r.dangerPoints).toEqual([])
  })

  it("carries noHazardFollow when present", () => {
    const r = validateHunterResponse({ dangerPoints: [], noHazardFollow: "あんしんだね" })
    expect(r.noHazardFollow).toBe("あんしんだね")
  })
})
