import { describe, expect, it } from "vitest"

import type { RawDangerPoint, RawSafePoint } from "@/lib/hunter/ai-schema"
import {
  DISPLAY_CONF_MIN,
  MAX_HAZARDS,
  MAX_SAFE_POINTS,
  MIN_REGION,
  sanitizeDangerPoints,
  sanitizeSafePoints,
} from "@/lib/hunter/sanitize"
import {
  KID_COPY_BY_KIND,
  KID_LABEL_BY_KIND,
  KID_QUIZ_FALLBACK_BY_KIND,
  SAFE_POINT_FALLBACK,
} from "@/lib/hunter/kid-copy"

function point(overrides: Partial<RawDangerPoint> = {}): RawDangerPoint {
  return {
    kind: "blind_corner",
    region: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 },
    severity: "high",
    confidence: 0.8,
    whyDangerous: "曲がってくる車から見えにくいよ",
    safeAction: "止まって左右を見よう",
    accidentLink: "出会い頭",
    quiz: {
      question: "見通しの悪い角ではどうする？",
      choices: ["止まって左右を見る", "走ってぬける", "車は来ないと決める", "スマホを見る"],
      explanation: "止まれば気づけるよ",
    },
    ...overrides,
  }
}

const opt = { sessionId: "s1" }

describe("sanitizeDangerPoints — 的外れ正解の構造排除", () => {
  it("excludes a full-screen region (area too large)", () => {
    const { hazards } = sanitizeDangerPoints(
      [point({ region: { x: 0, y: 0, w: 1, h: 1 } })],
      opt,
    )
    expect(hazards).toHaveLength(0)
  })

  it("excludes a broad region that would make unrelated taps count", () => {
    const { hazards } = sanitizeDangerPoints(
      [point({ region: { x: 0.1, y: 0.2, w: 0.6, h: 0.5 } })], // area 0.30
      opt,
    )
    expect(hazards).toHaveLength(0)
  })

  it("excludes a tiny region (area too small)", () => {
    const { hazards } = sanitizeDangerPoints(
      [point({ region: { x: 0.4, y: 0.4, w: 0.05, h: 0.05 } })],
      opt,
    )
    expect(hazards).toHaveLength(0)
  })

  it("excludes points below the display confidence threshold", () => {
    const { hazards } = sanitizeDangerPoints(
      [point({ confidence: DISPLAY_CONF_MIN - 0.01 })],
      opt,
    )
    expect(hazards).toHaveLength(0)
  })

  it("merges IoU-overlapping points, keeping the higher severity×confidence", () => {
    const { hazards } = sanitizeDangerPoints(
      [
        point({ kind: "narrow_sidewalk", severity: "low", confidence: 0.9, region: { x: 0.42, y: 0.42, w: 0.2, h: 0.2 } }),
        point({ kind: "blind_corner", severity: "high", confidence: 0.9, region: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } }),
      ],
      opt,
    )
    expect(hazards).toHaveLength(1)
    expect(hazards[0].kind).toBe("blind_corner")
  })

  it("ranks by severity×confidence descending", () => {
    const { hazards } = sanitizeDangerPoints(
      [
        point({ kind: "narrow_sidewalk", severity: "low", confidence: 0.6, region: { x: 0.05, y: 0.05, w: 0.18, h: 0.18 } }),
        point({ kind: "blind_corner", severity: "high", confidence: 0.9, region: { x: 0.5, y: 0.5, w: 0.18, h: 0.18 } }),
        point({ kind: "parked_car_shadow", severity: "medium", confidence: 0.7, region: { x: 0.05, y: 0.6, w: 0.18, h: 0.18 } }),
      ],
      opt,
    )
    expect(hazards.map((h) => h.kind)).toEqual([
      "blind_corner",
      "parked_car_shadow",
      "narrow_sidewalk",
    ])
  })

  it("caps the number of hazards at MAX_HAZARDS", () => {
    const many: RawDangerPoint[] = Array.from({ length: 8 }, (_, i) =>
      point({ region: { x: (i % 4) * 0.24, y: Math.floor(i / 4) * 0.4, w: 0.18, h: 0.18 } }),
    )
    const { hazards } = sanitizeDangerPoints(many, opt)
    expect(hazards.length).toBeLessThanOrEqual(MAX_HAZARDS)
    expect(hazards).toHaveLength(MAX_HAZARDS)
  })

  it("expands a small region to the minimum size and clamps to the unit square", () => {
    const { hazards } = sanitizeDangerPoints(
      [point({ region: { x: 0.0, y: 0.0, w: 0.08, h: 0.08 } })],
      opt,
    )
    expect(hazards).toHaveLength(1)
    expect(hazards[0].region.w).toBeCloseTo(MIN_REGION, 5)
    expect(hazards[0].region.h).toBeCloseTo(MIN_REGION, 5)
    expect(hazards[0].region.x).toBeGreaterThanOrEqual(0)
    expect(hazards[0].region.y).toBeGreaterThanOrEqual(0)
    expect(hazards[0].region.x + hazards[0].region.w).toBeLessThanOrEqual(1.0001)
  })

  it("normalizes the display type from kind (ignores AI free-text kidType)", () => {
    const { hazards } = sanitizeDangerPoints(
      [point({ kind: "turning_car", kidType: "へんなラベル" })],
      opt,
    )
    expect(hazards[0].type).toBe(KID_LABEL_BY_KIND.turning_car)
  })

  it("replaces empty / english copy with verified kid copy", () => {
    const { hazards } = sanitizeDangerPoints(
      [point({ kind: "popout_spot", whyDangerous: "car popping out", safeAction: "   " })],
      opt,
    )
    expect(hazards[0].kidExplanation).toBe(KID_COPY_BY_KIND.popout_spot.whyDangerous)
    expect(hazards[0].safeAction).toBe(KID_COPY_BY_KIND.popout_spot.safeAction)
  })

  it("assigns stable sequential ids", () => {
    const { hazards } = sanitizeDangerPoints(
      [
        point({ region: { x: 0.05, y: 0.05, w: 0.18, h: 0.18 } }),
        point({ region: { x: 0.5, y: 0.5, w: 0.18, h: 0.18 } }),
      ],
      { sessionId: "abc" },
    )
    expect(hazards.map((h) => h.id)).toEqual(["abc-0", "abc-1"])
  })

  it("keeps a parallel quiz material for every kept hazard (place→choice guarantee)", () => {
    const { hazards, materials } = sanitizeDangerPoints(
      [
        point({ region: { x: 0.05, y: 0.05, w: 0.18, h: 0.18 } }),
        point({ region: { x: 0.5, y: 0.5, w: 0.18, h: 0.18 } }),
      ],
      opt,
    )
    expect(materials).toHaveLength(hazards.length)
    materials.forEach((m) => {
      expect(m.question.length).toBeGreaterThan(0)
      expect(m.choices.length).toBeGreaterThanOrEqual(2)
      expect(m.explanation.length).toBeGreaterThan(0)
    })
  })

  it("falls back to default severity from kind when missing", () => {
    const { hazards } = sanitizeDangerPoints(
      [point({ kind: "flood_dip", severity: undefined })],
      opt,
    )
    expect(hazards[0].severity).toBe("low")
  })

  it("routes accidentLink through the kid-safe whitelist (never raw AI text)", () => {
    const { hazards } = sanitizeDangerPoints([point({ accidentLink: "出会い頭" })], opt)
    expect(hazards[0].accidentLink).toBe("角での出会い頭")
  })

  it("maps unmatched/garbage accidentLink text to the generic kid-safe fallback", () => {
    const { hazards } = sanitizeDangerPoints(
      [point({ accidentLink: "some unexpected freeform english text" })],
      opt,
    )
    expect(hazards[0].accidentLink).toBe("交通事故")
    expect(hazards[0].accidentLink).not.toMatch(/[A-Za-z]/)
  })

  it("keeps accidentLink null when the AI omits it", () => {
    const { hazards } = sanitizeDangerPoints([point({ accidentLink: null })], opt)
    expect(hazards[0].accidentLink).toBeNull()
  })

  it("replaces an english quiz question with the verified kind fallback (never shown to a child)", () => {
    const { materials } = sanitizeDangerPoints(
      [
        point({
          kind: "popout_spot",
          confidence: 0.5, // -> choice-kind quiz item, not place
          quiz: {
            question: "What should you do near a blind spot?",
            choices: ["Stop and look both ways", "Run through quickly", "Close your eyes", "Just listen"],
            explanation: "Stopping helps you notice cars in time.",
          },
        }),
      ],
      opt,
    )
    expect(materials).toHaveLength(1)
    expect(materials[0]).toEqual(KID_QUIZ_FALLBACK_BY_KIND.popout_spot)
    expect(materials[0].question).not.toMatch(/[A-Za-z]/)
    materials[0].choices.forEach((c) => expect(c).not.toMatch(/[A-Za-z]/))
    expect(materials[0].explanation).not.toMatch(/[A-Za-z]/)
  })

  it("replaces the whole quiz when only one choice contains english (keeps question/choices/explanation in sync)", () => {
    const { materials } = sanitizeDangerPoints(
      [
        point({
          kind: "blind_corner",
          quiz: {
            question: "見通しの悪い角ではどうする？",
            choices: ["止まって左右を見る", "Run through quickly", "車は来ないと決める", "スマホを見る"],
            explanation: "止まれば気づけるよ",
          },
        }),
      ],
      opt,
    )
    expect(materials[0]).toEqual(KID_QUIZ_FALLBACK_BY_KIND.blind_corner)
  })

  it("replaces a quiz with an empty/whitespace-only explanation", () => {
    const { materials } = sanitizeDangerPoints(
      [point({ kind: "crossing_no_signal", quiz: { question: "どうする？", choices: ["a", "b"], explanation: "   " } })],
      opt,
    )
    expect(materials[0]).toEqual(KID_QUIZ_FALLBACK_BY_KIND.crossing_no_signal)
  })

  it("passes through a clean AI-provided quiz unchanged (trimmed)", () => {
    const { materials } = sanitizeDangerPoints(
      [
        point({
          kind: "narrow_sidewalk",
          quiz: {
            question: " せまい 歩道では どこを あるく？ ",
            choices: [" 道の はし ", "車道の まんなか", "はしりまわる", "目を つぶる"],
            explanation: " 車から はなれよう。 ",
          },
        }),
      ],
      opt,
    )
    expect(materials[0].question).toBe("せまい 歩道では どこを あるく？")
    expect(materials[0].choices[0]).toBe("道の はし")
    expect(materials[0].explanation).toBe("車から はなれよう。")
  })
})

function safePoint(overrides: Partial<RawSafePoint> = {}): RawSafePoint {
  return {
    kind: "narrow_sidewalk",
    kidType: "ガードレール",
    region: { x: 0.1, y: 0.1, w: 0.15, h: 0.15 },
    whyGood: "車から まもってくれるよ。",
    ...overrides,
  }
}

describe("sanitizeSafePoints (逆モード)", () => {
  it("keeps katakana labels and kid copy as-is", () => {
    const points = sanitizeSafePoints([safePoint()], opt)
    expect(points).toHaveLength(1)
    expect(points[0].type).toBe("ガードレール")
    expect(points[0].whyGood).toBe("車から まもってくれるよ。")
    expect(points[0].id).toBe("s1-safe-0")
  })

  it("replaces english / empty copy with the verified fallback", () => {
    const points = sanitizeSafePoints(
      [safePoint({ kidType: "guardrail", whyGood: "  " })],
      opt,
    )
    expect(points[0].type).toBe(SAFE_POINT_FALLBACK.type)
    expect(points[0].whyGood).toBe(SAFE_POINT_FALLBACK.whyGood)
  })

  it("drops points without a region and caps the count", () => {
    const many: RawSafePoint[] = [
      safePoint({ region: undefined }),
      ...Array.from({ length: 5 }, (_, i) =>
        safePoint({ region: { x: i * 0.15, y: 0.5, w: 0.12, h: 0.12 } }),
      ),
    ]
    const points = sanitizeSafePoints(many, opt)
    expect(points.length).toBeLessThanOrEqual(MAX_SAFE_POINTS)
  })

  it("excludes full-screen safe regions", () => {
    expect(sanitizeSafePoints([safePoint({ region: { x: 0, y: 0, w: 1, h: 1 } })], opt)).toHaveLength(0)
  })
})
