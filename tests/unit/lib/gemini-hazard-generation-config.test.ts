import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { callGeminiVision } from "@/lib/gemini-hazard"

const GEMINI_OK_RESPONSE = {
  candidates: [{ content: { parts: [{ text: "{}" }] } }],
}

// callGeminiVision rejects payloads shorter than 50 chars as "insufficient image data";
// pad the dummy base64 well past that floor so the guard never interferes with these tests.
const IMAGE_DATA_URL = "data:image/png;base64," + "A".repeat(64)

function mockFetchOnce() {
  return vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => GEMINI_OK_RESPONSE,
    text: async () => JSON.stringify(GEMINI_OK_RESPONSE),
  } as Response)
}

describe("callGeminiVision generationConfig", () => {
  const originalKey = process.env.GOOGLE_API_KEY

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = "test-key"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.GOOGLE_API_KEY = originalKey
  })

  it("reports Gemini's token counts (thinking tokens count as output) when asked, and also before a no-text error", async () => {
    const usageMetadata = { promptTokenCount: 2100, candidatesTokenCount: 700, thoughtsTokenCount: 300 }
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, statusText: "OK",
      json: async () => ({ ...GEMINI_OK_RESPONSE, usageMetadata }),
    } as Response)
    const onUsage = vi.fn()
    await callGeminiVision(IMAGE_DATA_URL, "prompt text", undefined, undefined, onUsage)
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 2100, outputTokens: 1000 })

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true, status: 200, statusText: "OK",
      json: async () => ({ candidates: [], usageMetadata: { promptTokenCount: 2100 } }),
    } as Response)
    onUsage.mockClear()
    await expect(callGeminiVision(IMAGE_DATA_URL, "prompt text", undefined, undefined, onUsage)).rejects.toThrow("did not contain text")
    expect(onUsage).toHaveBeenCalledWith({ inputTokens: 2100, outputTokens: 0 })
  })

  it("omits generationConfig from the request body when not provided (backward compat)", async () => {
    const fetchSpy = mockFetchOnce()

    await callGeminiVision(IMAGE_DATA_URL, "prompt text")

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body))
    expect(body.generationConfig).toBeUndefined()
  })

  it("includes temperature/responseMimeType/responseSchema when generationConfig is provided", async () => {
    const fetchSpy = mockFetchOnce()

    await callGeminiVision(IMAGE_DATA_URL, "prompt text", {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT" },
    })

    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(init.body))
    expect(body.generationConfig).toEqual({
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT" },
    })
  })
})
