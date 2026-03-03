import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockFetch } = vi.hoisted(() => {
  return {
    mockFetch: vi.fn(),
  }
})

vi.stubGlobal("fetch", mockFetch)

vi.mock("@/lib/gemini-util", () => ({
  getSanitizedGeminiApiKey: () => "test-api-key",
}))

describe("generateImageWithGeminiWithModel", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it("uses a single forced model attempt so API route does not switch models", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "upstream error",
    })

    const { generateImageWithGeminiWithModel } = await import("@/lib/gemini-image")

    await expect(
      generateImageWithGeminiWithModel({
        prompt: "test prompt",
        model: "gemini-3.1-flash-image-preview",
      })
    ).rejects.toThrow("500")

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("uses Gemini generateContent payload keys accepted by image-preview models", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: "image/png",
                    data: "aGVsbG8=",
                  },
                },
              ],
            },
          },
        ],
      }),
    })

    const { generateImageWithGeminiWithModel } = await import("@/lib/gemini-image")

    await generateImageWithGeminiWithModel({
      prompt: "test prompt",
      model: "gemini-3.1-flash-image-preview",
      imageBase64: "dGVzdA==",
      imageMimeType: "image/png",
    })

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    const parts = body?.contents?.[0]?.parts

    expect(parts?.[0]?.inlineData).toBeDefined()
    expect(body?.generationConfig?.responseModalities).toEqual(["IMAGE", "TEXT"])
  })

  it("uses default timeout for the forced gemini-3.1 model", async () => {
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockImplementation(() => new AbortController().signal)

    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "upstream error",
    })

    const { generateImageWithGeminiWithModel } = await import("@/lib/gemini-image")

    await expect(
      generateImageWithGeminiWithModel({
        prompt: "test prompt",
        model: "gemini-3-pro-image-preview",
      })
    ).rejects.toThrow("500")

    expect(timeoutSpy).toHaveBeenCalled()
    expect(timeoutSpy.mock.calls.some(([ms]) => Number(ms) === 18_000)).toBe(true)
    timeoutSpy.mockRestore()
  })

  it("always uses gemini-3.1-flash-image-preview even when another model is requested", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "upstream error",
    })

    const { generateImageWithGeminiWithModel } = await import("@/lib/gemini-image")

    await expect(
      generateImageWithGeminiWithModel({
        prompt: "test prompt",
        model: "gemini-2.5-flash-image",
      })
    ).rejects.toThrow("500")

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("models/gemini-3.1-flash-image-preview:generateContent")
  })

  it("retries once with image-only modality when first successful response has no image data", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "I cannot provide image now." }] } }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/png",
                      data: "a".repeat(128),
                    },
                  },
                ],
              },
            },
          ],
        }),
      })

    const { generateImageWithGeminiWithModel } = await import("@/lib/gemini-image")

    const result = await generateImageWithGeminiWithModel({
      prompt: "test prompt",
      model: "gemini-3.1-flash-image-preview",
    })

    expect(result.images).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledTimes(2)

    const [, firstInit] = mockFetch.mock.calls[0] as [string, RequestInit]
    const [, secondInit] = mockFetch.mock.calls[1] as [string, RequestInit]
    const firstBody = JSON.parse(String(firstInit.body))
    const secondBody = JSON.parse(String(secondInit.body))

    expect(firstBody?.generationConfig?.responseModalities).toEqual(["IMAGE", "TEXT"])
    expect(secondBody?.generationConfig?.responseModalities).toEqual(["IMAGE"])
  })
})
