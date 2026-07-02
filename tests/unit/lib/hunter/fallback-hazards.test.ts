import { describe, expect, it } from "vitest"

import {
  GUIDE_COPY_BY_REASON,
  buildGuideMode,
  selectGuideQuiz,
} from "@/lib/hunter/fallback-hazards"
import type { HunterAccidentSummary, HunterFallbackReason } from "@/lib/hunter/types"

const accidentBlind: HunterAccidentSummary = {
  hasData: true,
  riskScore: 50,
  riskLevel: "high",
  riskLabel: "危険",
  riskEmoji: "🟠",
  totalAccidents: 8,
  childInvolved: 2,
  topAccidentType: "出会い頭",
  peakTimeSlot: null,
  kidMessage: "気をつけよう",
}

const noData: HunterAccidentSummary = {
  hasData: false,
  riskScore: 0,
  riskLevel: "safe",
  riskLabel: "安全",
  riskEmoji: "🟢",
  totalAccidents: 0,
  childInvolved: 0,
  topAccidentType: null,
  peakTimeSlot: null,
  kidMessage: "ゆだんは きんもつ",
}

const REASONS: HunterFallbackReason[] = ["empty", "unusable", "ai_error", "parse_error"]

describe("buildGuideMode", () => {
  it("never places fake hazards on the photo", () => {
    for (const reason of REASONS) {
      const guide = buildGuideMode(noData, reason)
      expect(guide.mode).toBe("guide")
      expect(guide.hazards).toEqual([])
      expect(guide.usedFallback).toBe(true)
      expect(guide.fallbackReason).toBe(reason)
    }
  })

  it("passes safe points through for the reverse mode (empty detection)", () => {
    const safePoints = [
      { id: "s-safe-0", type: "ガードレール", region: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }, whyGood: "あんしんだよ" },
    ]
    const guide = buildGuideMode(noData, "empty", safePoints)
    expect(guide.safePoints).toEqual(safePoints)
  })

  it("defaults safePoints to an empty array when omitted", () => {
    expect(buildGuideMode(noData, "ai_error").safePoints).toEqual([])
  })

  it("provides a non-empty bank of choice quizzes (no spatial questions)", () => {
    const guide = buildGuideMode(noData, "empty")
    expect(guide.quiz.length).toBeGreaterThan(0)
    expect(guide.quiz.every((q) => q.kind === "choice")).toBe(true)
    guide.quiz.forEach((q) => {
      expect(q.choices).toHaveLength(4)
      expect(q.correctChoiceId).toBe("c0")
    })
  })

  it("does not assert safety for unusable / ai_error / parse_error", () => {
    expect(buildGuideMode(noData, "unusable").noHazardFollow).not.toContain("すくない")
    expect(buildGuideMode(noData, "ai_error").noHazardFollow).not.toContain("すくない")
    expect(buildGuideMode(noData, "parse_error").noHazardFollow).not.toContain("すくない")
  })

  it("only the empty reason says danger is low (genuine 0-detection)", () => {
    expect(buildGuideMode(noData, "empty").noHazardFollow).toContain("すくない")
  })

  it("uses distinct, honest copy per reason", () => {
    expect(GUIDE_COPY_BY_REASON.unusable).toContain("見えなかった")
    expect(GUIDE_COPY_BY_REASON.ai_error).toContain("しらべられなかった")
    expect(GUIDE_COPY_BY_REASON.empty).not.toEqual(GUIDE_COPY_BY_REASON.ai_error)
  })
})

describe("selectGuideQuiz", () => {
  it("prioritizes the quiz matching the nearby accident type (出会い頭 → 見通し)", () => {
    const quiz = selectGuideQuiz(accidentBlind, 3)
    expect(quiz[0].theme).toBe("見通し")
  })

  it("returns a deterministic rotation (correct answer is not always first)", () => {
    const quiz = selectGuideQuiz(noData, 4)
    expect(quiz.some((q) => q.choices?.[0]?.id !== "c0")).toBe(true)
  })

  it("respects the max argument", () => {
    expect(selectGuideQuiz(noData, 2)).toHaveLength(2)
  })

  it("varies the correct-answer position by seed (defeats cross-session memorization)", () => {
    // seed(呼び出し側の sessionId 相当)が違えば、同じ質問バンクでも回転が変わる。
    const quizA = selectGuideQuiz(noData, 4, "session-a")
    const quizB = selectGuideQuiz(noData, 4, "session-b")
    const positionsA = quizA.map((q) => q.choices?.[0]?.id)
    const positionsB = quizB.map((q) => q.choices?.[0]?.id)
    expect(positionsA).not.toEqual(positionsB)
  })
})
