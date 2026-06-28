import { describe, expect, it } from "vitest"

import { buildQuizItems, judgeQuizAnswer, scoreQuiz } from "@/lib/hunter/quiz"
import type { HunterAccidentSummary, HunterHazard } from "@/lib/hunter/types"

function hazard(id: string, type: string): HunterHazard {
  return {
    id,
    type,
    region: { x: 0.3, y: 0.3, w: 0.2, h: 0.2 },
    severity: "high",
    kidExplanation: `${type}だよ`,
    safeAction: "とまって 左右を 見よう。",
    confidence: 0.9,
  }
}

const accidentWithData: HunterAccidentSummary = {
  hasData: true,
  riskScore: 60,
  riskLevel: "high",
  riskLabel: "危険",
  riskEmoji: "🟠",
  totalAccidents: 12,
  childInvolved: 3,
  topAccidentType: "出会い頭",
  peakTimeSlot: "下校時間 (14-17時)",
  kidMessage: "気をつけて 練習しよう！",
}

const accidentNoData: HunterAccidentSummary = {
  hasData: false,
  riskScore: 0,
  riskLevel: "safe",
  riskLabel: "安全",
  riskEmoji: "🟢",
  totalAccidents: 0,
  childInvolved: 0,
  topAccidentType: null,
  peakTimeSlot: null,
  kidMessage: "でも ゆだんは きんもつ！",
}

describe("buildQuizItems", () => {
  it("creates place questions from hazards plus a choice question, capped at max", () => {
    const items = buildQuizItems(
      [hazard("h1", "きけんなもの"), hazard("h2", "車に注意"), hazard("h3", "じゃまなもの")],
      accidentWithData,
      3,
    )
    expect(items).toHaveLength(3)
    expect(items.filter((i) => i.kind === "place").length).toBeGreaterThanOrEqual(1)
    expect(items.some((i) => i.kind === "choice")).toBe(true)
  })

  it("place question references the hazard and stores its region", () => {
    const items = buildQuizItems([hazard("h1", "車に注意")], accidentWithData, 2)
    const place = items.find((i) => i.kind === "place")
    expect(place).toBeDefined()
    expect(place?.answerHazardId).toBe("h1")
    expect(place?.answerRegion).toEqual({ x: 0.3, y: 0.3, w: 0.2, h: 0.2 })
    expect(place?.question).toContain("車に注意")
  })

  it("includes the accident reality line in explanations when data exists", () => {
    const items = buildQuizItems([hazard("h1", "きけんなもの")], accidentWithData, 2)
    expect(items.some((i) => i.explanation.includes("件 あったよ"))).toBe(true)
  })

  it("omits the reality line when there is no accident data", () => {
    const items = buildQuizItems([hazard("h1", "きけんなもの")], accidentNoData, 2)
    expect(items.every((i) => !i.explanation.includes("件 あったよ"))).toBe(true)
  })

  it("falls back to a choice question when there are no hazards", () => {
    const items = buildQuizItems([], accidentWithData, 3)
    expect(items.length).toBeGreaterThanOrEqual(1)
    expect(items.every((i) => i.kind === "choice")).toBe(true)
  })

  it("selects a theme-matched choice template (出会い頭 → 見通し)", () => {
    const items = buildQuizItems([], accidentWithData, 1)
    const choice = items[0]
    expect(choice.kind).toBe("choice")
    expect(choice.question).toContain("見通し")
    expect(choice.choices).toHaveLength(4)
    expect(choice.correctChoiceId).toBe("c0")
    // 正解(c0)が先頭に固定されない（決定的に回転）
    expect(choice.choices?.[0]?.id).not.toBe("c0")
  })
})

describe("judgeQuizAnswer", () => {
  const items = buildQuizItems([hazard("h1", "車に注意")], accidentWithData, 2)
  const place = items.find((i) => i.kind === "place")!
  const choice = items.find((i) => i.kind === "choice")!

  it("marks a place answer correct when the tap is inside the region", () => {
    const r = judgeQuizAnswer(place, { itemId: place.id, tap: { x: 0.4, y: 0.4 } })
    expect(r.correct).toBe(true)
    expect(r.points).toBeGreaterThan(0)
  })

  it("marks a place answer incorrect when the tap is far away", () => {
    const r = judgeQuizAnswer(place, { itemId: place.id, tap: { x: 0.9, y: 0.9 } })
    expect(r.correct).toBe(false)
    expect(r.points).toBe(0)
  })

  it("marks a choice answer correct only for the correct choice id", () => {
    expect(judgeQuizAnswer(choice, { itemId: choice.id, choiceId: "c0" }).correct).toBe(true)
    expect(judgeQuizAnswer(choice, { itemId: choice.id, choiceId: "c1" }).correct).toBe(false)
  })

  it("treats a missing answer as incorrect", () => {
    expect(judgeQuizAnswer(place, undefined).correct).toBe(false)
  })
})

describe("scoreQuiz", () => {
  it("aggregates score, correct count, and total", () => {
    const items = buildQuizItems([hazard("h1", "車に注意")], accidentWithData, 2)
    const place = items.find((i) => i.kind === "place")!
    const choice = items.find((i) => i.kind === "choice")!
    const result = scoreQuiz(items, [
      { itemId: place.id, tap: { x: 0.4, y: 0.4 } }, // correct
      { itemId: choice.id, choiceId: "c1" }, // wrong
    ])
    expect(result.total).toBe(items.length)
    expect(result.correct).toBe(1)
    expect(result.score).toBe(100)
    expect(result.outcomes).toHaveLength(items.length)
  })
})
