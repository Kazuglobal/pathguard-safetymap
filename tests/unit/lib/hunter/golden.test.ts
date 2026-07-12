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
import { KID_COPY_BY_KIND, KID_LABEL_BY_KIND, KID_QUIZ_FALLBACK_BY_KIND } from "@/lib/hunter/kid-copy"

import ideal from "./golden/ideal.json"
import duplicates from "./golden/duplicates.json"
import englishMixed from "./golden/english-mixed.json"
import giantBbox from "./golden/giant-bbox.json"
import lowConfidenceMixed from "./golden/low-confidence-mixed.json"
import empty from "./golden/empty.json"
import imageUnusable from "./golden/image-unusable.json"
// 現実的な破損フィクスチャ(旧パイプラインはこれらを丸ごとフォールバックへ落としていた)
import stringyImageUsable from "./golden/stringy-imageusable.json"
import uppercaseSeverity from "./golden/uppercase-severity.json"
import missingQuiz from "./golden/missing-quiz.json"
import messyRecoverable from "./golden/messy-recoverable.json"
import regionScaled1000 from "./golden/region-scaled-1000.json"
import evidencePassthrough from "./golden/evidence-passthrough.json"

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
    for (const raw of [
      ideal, duplicates, englishMixed, giantBbox, lowConfidenceMixed, empty, imageUnusable,
      stringyImageUsable, uppercaseSeverity, missingQuiz, messyRecoverable,
      regionScaled1000, evidencePassthrough,
    ]) {
      const { hazards } = runPipeline(raw)
      expect(hazards.length).toBeLessThanOrEqual(MAX_HAZARDS)
    }
  })
})

// ---------------------------------------------------------------------------
// サルベージ回帰: 「1フィールドの型崩れで全滅」していた破損応答を救い出す。
// 旧パイプライン(トップ検証の atomic 失敗 / 要素の全ドロップ)では、いずれも
// hazards=0 → route が guide(empty) フォールバックへ落としていた。
// ---------------------------------------------------------------------------
describe("salvage: stringy imageUsable no longer collapses the whole response", () => {
  it("recovers all three distinct danger points despite imageUsable:'true'", () => {
    const { validated, hazards } = runPipeline(stringyImageUsable)
    expect(validated.imageUsable).toBe(true)
    expect(hazards.map((h) => h.kind)).toEqual([
      "blind_corner",
      "popout_spot",
      "crossing_no_signal",
    ])
  })
})

describe("salvage: uppercase / padded severity is coerced, not dropped", () => {
  it("keeps both points and normalizes severity case", () => {
    const { hazards } = runPipeline(uppercaseSeverity)
    expect(hazards).toHaveLength(2)
    const bySeverity = Object.fromEntries(hazards.map((h) => [h.kind, h.severity]))
    expect(bySeverity.blind_corner).toBe("high")
    expect(bySeverity.turning_car).toBe("medium")
  })
})

describe("salvage: a point survives a missing / one-choice quiz", () => {
  it("keeps both points and substitutes the verified kind-default quiz", () => {
    const { hazards, materials } = runPipeline(missingQuiz)
    expect(hazards.map((h) => h.kind)).toEqual(["crossing_no_signal", "blind_corner"])
    // どちらも生クイズが使えない → kind 既定のフォールバック素材で補完される。
    expect(materials[0]).toEqual(KID_QUIZ_FALLBACK_BY_KIND.crossing_no_signal)
    expect(materials[1]).toEqual(KID_QUIZ_FALLBACK_BY_KIND.blind_corner)
  })
})

describe("salvage: 0〜1000スケール座標の混入で全滅しない", () => {
  it("全ポイントが生存し region は 0..1 に変換される(旧実装は hazards:0 → guide(empty) 全滅)", () => {
    const { hazards } = runPipeline(regionScaled1000)
    expect(hazards.map((h) => h.kind)).toEqual(["blind_corner", "parked_car_shadow"])
    for (const h of hazards) {
      expect(h.region.x).toBeGreaterThanOrEqual(0)
      expect(h.region.x + h.region.w).toBeLessThanOrEqual(1)
      expect(h.region.y + h.region.h).toBeLessThanOrEqual(1)
    }
    // 先頭点: {x:400,y:520,w:180,h:200} → 中心膨張前の変換値は {0.4,0.52,0.18,0.2}
    const first = hazards[0]
    expect(first.region.x).toBeCloseTo(0.4, 5)
    expect(first.region.y).toBeCloseTo(0.52, 5)
  })

  it("safePoints の 0〜1000 region も同様にサルベージされる", () => {
    const validated = validateHunterResponse(regionScaled1000)
    const region = validated.safePoints[0]?.region
    expect(region).toBeDefined()
    expect(region!.x).toBeCloseTo(0.7, 5)
    expect(region!.w).toBeCloseTo(0.25, 5)
  })
})

describe("evidence: 先行根拠フィールドは点を壊さず、子ども表示へ漏れない", () => {
  it("evidence 付き・非文字列 evidence の両方の点が生存する", () => {
    const { validated, hazards } = runPipeline(evidencePassthrough)
    expect(hazards).toHaveLength(2)
    // 文字列 evidence は保持、非文字列(12345)は undefined へ吸収(点は落とさない)
    expect(validated.dangerPoints[0].evidence).toBe("角の へいが 右から来る 車を かくしている")
    expect(validated.dangerPoints[1].evidence).toBeUndefined()
  })

  it("HunterHazard(表示系ドメイン型)に evidence プロパティが存在しない", () => {
    const { hazards } = runPipeline(evidencePassthrough)
    for (const h of hazards) {
      expect("evidence" in h).toBe(false)
    }
  })
})

describe("salvage: a realistically messy response keeps every recoverable point", () => {
  it("recovers 3 points (stringy imageUsable/version, upper severity, stringy confidence, missing quiz) and drops only the region-less one", () => {
    const { hazards } = runPipeline(messyRecoverable)
    expect(hazards.map((h) => h.kind)).toEqual([
      "blind_corner",
      "popout_spot",
      "crossing_no_signal",
    ])
    // region の無い turning_car は写真に置けないため唯一ドロップされる。
    expect(hazards.some((h) => h.kind === "turning_car")).toBe(false)
  })
})
