// =============================================
// きけんハンター ゴールデン回帰: 後処理パイプラインの品質固定
// 実写真→Gemini は非決定的なので、代表的な「生AI出力フィクスチャ」で
// validateHunterResponse → sanitizeDangerPoints → buildQuizItemsFromAi の
// 出力を固定測定し、プロンプト/sanitize 改修時の回帰を止める。
// ライブ品質の人手レビューは docs/plans/hunter-ai-eval-protocol.md。
// =============================================

import { describe, expect, it } from "vitest"

import { validateHunterResponse } from "@/lib/hunter/ai-schema"
import { MAX_HAZARDS, sanitizeDangerPoints } from "@/lib/hunter/sanitize"
import { buildQuizItemsFromAi } from "@/lib/hunter/quiz"
import { KID_COPY_BY_KIND, KID_LABEL_BY_KIND } from "@/lib/hunter/kid-copy"

import ideal from "./golden/ideal.json"
import duplicates from "./golden/duplicates.json"
import englishMixed from "./golden/english-mixed.json"
import giantBbox from "./golden/giant-bbox.json"
import lowConfidenceMixed from "./golden/low-confidence-mixed.json"
import empty from "./golden/empty.json"
import imageUnusable from "./golden/image-unusable.json"

/** route 相当の後処理(imageUsable ガートは route の責務なので別途確認)。 */
function runPipeline(raw: unknown, sessionId = "g") {
  const validated = validateHunterResponse(raw)
  const { hazards, materials } = sanitizeDangerPoints(validated.dangerPoints, { sessionId })
  const quiz = buildQuizItemsFromAi(hazards, materials)
  return { validated, hazards, materials, quiz }
}

const ASCII = /[A-Za-z]/

describe("golden: ideal", () => {
  const { hazards, quiz } = runPipeline(ideal)

  it("keeps all four distinct danger points, ranked by severity×confidence", () => {
    expect(hazards.map((h) => h.kind)).toEqual([
      "blind_corner",
      "popout_spot",
      "crossing_no_signal",
      "parked_car_shadow",
    ])
  })

  it("uses normalized kid labels and stable sequential ids", () => {
    hazards.forEach((h, i) => {
      expect(h.id).toBe(`g-${i}`)
      expect(h.type).toBe(KID_LABEL_BY_KIND[h.kind!])
    })
  })

  it("emits no english in kid-facing copy", () => {
    for (const h of hazards) {
      expect(h.kidExplanation).not.toMatch(ASCII)
      expect(h.safeAction).not.toMatch(ASCII)
    }
  })

  it("builds a mix of place and choice questions (capped at 3)", () => {
    expect(quiz).toHaveLength(3)
    expect(quiz.some((q) => q.kind === "place")).toBe(true)
    expect(quiz.some((q) => q.kind === "choice")).toBe(true)
  })
})

describe("golden: duplicates", () => {
  it("merges IoU-overlapping points, keeping the higher severity×confidence", () => {
    const { hazards } = runPipeline(duplicates)
    expect(hazards).toHaveLength(1)
    expect(hazards[0].kind).toBe("blind_corner")
  })
})

describe("golden: english-mixed", () => {
  it("replaces english copy with verified kid copy", () => {
    const { hazards } = runPipeline(englishMixed)
    expect(hazards).toHaveLength(1)
    expect(hazards[0].kidExplanation).toBe(KID_COPY_BY_KIND.popout_spot.whyDangerous)
    expect(hazards[0].safeAction).toBe(KID_COPY_BY_KIND.popout_spot.safeAction)
    expect(hazards[0].type).toBe(KID_LABEL_BY_KIND.popout_spot)
  })
})

describe("golden: giant-bbox", () => {
  it("excludes a near-full-screen region (off-target guard)", () => {
    const { hazards } = runPipeline(giantBbox)
    expect(hazards).toHaveLength(0)
  })
})

describe("golden: low-confidence-mixed", () => {
  it("drops points below the display confidence threshold", () => {
    const { hazards } = runPipeline(lowConfidenceMixed)
    expect(hazards).toHaveLength(1)
    expect(hazards[0].kind).toBe("crossing_no_signal")
  })
})

describe("golden: empty", () => {
  it("yields zero hazards (route converts this to guide:empty)", () => {
    const { hazards } = runPipeline(empty)
    expect(hazards).toHaveLength(0)
  })
})

describe("golden: image-unusable", () => {
  it("flags imageUsable=false (route converts this to guide:unusable)", () => {
    const { validated } = runPipeline(imageUnusable)
    expect(validated.imageUsable).toBe(false)
  })

  it("never exceeds the hazard cap on any fixture", () => {
    for (const raw of [ideal, duplicates, englishMixed, giantBbox, lowConfidenceMixed, empty, imageUnusable]) {
      const { hazards } = runPipeline(raw)
      expect(hazards.length).toBeLessThanOrEqual(MAX_HAZARDS)
    }
  })
})
