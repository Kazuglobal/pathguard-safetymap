import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  HAZARD_CATEGORY_MAP,
  analyzeHazardWithVLM,
  extractPreSubmitSimulationQuickSummary,
  getRiskLevelLabel,
  getSeverityVariant,
  selectSimulationQuickSummaryImage,
} from "@/lib/vlm-analysis"

const originalEnv = process.env.NEXT_PUBLIC_VLM_USE_MOCK
const originalNodeEnv = process.env.NODE_ENV
const originalFetch = global.fetch
const validAnalysis = {
  hazards: [], overall_safety_score: 85, overall_risk_level: 2,
  child_perspective_summary: "Test summary", time_weather_risks: {}, improvement_suggestions: {},
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_VLM_USE_MOCK = "false"
  process.env.NODE_ENV = "test"
})

afterEach(() => {
  process.env.NEXT_PUBLIC_VLM_USE_MOCK = originalEnv
  process.env.NODE_ENV = originalNodeEnv
  global.fetch = originalFetch
  vi.restoreAllMocks()
})

describe("vlm-analysis", () => {
  it("defines hazard categories and presentation helpers", () => {
    expect(Object.keys(HAZARD_CATEGORY_MAP)).toHaveLength(15)
    expect(getSeverityVariant(5)).toBe("destructive")
    expect(getSeverityVariant(3)).toBe("secondary")
    expect(getSeverityVariant(1)).toBe("default")
    expect(getRiskLevelLabel(4)).toBe("高リスク")
  })

  it("extracts a pre-submit markdown summary", () => {
    expect(extractPreSubmitSimulationQuickSummary([
      "| ハザード | 想定リスク (例) | その場でできる対策 (例) |", "|---|---|---|",
      "| 地震 | 塀のひび割れや落下物のおそれ | 塀から離れて迂回する |",
    ].join("\n"))).toEqual({
      summary: "塀のひび割れや落下物のおそれ", action: "塀から離れて迂回する", hazardKey: "earthquake",
    })
  })

  it("selects the generated simulation preview", () => {
    expect(selectSimulationQuickSummaryImage(
      [new File(["overlay"], "overlay.png"), new File(["sim"], "flood.png")],
      ["blob:overlay", "blob:flood"],
    )).toBe("blob:flood")
  })

  it("validates required input before requesting the Worker route", async () => {
    await expect(analyzeHazardWithVLM(null as never, { image_url: "", report_id: "id" }))
      .rejects.toThrow("image_url and report_id are required")
    await expect(analyzeHazardWithVLM(null as never, { image_url: "http://example.com/a.jpg", report_id: "id" }))
      .rejects.toThrow("image_url must use HTTPS")
    await expect(analyzeHazardWithVLM(null as never, {
      image_url: "https://example.com/a.jpg", report_id: "id", additional_context: "a".repeat(1201),
    })).rejects.toThrow("additional_context must be at most 1200 characters")
  })

  it("posts to the same-origin Worker route and preserves the response contract", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ analysis: validAnalysis, analysis_id: "analysis-1" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    }))
    global.fetch = fetchMock as typeof fetch
    await expect(analyzeHazardWithVLM(null as never, {
      image_url: "https://media.example.com/private.jpg", report_id: "report-1", additional_context: "通学時間帯",
    })).resolves.toEqual({ success: true, analysis: validAnalysis, analysis_id: "analysis-1" })
    expect(fetchMock).toHaveBeenCalledWith("/api/vlm/analyze-hazard", expect.objectContaining({
      method: "POST", credentials: "same-origin",
      body: JSON.stringify({
        image_url: "https://media.example.com/private.jpg", report_id: "report-1", additional_context: "通学時間帯",
      }),
    }))
  })

  it("maps non-2xx and invalid success payloads to safe failures", async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429, headers: { "Content-Type": "application/json" },
    })) as typeof fetch
    await expect(analyzeHazardWithVLM(null as never, {
      image_url: "https://example.com/a.jpg", report_id: "report-1",
    })).resolves.toEqual({ success: false, error: "Rate limit exceeded" })
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ analysis: { hazards: [] } }), {
      status: 200, headers: { "Content-Type": "application/json" },
    })) as typeof fetch
    await expect(analyzeHazardWithVLM(null as never, {
      image_url: "https://example.com/a.jpg", report_id: "report-1",
    })).resolves.toEqual({ success: false, error: "分析結果の形式が不正です" })
  })

  it("propagates network failures", async () => {
    global.fetch = vi.fn(async () => { throw new Error("Network timeout") }) as typeof fetch
    await expect(analyzeHazardWithVLM(null as never, {
      image_url: "https://example.com/a.jpg", report_id: "report-1",
    })).rejects.toThrow("Network timeout")
  })
})
