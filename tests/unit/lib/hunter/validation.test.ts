import { describe, expect, it } from "vitest"

import { parseAnalyzeBody, parseSessionBody } from "@/lib/hunter/validation"

const validHazard = {
  id: "s-0-0",
  type: "見通しの悪い角",
  region: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
  severity: "high",
  kidExplanation: "あぶないよ",
  safeAction: "気をつけよう",
  confidence: 0.8,
  kind: "blind_corner",
  accidentLink: "出会い頭",
}

const validQuizItem = {
  id: "q-choice-0",
  kind: "choice",
  theme: null,
  question: "どうする？",
  choices: [
    { id: "c0", label: "止まる" },
    { id: "c1", label: "走る" },
  ],
  correctChoiceId: "c0",
  explanation: "とまろう",
  accidentLink: null,
}

describe("parseAnalyzeBody", () => {
  it("accepts a valid analyze body with consent", () => {
    const res = parseAnalyzeBody({
      imageBase64: "data:image/png;base64,abc",
      pin: { latitude: 33.59, longitude: 130.4 },
      consent: true,
    })
    expect(res.ok).toBe(true)
  })

  it("rejects when consent is missing with a dedicated message", () => {
    const res = parseAnalyzeBody({
      imageBase64: "data:image/png;base64,abc",
      pin: { latitude: 33.59, longitude: 130.4 },
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain("同意")
  })

  it("rejects when consent is false", () => {
    const res = parseAnalyzeBody({
      imageBase64: "data:image/png;base64,abc",
      pin: { latitude: 33.59, longitude: 130.4 },
      consent: false,
    })
    expect(res.ok).toBe(false)
  })

  it("rejects out-of-range coordinates", () => {
    const res = parseAnalyzeBody({
      imageBase64: "x",
      pin: { latitude: 200, longitude: 130.4 },
      consent: true,
    })
    expect(res.ok).toBe(false)
  })

  it("rejects an empty image", () => {
    const res = parseAnalyzeBody({
      imageBase64: "",
      pin: { latitude: 33.59, longitude: 130.4 },
      consent: true,
    })
    expect(res.ok).toBe(false)
  })
})

describe("parseSessionBody", () => {
  it("accepts a valid explore session", () => {
    const res = parseSessionBody({
      mode: "explore",
      hazards: [validHazard],
      taps: [{ x: 0.1, y: 0.1 }],
    })
    expect(res.ok).toBe(true)
  })

  it("accepts a quiz-mode session with items", () => {
    const res = parseSessionBody({
      mode: "quiz",
      items: [validQuizItem],
      answers: [{ itemId: "q-choice-0", choiceId: "c0" }],
      sessionId: "sess-123",
    })
    expect(res.ok).toBe(true)
  })

  it("rejects a quiz-mode session with no items", () => {
    const res = parseSessionBody({ mode: "quiz", answers: [] })
    expect(res.ok).toBe(false)
  })

  it("rejects an explore-mode session with no hazards", () => {
    const res = parseSessionBody({ mode: "explore", hazards: [], taps: [] })
    expect(res.ok).toBe(false)
  })

  it("accepts a hazard carrying optional kind and accidentLink", () => {
    const res = parseSessionBody({
      mode: "explore",
      hazards: [validHazard],
      taps: [],
    })
    expect(res.ok).toBe(true)
  })

  it("rejects an unknown mode", () => {
    const res = parseSessionBody({ mode: "battle", hazards: [], taps: [] })
    expect(res.ok).toBe(false)
  })

  it("rejects taps outside 0..1", () => {
    const res = parseSessionBody({
      mode: "explore",
      hazards: [validHazard],
      taps: [{ x: 1.5, y: 0.1 }],
    })
    expect(res.ok).toBe(false)
  })

  it("rejects a malformed hazard", () => {
    const res = parseSessionBody({
      mode: "explore",
      hazards: [{ id: "x" }],
      taps: [],
    })
    expect(res.ok).toBe(false)
  })
})
