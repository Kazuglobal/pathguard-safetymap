import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/gemini-hazard", () => ({
  callGeminiVision: vi.fn(),
}))

import { callGeminiVision } from "@/lib/gemini-hazard"
import { analyzeHunterImage, buildHunterPrompt } from "@/lib/hunter/hunter-ai"
import { HUNTER_GENERATION_CONFIG } from "@/lib/hunter/ai-request-schema"
import { DISPLAY_CONF_MIN } from "@/lib/hunter/sanitize"
import type { HunterAccidentSummary } from "@/lib/hunter/types"

const accident: HunterAccidentSummary = {
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

function pt(overrides: Record<string, unknown> = {}) {
  return {
    kind: "blind_corner",
    kidType: "見通しの悪い角",
    region: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 },
    severity: "high",
    confidence: 0.8,
    whyDangerous: "曲がってくる車から見えにくいよ",
    safeAction: "止まって左右を見よう",
    accidentLink: "出会い頭",
    quiz: {
      question: "見通しの悪い角ではどうする？",
      choices: ["止まって左右を見る", "車の音がしなければ進む", "走ってぬける", "車は来ないと決める"],
      explanation: "止まれば気づけるよ",
    },
    ...overrides,
  }
}

function aiJson(points: unknown[], extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: "hunter-1",
    imageUsable: true,
    dangerPoints: points,
    safePoints: [],
    noHazardFollow: null,
    ...extra,
  })
}

const opts = { sessionId: "sess", accidentSummary: accident, purpose: "hunter-explore" }

describe("analyzeHunterImage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns explore mode with sanitized hazards and quiz on a normal response", async () => {
    vi.mocked(callGeminiVision).mockResolvedValue(aiJson([pt()]))
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(r.mode).toBe("explore")
    expect(r.usedFallback).toBe(false)
    expect(r.hazards).toHaveLength(1)
    expect(r.hazards[0].type).toBe("見通しの悪い角")
    expect(r.quiz.length).toBeGreaterThan(0)
  })

  it("calls Gemini with the precision-tuned generation config (low temp + structured JSON)", async () => {
    vi.mocked(callGeminiVision).mockResolvedValue(aiJson([pt()]))
    await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(callGeminiVision).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      HUNTER_GENERATION_CONFIG,
    )
  })

  it("builds a prompt that hardens against false-positive 'mundane object' hazards", () => {
    const prompt = buildHunterPrompt(undefined, accident)
    expect(prompt).toContain("死角を作っていない、ふつうに停まっている車")
    expect(prompt).toContain("region(bbox)の正確さ")
    expect(prompt).toContain(`${DISPLAY_CONF_MIN} 未満の確信度なら`)
  })

  it("promotes a confident mid-size point to a place quiz (golden)", async () => {
    vi.mocked(callGeminiVision).mockResolvedValue(aiJson([pt({ confidence: 0.85 })]))
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(r.quiz.some((q) => q.kind === "place")).toBe(true)
  })

  it("replaces english copy with verified kid copy (no ASCII in display)", async () => {
    vi.mocked(callGeminiVision).mockResolvedValue(
      aiJson([pt({ whyDangerous: "car parked here", safeAction: "stop and look" })]),
    )
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(r.hazards[0].kidExplanation).not.toMatch(/[A-Za-z]/)
    expect(r.hazards[0].safeAction).not.toMatch(/[A-Za-z]/)
  })

  it("falls back to guide(empty) when there are no danger points", async () => {
    vi.mocked(callGeminiVision).mockResolvedValue(aiJson([]))
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(r.mode).toBe("guide")
    expect(r.fallbackReason).toBe("empty")
    expect(r.hazards).toEqual([])
    expect(r.quiz.length).toBeGreaterThan(0) // guide quiz bank
  })

  it("falls back to guide(unusable) when imageUsable is false", async () => {
    vi.mocked(callGeminiVision).mockResolvedValue(aiJson([pt()], { imageUsable: false }))
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(r.mode).toBe("guide")
    expect(r.fallbackReason).toBe("unusable")
  })

  it("does not retry and returns guide(parse_error) when allowRetry is false", async () => {
    vi.mocked(callGeminiVision).mockResolvedValue("これはJSONではありません")
    const r = await analyzeHunterImage("data:image/png;base64,x", { ...opts, allowRetry: false })
    expect(r.fallbackReason).toBe("parse_error")
    expect(callGeminiVision).toHaveBeenCalledTimes(1)
  })

  it("retries once on parse failure and succeeds on the second response", async () => {
    vi.mocked(callGeminiVision)
      .mockResolvedValueOnce("おっと、JSONを忘れました")
      .mockResolvedValueOnce(aiJson([pt()]))
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(callGeminiVision).toHaveBeenCalledTimes(2)
    expect(r.mode).toBe("explore")
    expect(r.hazards).toHaveLength(1)
  })

  it("never throws on AI error and returns guide(ai_error)", async () => {
    vi.mocked(callGeminiVision).mockRejectedValue(new Error("network down"))
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(r.mode).toBe("guide")
    expect(r.fallbackReason).toBe("ai_error")
  })
})
