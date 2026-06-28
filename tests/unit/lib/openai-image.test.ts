import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  edit: vi.fn(),
  toFile: vi.fn(async (buffer: Buffer, name: string, options: { type: string }) => ({
    buffer,
    name,
    type: options.type,
  })),
}))

vi.mock("openai", () => ({
  default: {},
  toFile: mocks.toFile,
}))

vi.mock("@/lib/openai", () => ({
  openai: () => ({
    images: {
      generate: mocks.generate,
      edit: mocks.edit,
    },
  }),
}))

import { generateImageWithOpenAIWithModel } from "@/lib/openai-image"

const VALID_IMAGE_BASE64 = Buffer.from("x".repeat(128)).toString("base64")
const VALID_INPUT_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII="

describe("generateImageWithOpenAIWithModel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.generate.mockResolvedValue({
      data: [{ b64_json: VALID_IMAGE_BASE64 }],
      usage: {
        input_tokens: 11,
        input_tokens_details: { image_tokens: 0, text_tokens: 11 },
        output_tokens: 22,
        total_tokens: 33,
      },
    })
    mocks.edit.mockResolvedValue({
      data: [{ b64_json: VALID_IMAGE_BASE64 }],
      usage: {
        input_tokens: 44,
        input_tokens_details: { image_tokens: 40, text_tokens: 4 },
        output_tokens: 55,
        total_tokens: 99,
      },
    })
  })

  it("uses images.generate and explicitly requests PNG output", async () => {
    const result = await generateImageWithOpenAIWithModel({
      prompt: "test",
      model: "gpt-image-2",
    })

    expect(mocks.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-image-2",
        quality: "medium",
        output_format: "png",
      }),
      expect.objectContaining({
        timeout: 170_000,
        maxRetries: 0,
      }),
    )
    expect(mocks.edit).not.toHaveBeenCalled()
    expect(result.usage).toEqual({
      inputTokens: 11,
      inputImageTokens: 0,
      inputTextTokens: 11,
      outputTokens: 22,
    })
  })

  it("uses images.edit for a supported reference image", async () => {
    const result = await generateImageWithOpenAIWithModel({
      prompt: "edit",
      imageBase64: VALID_INPUT_PNG_BASE64,
      imageMimeType: "image/png",
    })

    expect(mocks.toFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      "input.png",
      { type: "image/png" },
    )
    expect(mocks.edit).toHaveBeenCalledWith(
      expect.objectContaining({
        quality: "medium",
        output_format: "png",
      }),
      expect.objectContaining({
        timeout: 170_000,
        maxRetries: 0,
      }),
    )
    expect(result.usage?.inputImageTokens).toBe(40)
  })

  it("rejects unsupported image MIME types instead of relabeling them as PNG", async () => {
    await expect(
      generateImageWithOpenAIWithModel({
        imageBase64: VALID_IMAGE_BASE64,
        imageMimeType: "image/gif",
      }),
    ).rejects.toThrow("サポートされていない画像形式")

    expect(mocks.toFile).not.toHaveBeenCalled()
    expect(mocks.edit).not.toHaveBeenCalled()
  })

  it("rejects spoofed MIME types whose bytes do not match", async () => {
    await expect(
      generateImageWithOpenAIWithModel({
        imageBase64: VALID_IMAGE_BASE64,
        imageMimeType: "image/png",
      }),
    ).rejects.toThrow("MIME形式が一致しません")

    expect(mocks.toFile).not.toHaveBeenCalled()
  })

  it("rejects responses without valid image data", async () => {
    mocks.generate.mockResolvedValueOnce({ data: [], usage: undefined })

    await expect(
      generateImageWithOpenAIWithModel({ prompt: "test" }),
    ).rejects.toThrow("OpenAIが画像データを返しませんでした")
  })
})
