import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/claude-vision", () => ({
  callClaudeVision: vi.fn(),
  hasClaudeApiKey: vi.fn(() => true),
  claudeVisionModel: vi.fn(() => "claude-haiku-5-5"),
}))

import { callClaudeVision, hasClaudeApiKey } from "@/lib/claude-vision"
import { analyzeImagePipeline, getPipelinePromptByType } from "@/lib/gemini-hazard"
import { pipelinePixelsToNormalized, toPixelPositionsExample } from "@/lib/hazard-pipeline-claude"

const be32 = (n: number) => [(n >>> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
/** 1000×800 の PNG(ヘッダだけ)。 */
const PNG = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...be32(13), 0x49, 0x48, 0x44, 0x52, ...be32(1000), ...be32(800), 8, 2, 0, 0, 0,
]).toString("base64")}`
const SIZE = { width: 1000, height: 800 }

function claudePipelineJson() {
  return JSON.stringify({
    vision: {
      safety_equipment: [{ label: "guardrail", description: "ガードレール", count: 1, confidence: 0.9, coverage_ratio: 0.1, positions: [{ x1: 20, y1: 400, x2: 400, y2: 464 }] }],
      hazards: [{ label: "cracked_wall", description: "ひび", count: 1, confidence: 0.8, coverage_ratio: 0.08, positions: [{ x1: 720, y1: 200, x2: 900, y2: 520 }, { broken: true }] }],
      traffic: [],
      obstructions: [],
    },
    think: { contextual_risks: [], priority_improvements: [], latent_risks: [], child_perspective_risks: [] },
    educational_tips: ["きをつけよう"],
  })
}

describe("pixel coordinates for the hazard game", () => {
  it("converts Claude's pixel positions to the app's normalized boxes and drops unreadable ones", () => {
    const raw = pipelinePixelsToNormalized(JSON.parse(claudePipelineJson()), SIZE) as any
    expect(raw.vision.safety_equipment[0].positions[0]).toEqual({ x: 0.02, y: 0.5, width: 0.38, height: 0.08 })
    expect(raw.vision.hazards[0].positions).toEqual([{ x: 0.72, y: 0.25, width: 0.18, height: 0.4 }])
  })

  it("rewrites the schema example into pixel positions for the given image size", () => {
    const example = JSON.parse(toPixelPositionsExample(JSON.stringify({ vision: { hazards: [{ positions: [{ x: 0.5, y: 0.25, width: 0.1, height: 0.5 }] }] } }), SIZE))
    expect(example.vision.hazards[0].positions[0]).toEqual({ x1: 500, y1: 200, x2: 600, y2: 600 })
  })

  it("builds a pixel-coordinate prompt only when a size is given (Gemini's prompt is unchanged)", () => {
    const pixel = getPipelinePromptByType("default", undefined, undefined, SIZE)
    expect(pixel).toContain("幅 1000 ピクセル × 高さ 800 ピクセル")
    expect(pixel).toContain('"x1"')
    expect(pixel).not.toContain("0.00-1.00の正規化値")
    const normalized = getPipelinePromptByType("default")
    expect(normalized).toContain("0.00-1.00の正規化値")
    expect(normalized).not.toContain("ピクセル")
  })
})

describe("analyzeImagePipeline — preferClaude", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(hasClaudeApiKey).mockReturnValue(true)
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ vision: {}, think: {} }) }] } }] }),
    })
    vi.stubGlobal("fetch", fetchMock)
    vi.stubEnv("GEMINI_API_KEY", "test-dummy-key")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("uses Claude first and reports it for the usage log", async () => {
    vi.mocked(callClaudeVision).mockResolvedValue(claudePipelineJson())
    const result = await analyzeImagePipeline(PNG, { promptType: "default", preferClaude: true })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.analysisModel).toEqual({ provider: "anthropic", model: "claude-haiku-5-5" })
    expect(result.vision.hazards[0].positions[0]).toEqual({ x: 0.72, y: 0.25, width: 0.18, height: 0.4 })
  })

  it("reports Claude's real token usage once per answered call — also when the answer is unusable and Gemini takes over", async () => {
    const onClaudeUsage = vi.fn()
    vi.mocked(callClaudeVision).mockImplementation(async (params) => {
      params.onUsage?.({ inputTokens: 3200, outputTokens: 1800 })
      return claudePipelineJson()
    })
    await analyzeImagePipeline(PNG, { promptType: "default", preferClaude: true, onClaudeUsage })
    expect(onClaudeUsage).toHaveBeenCalledTimes(1)
    expect(onClaudeUsage).toHaveBeenCalledWith({ model: "claude-haiku-5-5", inputTokens: 3200, outputTokens: 1800, ok: true })

    onClaudeUsage.mockClear()
    vi.mocked(callClaudeVision).mockImplementation(async (params) => {
      params.onUsage?.({ inputTokens: 3200, outputTokens: 40 })
      return "ごめんなさい"
    })
    const fallback = await analyzeImagePipeline(PNG, { promptType: "default", preferClaude: true, onClaudeUsage })
    expect(onClaudeUsage).toHaveBeenCalledWith({ model: "claude-haiku-5-5", inputTokens: 3200, outputTokens: 40, ok: false })
    expect(fallback.analysisModel).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // 応答が届かなかった(通信の失敗・時間切れ)ときもトークン 0 で 1 件残す(Claude の障害に気づけるように)
    onClaudeUsage.mockClear()
    vi.mocked(callClaudeVision).mockRejectedValue(new Error("network"))
    await analyzeImagePipeline(PNG, { promptType: "default", preferClaude: true, onClaudeUsage })
    expect(onClaudeUsage).toHaveBeenCalledTimes(1)
    expect(onClaudeUsage).toHaveBeenCalledWith({ model: "claude-haiku-5-5", inputTokens: 0, outputTokens: 0, ok: false })
  })

  it("falls back to Gemini when Claude fails", async () => {
    vi.mocked(callClaudeVision).mockRejectedValue(new Error("down"))
    const result = await analyzeImagePipeline(PNG, { promptType: "default", preferClaude: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.analysisModel).toBeUndefined()
  })

  it("does not touch Claude for callers that do not opt in (safety-quest etc.)", async () => {
    await analyzeImagePipeline(PNG, [], "child")
    await analyzeImagePipeline(PNG, { promptType: "default" })
    expect(callClaudeVision).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
