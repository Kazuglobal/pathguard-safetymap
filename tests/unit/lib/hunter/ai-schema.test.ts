import { describe, expect, it } from "vitest"

import { validateHunterResponse } from "@/lib/hunter/ai-schema"

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

describe("validateHunterResponse", () => {
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
