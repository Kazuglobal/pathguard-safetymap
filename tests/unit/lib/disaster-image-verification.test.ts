import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  callGeminiVision: vi.fn(),
}))

// callGeminiVision のみ差し替え、同ファイルの他エクスポートは実物を使う。
vi.mock("@/lib/gemini-hazard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/gemini-hazard")>()
  return { ...actual, callGeminiVision: mocks.callGeminiVision }
})

import {
  verifyOrRegenerateImages,
  IMAGE_VERIFICATION_FAILED_WARNING,
} from "@/lib/disaster-image-verification"
import type { GeneratedImage } from "@/lib/gemini-image"

const CLEAN_RESULT = JSON.stringify({
  readableText: false,
  textSamples: [],
  faces: false,
  licensePlates: false,
  otherPrivacyRisk: [],
})

const DIRTY_RESULT = JSON.stringify({
  readableText: true,
  textSamples: ["SchoolName Elementary", "090-1234-5678"],
  faces: true,
  licensePlates: false,
  otherPrivacyRisk: ["表札に世帯名"],
})

function img(dataUrl: string): GeneratedImage {
  return { mimeType: "image/png", dataUrl }
}

const FIRST_IMAGES: GeneratedImage[] = [img("data:image/png;base64,first-image-payload-aaaaaaaaaaaaaaaaaaaa")]
const MULTI_IMAGES: GeneratedImage[] = [
  img("data:image/png;base64,first-image-payload-aaaaaaaaaaaaaaaaaaaa"),
  img("data:image/png;base64,second-image-payload-cccccccccccccccccccc"),
]
const REGEN_IMAGES: GeneratedImage[] = [img("data:image/png;base64,regen-image-payload-bbbbbbbbbbbbbbbbbbbbb")]

describe("verifyOrRegenerateImages", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("検証OK: 生成画像をそのまま採用し、再生成せず検証は1回だけ", async () => {
    mocks.callGeminiVision.mockResolvedValueOnce(CLEAN_RESULT)
    const regenerate = vi.fn(async () => REGEN_IMAGES)

    const outcome = await verifyOrRegenerateImages({ images: FIRST_IMAGES, regenerate })

    expect(outcome.images).toEqual(FIRST_IMAGES)
    expect(outcome.warning).toBeUndefined()
    expect(outcome.verificationRequestCount).toBe(1)
    expect(mocks.callGeminiVision).toHaveBeenCalledTimes(1)
    expect(regenerate).not.toHaveBeenCalled()
  })

  it("検証NG → 是正再生成OK: 再生成画像を採用（検出サンプルをサフィックスへ反映）", async () => {
    mocks.callGeminiVision
      .mockResolvedValueOnce(DIRTY_RESULT) // 一次検証NG
      .mockResolvedValueOnce(CLEAN_RESULT) // 再検証OK
    const regenerate = vi.fn(async () => REGEN_IMAGES)

    const outcome = await verifyOrRegenerateImages({ images: FIRST_IMAGES, regenerate })

    expect(outcome.images).toEqual(REGEN_IMAGES)
    expect(outcome.warning).toBeUndefined()
    expect(outcome.verificationRequestCount).toBe(2)
    expect(mocks.callGeminiVision).toHaveBeenCalledTimes(2)
    expect(regenerate).toHaveBeenCalledTimes(1)
    const suffix = regenerate.mock.calls[0][0]
    expect(suffix).toContain("SchoolName Elementary")
    expect(suffix).toContain("090-1234-5678")
  })

  it("検証NG → 再生成もNG: 生成画像を採用せず warning を返す", async () => {
    mocks.callGeminiVision
      .mockResolvedValueOnce(DIRTY_RESULT) // 一次検証NG
      .mockResolvedValueOnce(DIRTY_RESULT) // 再検証もNG
    const regenerate = vi.fn(async () => REGEN_IMAGES)

    const outcome = await verifyOrRegenerateImages({ images: FIRST_IMAGES, regenerate })

    expect(outcome.images).toEqual([])
    expect(outcome.warning).toBe(IMAGE_VERIFICATION_FAILED_WARNING)
    expect(outcome.verificationRequestCount).toBe(2)
    expect(mocks.callGeminiVision).toHaveBeenCalledTimes(2)
    expect(regenerate).toHaveBeenCalledTimes(1)
  })

  it("複数画像の2枚目が検証NGなら、是正再生成してから採用する", async () => {
    mocks.callGeminiVision
      .mockResolvedValueOnce(CLEAN_RESULT)
      .mockResolvedValueOnce(DIRTY_RESULT)
      .mockResolvedValueOnce(CLEAN_RESULT)
    const regenerate = vi.fn(async () => REGEN_IMAGES)

    const outcome = await verifyOrRegenerateImages({ images: MULTI_IMAGES, regenerate })

    expect(outcome.images).toEqual(REGEN_IMAGES)
    expect(outcome.warning).toBeUndefined()
    expect(outcome.verificationRequestCount).toBe(3)
    expect(mocks.callGeminiVision).toHaveBeenCalledTimes(3)
    expect(regenerate).toHaveBeenCalledTimes(1)
  })

  it("検証コール自体が失敗: 未検証画像を採用せず warning を返す", async () => {
    mocks.callGeminiVision.mockRejectedValueOnce(new Error("Gemini request failed: 503"))
    const regenerate = vi.fn(async () => REGEN_IMAGES)

    const outcome = await verifyOrRegenerateImages({ images: FIRST_IMAGES, regenerate })

    expect(outcome.images).toEqual([])
    expect(outcome.warning).toBe(IMAGE_VERIFICATION_FAILED_WARNING)
    expect(outcome.verificationRequestCount).toBe(1)
    expect(mocks.callGeminiVision).toHaveBeenCalledTimes(1)
    expect(regenerate).not.toHaveBeenCalled()
  })

  it("画像が無い場合は検証せず既存の画像なしパスを踏襲する", async () => {
    const regenerate = vi.fn(async () => REGEN_IMAGES)

    const outcome = await verifyOrRegenerateImages({ images: [], regenerate })

    expect(outcome.images).toEqual([])
    expect(outcome.warning).toBeUndefined()
    expect(outcome.verificationRequestCount).toBe(0)
    expect(mocks.callGeminiVision).not.toHaveBeenCalled()
    expect(regenerate).not.toHaveBeenCalled()
  })

  it("再生成が画像を返さない場合も warning を返す", async () => {
    mocks.callGeminiVision.mockResolvedValueOnce(DIRTY_RESULT)
    const regenerate = vi.fn(async () => [] as GeneratedImage[])

    const outcome = await verifyOrRegenerateImages({ images: FIRST_IMAGES, regenerate })

    expect(outcome.images).toEqual([])
    expect(outcome.warning).toBe(IMAGE_VERIFICATION_FAILED_WARNING)
    expect(outcome.verificationRequestCount).toBe(1)
    // 再生成が空なので再検証は行わない
    expect(mocks.callGeminiVision).toHaveBeenCalledTimes(1)
  })
})
