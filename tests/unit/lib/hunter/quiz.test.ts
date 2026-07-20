import { describe, expect, it } from "vitest"

import { buildQuizItemsFromAi, judgeQuizAnswer, scoreQuiz } from "@/lib/hunter/quiz"
import type { RawAiQuiz } from "@/lib/hunter/ai-schema"
import type { HunterAccidentSummary, HunterHazard } from "@/lib/hunter/types"

function hazard(overrides: Partial<HunterHazard> = {}): HunterHazard {
  return {
    id: "s1-0",
    kind: "blind_corner",
    type: "見通しの悪い角",
    region: { x: 0.3, y: 0.3, w: 0.2, h: 0.2 }, // area 0.04 -> place eligible
    severity: "high",
    kidExplanation: "曲がってくる車から見えにくいよ",
    safeAction: "止まって左右を見よう",
    confidence: 0.9,
    // sanitizeDangerPoints が kidAccidentLabel を通した後の値(既に子ども向け)。
    // quiz.ts は二重適用しない前提なので、生の専門語ではなく変換後の値を使う。
    accidentLink: "角での出会い頭",
    ...overrides,
  }
}

function material(overrides: Partial<RawAiQuiz> = {}): RawAiQuiz {
  return {
    question: "見通しの悪い角ではどうする？",
    choices: ["止まって左右をよく見る", "車の音がしなければ渡る", "手をあげれば車は止まる", "走ってぬける"],
    explanation: "止まれば 車に 早く 気づけるよ。",
    ...overrides,
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

describe("buildQuizItemsFromAi", () => {
  it("promotes a high-confidence, mid-size hazard to a place question with its kid label", () => {
    const items = buildQuizItemsFromAi([hazard()], [material()], accidentWithData, 1)
    expect(items).toHaveLength(1)
    const place = items[0]
    expect(place.kind).toBe("place")
    expect(place.question).toContain("見通しの悪い角")
    expect(place.answerHazardId).toBe("s1-0")
    expect(place.answerRegion).toEqual({ x: 0.3, y: 0.3, w: 0.2, h: 0.2 })
  })

  it("keeps a low-confidence hazard as a choice question using AI material", () => {
    const items = buildQuizItemsFromAi(
      [hazard({ confidence: 0.5 })],
      [material({ question: "この角ではどうする？" })],
      accidentWithData,
      1,
    )
    const choice = items[0]
    expect(choice.kind).toBe("choice")
    expect(choice.question).toBe("この角ではどうする？")
    expect(choice.choices).toHaveLength(4)
    expect(choice.correctChoiceId).toBe("c0")
    // 正解(c0)が先頭に固定されない（決定的に回転）
    expect(choice.choices?.[0]?.id).not.toBe("c0")
  })

  it("keeps a large-region hazard as a choice (place area guard)", () => {
    const items = buildQuizItemsFromAi(
      [hazard({ region: { x: 0.05, y: 0.05, w: 0.7, h: 0.7 } })], // area 0.49 > max
      [material()],
      accidentWithData,
      1,
    )
    expect(items[0].kind).toBe("choice")
  })

  it("keeps a broad region as a choice even when it is not almost full-screen", () => {
    const items = buildQuizItemsFromAi(
      [hazard({ region: { x: 0.2, y: 0.2, w: 0.4, h: 0.4 } })], // area 0.16: too broad for a precise tap
      [material()],
      accidentWithData,
      1,
    )
    expect(items[0].kind).toBe("choice")
  })

  it("requires high confidence before asking a photo-tap question", () => {
    const items = buildQuizItemsFromAi(
      [hazard({ confidence: 0.78 })],
      [material()],
      accidentWithData,
      1,
    )
    expect(items[0].kind).toBe("choice")
  })

  it("includes the accident reality line when data exists", () => {
    const items = buildQuizItemsFromAi([hazard({ confidence: 0.5 })], [material()], accidentWithData, 1)
    expect(items[0].explanation).toContain("件 あったよ")
  })

  it("omits the reality line when there is no accident data", () => {
    const items = buildQuizItemsFromAi([hazard({ confidence: 0.5 })], [material()], accidentNoData, 1)
    expect(items.every((i) => !i.explanation.includes("件 あったよ"))).toBe(true)
  })

  it("derives a kid-friendly theme from the hazard's accident link", () => {
    const items = buildQuizItemsFromAi([hazard()], [material()], accidentWithData, 1)
    expect(items[0].theme).toBe("角での出会い頭")
  })

  it("returns an empty array when there are no hazards", () => {
    expect(buildQuizItemsFromAi([], [], accidentWithData, 3)).toEqual([])
  })

  it("varies the correct-answer position by hazard id, not by loop index alone (defeats memorization)", () => {
    // 同じ index(0番目)・同じ材料でも、hazard.id(セッション由来)が違えば回転が変わる。
    const itemsA = buildQuizItemsFromAi(
      [hazard({ id: "sessionA-0", confidence: 0.5 })],
      [material()],
      accidentWithData,
      1,
    )
    const itemsB = buildQuizItemsFromAi(
      [hazard({ id: "sessionB-0", confidence: 0.5 })],
      [material()],
      accidentWithData,
      1,
    )
    expect(itemsA[0].choices?.[0]?.id).not.toBe(itemsB[0].choices?.[0]?.id)
  })

  it("limits place questions to keep variety (at most ceil(max/2))", () => {
    const hazards = [
      hazard({ id: "s1-0", region: { x: 0.05, y: 0.05, w: 0.2, h: 0.2 } }),
      hazard({ id: "s1-1", region: { x: 0.4, y: 0.05, w: 0.2, h: 0.2 } }),
      hazard({ id: "s1-2", region: { x: 0.05, y: 0.5, w: 0.2, h: 0.2 } }),
    ]
    const materials = [material(), material(), material()]
    const items = buildQuizItemsFromAi(hazards, materials, accidentWithData, 3)
    expect(items).toHaveLength(3)
    const placeCount = items.filter((i) => i.kind === "place").length
    expect(placeCount).toBeLessThanOrEqual(2)
    expect(items.some((i) => i.kind === "choice")).toBe(true)
  })
})

describe("judgeQuizAnswer", () => {
  const place = buildQuizItemsFromAi([hazard()], [material()], accidentWithData, 1)[0]
  const choice = buildQuizItemsFromAi([hazard({ confidence: 0.5 })], [material()], accidentWithData, 1)[0]

  it("marks a place answer correct when the tap is inside the region", () => {
    const r = judgeQuizAnswer(place, { itemId: place.id, tap: { x: 0.4, y: 0.4 } })
    expect(r.correct).toBe(true)
    expect(r.points).toBeGreaterThan(0)
  })

  it("marks a place answer incorrect when the tap is far away", () => {
    const r = judgeQuizAnswer(place, { itemId: place.id, tap: { x: 0.95, y: 0.95 } })
    expect(r.correct).toBe(false)
    expect(r.points).toBe(0)
  })

  it("does not mark a tap clearly outside the place region as correct", () => {
    // region right edge is 0.5; 0.58 used to be accepted by the 0.1 expansion.
    const r = judgeQuizAnswer(place, { itemId: place.id, tap: { x: 0.58, y: 0.4 } })
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
    const items = buildQuizItemsFromAi(
      [hazard({ id: "s1-0" }), hazard({ id: "s1-1", confidence: 0.5 })],
      [material(), material()],
      accidentWithData,
      2,
    )
    const place = items.find((i) => i.kind === "place")!
    const choice = items.find((i) => i.kind === "choice")!
    const result = scoreQuiz(items, [
      { itemId: place.id, tap: { x: 0.4, y: 0.4 } }, // correct
      { itemId: choice.id, choiceId: "c1" }, // wrong (unless c1 happens to be correct rotation)
    ])
    expect(result.total).toBe(items.length)
    expect(result.outcomes).toHaveLength(items.length)
    expect(result.correct).toBeGreaterThanOrEqual(1)
  })
})
