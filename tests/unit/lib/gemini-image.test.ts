import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { generateImageWithGeminiWithModel } from "@/lib/gemini-image"

// Minimal 1x1 PNG fixture (same bytes already trusted by tests/unit/lib/openai-image.test.ts).
const VALID_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII="

// detectInputMimeType() only inspects the JPEG SOI marker (0xff 0xd8 0xff); the rest of the
// bytes are irrelevant padding so the payload is long enough to decode cleanly.
function buildJpegBase64(): string {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(32).fill(0)]).toString("base64")
}

// detectInputMimeType() checks the RIFF....WEBP container header (bytes 0-4 and 8-12).
function buildWebpBase64(): string {
  const bytes = Buffer.alloc(20)
  bytes.write("RIFF", 0, "ascii")
  bytes.writeUInt32LE(12, 4)
  bytes.write("WEBP", 8, "ascii")
  return bytes.toString("base64")
}

const MAX_INPUT_IMAGE_BYTES = 25 * 1024 * 1024
// Comfortably decodes to more than the 25MB cap. Content doesn't matter here since the size
// check runs (and throws) before the magic-byte comparison is ever reached.
const OVERSIZED_BASE64 = "A".repeat(Math.ceil(((MAX_INPUT_IMAGE_BYTES + 4096) * 4) / 3))

const GEMINI_SUCCESS_RESPONSE = {
  candidates: [
    {
      content: {
        parts: [{ inlineData: { mimeType: "image/png", data: "ZmFrZS1pbWFnZS1kYXRh" } }],
      },
    },
  ],
}

function mockFetchSuccessOnce() {
  return vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => GEMINI_SUCCESS_RESPONSE,
    text: async () => JSON.stringify(GEMINI_SUCCESS_RESPONSE),
  } as Response)
}

describe("generateImageWithGeminiWithModel input image validation", () => {
  const originalKey = process.env.GOOGLE_API_KEY

  beforeEach(() => {
    process.env.GOOGLE_API_KEY = "test-key"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.GOOGLE_API_KEY = originalKey
  })

  it.each([
    ["image/png", VALID_PNG_BASE64],
    ["image/jpeg", buildJpegBase64()],
    ["image/webp", buildWebpBase64()],
  ])("accepts a valid %s payload matching its declared MIME type and proceeds to fetch", async (mimeType, base64) => {
    const fetchSpy = mockFetchSuccessOnce()

    const result = await generateImageWithGeminiWithModel({
      prompt: "test",
      imageBase64: base64,
      imageMimeType: mimeType,
    })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result.images.length).toBeGreaterThan(0)
  })

  it("rejects a disallowed MIME type before calling fetch", async () => {
    const fetchSpy = mockFetchSuccessOnce()

    await expect(
      generateImageWithGeminiWithModel({
        prompt: "test",
        imageBase64: VALID_PNG_BASE64,
        imageMimeType: "image/svg+xml",
      })
    ).rejects.toThrow("サポートされていない画像形式")

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("rejects an oversized input image before calling fetch", async () => {
    const fetchSpy = mockFetchSuccessOnce()

    await expect(
      generateImageWithGeminiWithModel({
        prompt: "test",
        imageBase64: OVERSIZED_BASE64,
        imageMimeType: "image/png",
      })
    ).rejects.toThrow("入力画像が大きすぎます")

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("rejects a payload whose magic bytes do not match the declared MIME type before calling fetch", async () => {
    const fetchSpy = mockFetchSuccessOnce()

    await expect(
      generateImageWithGeminiWithModel({
        prompt: "test",
        imageBase64: buildJpegBase64(),
        imageMimeType: "image/png",
      })
    ).rejects.toThrow("画像の内容とMIME形式が一致しません")

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("skips input-image validation entirely when no imageBase64 is provided", async () => {
    const fetchSpy = mockFetchSuccessOnce()

    const result = await generateImageWithGeminiWithModel({ prompt: "text-only prompt" })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result.images.length).toBeGreaterThan(0)
  })
})
