import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/gemini-hazard", () => ({
  callGeminiVision: vi.fn(),
}))

import { callGeminiVision } from "@/lib/gemini-hazard"
import { analyzeHunterImage, buildHunterPrompt, isRetryableGeminiError } from "@/lib/hunter/hunter-ai"
import { HUNTER_GENERATION_CONFIG, HUNTER_RESPONSE_SCHEMA } from "@/lib/hunter/ai-request-schema"
import { DISPLAY_CONF_MIN, MAX_AREA } from "@/lib/hunter/sanitize"
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

  it("v2プロンプト: 3ゲート二段判定・evidence先行・2周目チェック・誤答類型・面積閾値開示を含む", () => {
    const prompt = buildHunterPrompt(undefined, accident)
    expect(prompt).toContain("G1[原因]")
    expect(prompt).toContain("【evidence(さいしょに根拠を書く)】")
    expect(prompt).toContain("2周目チェック")
    expect(prompt).toContain("たがいに違う類型を3つ")
    expect(prompt).toContain(`${MAX_AREA} をこえる枠`)
  })

  it("事故ブロック統合: ヒント化・空振り許可・priorityKind誘導・上位タイプ引き継ぎ・二重注入根絶", () => {
    const withData: HunterAccidentSummary = {
      ...accident,
      hasData: true,
      totalAccidents: 12,
      childInvolved: 3,
      topAccidentType: "出会い頭",
      topAccidentTypes: ["出会い頭", "横断中"],
    }
    // buildAccidentPromptContext 相当の重複コンテキスト(検出強要文入り)を渡す
    const duplicateCtx = "この地点では出会い頭事故が多い。優先的に、正確なbboxで検出してください"
    const prompt = buildHunterPrompt(duplicateCtx, withData)

    expect(prompt).toContain("さがす順番のヒント")
    expect(prompt).toContain("ヒントに合う状況が写真に無ければ")
    expect(prompt).toContain("「見通しの悪い角(blind_corner)」")
    expect(prompt).toContain("横断中") // topTypes 2番手の引き継ぎ
    // hasData のとき ctx は注入されない(事故情報の二重注入と検出強要文の根絶)
    expect(prompt).not.toContain("検出してください")
  })

  it("hasData=false のときは従来どおり accidentContext(ctx) が注入される", () => {
    const prompt = buildHunterPrompt("独自の注入コンテキスト文", accident)
    expect(prompt).toContain("独自の注入コンテキスト文")
  })

  it("responseSchema: evidence は propertyOrdering 先頭・required 非包含(故障半径の最小化)", () => {
    const items = (HUNTER_RESPONSE_SCHEMA.properties as any).dangerPoints.items
    expect(items.properties.evidence).toEqual({ type: "STRING" })
    expect(items.required).not.toContain("evidence")
    expect(items.propertyOrdering[0]).toBe("evidence")
    expect(items.propertyOrdering).toEqual([
      "evidence",
      "kind",
      "kidType",
      "region",
      "severity",
      "confidence",
      "whyDangerous",
      "safeAction",
      "accidentLink",
      "quiz",
    ])
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

  it("retries once on a transient 503 and recovers to explore mode", async () => {
    vi.mocked(callGeminiVision)
      .mockRejectedValueOnce(new Error("Gemini request failed: 503 Service Unavailable - overloaded"))
      .mockResolvedValueOnce(aiJson([pt()]))
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(callGeminiVision).toHaveBeenCalledTimes(2)
    expect(r.mode).toBe("explore")
    expect(r.hazards).toHaveLength(1)
  })

  it("retries once on a 429 rate limit and recovers", async () => {
    vi.mocked(callGeminiVision)
      .mockRejectedValueOnce(new Error("Gemini request failed: 429 Too Many Requests - quota"))
      .mockResolvedValueOnce(aiJson([pt()]))
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(callGeminiVision).toHaveBeenCalledTimes(2)
    expect(r.mode).toBe("explore")
  })

  it("retries once on empty candidates (no text output) and recovers", async () => {
    vi.mocked(callGeminiVision)
      .mockRejectedValueOnce(new Error("Gemini response did not contain text output"))
      .mockResolvedValueOnce(aiJson([pt()]))
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(callGeminiVision).toHaveBeenCalledTimes(2)
    expect(r.mode).toBe("explore")
  })

  it("does NOT retry a permanent 400 (bad request) — one call, guide(ai_error)", async () => {
    vi.mocked(callGeminiVision).mockRejectedValue(
      new Error("Gemini request failed: 400 Bad Request - invalid schema"),
    )
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(callGeminiVision).toHaveBeenCalledTimes(1)
    expect(r.fallbackReason).toBe("ai_error")
  })

  it("does not retry transient errors when allowRetry is false", async () => {
    vi.mocked(callGeminiVision).mockRejectedValue(
      new Error("Gemini request failed: 503 Service Unavailable"),
    )
    const r = await analyzeHunterImage("data:image/png;base64,x", { ...opts, allowRetry: false })
    expect(callGeminiVision).toHaveBeenCalledTimes(1)
    expect(r.fallbackReason).toBe("ai_error")
  })

  it("gives up with guide(ai_error) after a transient error persists across the retry", async () => {
    vi.mocked(callGeminiVision).mockRejectedValue(
      new Error("Gemini request failed: 503 Service Unavailable"),
    )
    const r = await analyzeHunterImage("data:image/png;base64,x", opts)
    expect(callGeminiVision).toHaveBeenCalledTimes(2)
    expect(r.fallbackReason).toBe("ai_error")
  })
})

describe("isRetryableGeminiError", () => {
  it("treats 429 and 5xx as retryable", () => {
    expect(isRetryableGeminiError(new Error("Gemini request failed: 429 Too Many Requests"))).toBe(true)
    expect(isRetryableGeminiError(new Error("Gemini request failed: 500 Internal"))).toBe(true)
    expect(isRetryableGeminiError(new Error("Gemini request failed: 503 Service Unavailable"))).toBe(true)
  })

  it("treats empty candidates and network blips as retryable", () => {
    expect(isRetryableGeminiError(new Error("Gemini response did not contain text output"))).toBe(true)
    expect(isRetryableGeminiError(new TypeError("fetch failed"))).toBe(true)
    expect(isRetryableGeminiError(new Error("ECONNRESET"))).toBe(true)
  })

  it("treats 4xx (except 429) and input errors as permanent", () => {
    expect(isRetryableGeminiError(new Error("Gemini request failed: 400 Bad Request"))).toBe(false)
    expect(isRetryableGeminiError(new Error("Gemini request failed: 403 Forbidden"))).toBe(false)
    expect(isRetryableGeminiError(new Error("画像データが不足しています"))).toBe(false)
    expect(isRetryableGeminiError(new Error("network down"))).toBe(false)
  })
})
