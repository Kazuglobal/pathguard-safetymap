import OpenAI, { toFile } from "openai"

import { openai } from "./openai"

// OpenAI の最新画像生成モデル（GPT Image 2）。
// 必要に応じて OPENAI_IMAGE_MODEL で上書きできる。
export const FORCED_OPENAI_IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL || "gpt-image-2"

export type GeneratedImage = {
  mimeType: string
  dataUrl: string
}

export type GenerateImageParams = {
  prompt?: string
  imageBase64?: string
  imageMimeType?: string
  model?: string
}

export type GenerateImageResult = {
  images: GeneratedImage[]
  model: string
  usage?: ImageGenerationUsage
}

export type ImageGenerationUsage = {
  inputTokens: number
  inputImageTokens: number
  inputTextTokens: number
  outputTokens: number
}

// Security: 出力サイズと枚数の上限（過大ペイロード防止）
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8MB
const MAX_INPUT_IMAGE_BYTES = 25 * 1024 * 1024 // OpenAI Images API limit
const MAX_IMAGE_COUNT = 4
const OPENAI_IMAGE_REQUEST_TIMEOUT_MS = 170_000
const OPENAI_IMAGE_QUALITY = "medium"

// GPT Image が許可する画像サイズのみ受け付ける。
const ALLOWED_IMAGE_SIZES = new Set([
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "auto",
])

const ALLOWED_INPUT_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"]

function validateInputMimeType(mimeType: string | undefined | null): string {
  if (typeof mimeType !== "string" || !ALLOWED_INPUT_MIME_TYPES.includes(mimeType)) {
    throw new Error("サポートされていない画像形式です。PNG、JPEG、WebP形式を使用してください。")
  }
  return mimeType
}

function estimateBase64Bytes(base64: string): number {
  const len = base64.length
  if (len === 0) return 0
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((len * 3) / 4) - padding)
}

function detectInputMimeType(base64: string): string | null {
  const bytes = Buffer.from(base64.slice(0, 32), "base64")
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png"
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg"
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp"
  }
  return null
}

function getImageSize(): string {
  const size = process.env.OPENAI_IMAGE_SIZE || "1024x1024"
  return ALLOWED_IMAGE_SIZES.has(size) ? size : "1024x1024"
}

function toGeneratedImages(
  data: OpenAI.Images.ImagesResponse["data"],
): GeneratedImage[] {
  const images: GeneratedImage[] = []
  for (const item of data ?? []) {
    if (images.length >= MAX_IMAGE_COUNT) break
    const b64 = item?.b64_json
    if (typeof b64 !== "string" || b64.length < 100) continue
    if (estimateBase64Bytes(b64) > MAX_IMAGE_BYTES) continue
    // GPT Image は常に PNG（base64）を返す。
    images.push({ mimeType: "image/png", dataUrl: `data:image/png;base64,${b64}` })
  }
  return images
}

function toImageGenerationUsage(
  usage: OpenAI.Images.ImagesResponse["usage"],
): ImageGenerationUsage | undefined {
  if (!usage) return undefined

  return {
    inputTokens: usage.input_tokens,
    inputImageTokens: usage.input_tokens_details?.image_tokens ?? 0,
    inputTextTokens: usage.input_tokens_details?.text_tokens ?? 0,
    outputTokens: usage.output_tokens,
  }
}

/**
 * OpenAI GPT Image でプロンプト（および任意の参照画像）から画像を生成する。
 * 参照画像がある場合は images.edit（image-to-image）、無い場合は images.generate を使う。
 */
export async function generateImageWithOpenAIWithModel({
  prompt,
  imageBase64,
  imageMimeType,
  model: requestedModel,
}: GenerateImageParams): Promise<GenerateImageResult> {
  const model = requestedModel || FORCED_OPENAI_IMAGE_MODEL
  const client = openai()
  const text = prompt || "Create an image using the provided reference."
  const size = getImageSize()

  try {
    if (imageBase64) {
      const mimeType = validateInputMimeType(imageMimeType)
      if (estimateBase64Bytes(imageBase64) > MAX_INPUT_IMAGE_BYTES) {
        throw new Error("入力画像が大きすぎます。25MB以下の画像を使用してください。")
      }
      if (detectInputMimeType(imageBase64) !== mimeType) {
        throw new Error("画像の内容とMIME形式が一致しません。")
      }
      const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png"
      const inputFile = await toFile(
        Buffer.from(imageBase64, "base64"),
        `input.${extension}`,
        { type: mimeType },
      )

      const editParams = {
        model,
        image: inputFile,
        prompt: text,
        size: size as OpenAI.Images.ImageEditParams["size"],
        quality: OPENAI_IMAGE_QUALITY,
        // Supported by the current API; the installed SDK type predates this field for edits.
        output_format: "png",
      } as OpenAI.Images.ImageEditParams & { output_format: "png" }

      const response = await client.images.edit(editParams, {
        timeout: OPENAI_IMAGE_REQUEST_TIMEOUT_MS,
        maxRetries: 0,
      })

      const images = toGeneratedImages(response.data)
      if (images.length === 0) {
        throw new Error("OpenAIが画像データを返しませんでした")
      }
      return { images, model, usage: toImageGenerationUsage(response.usage) }
    }

    const response = await client.images.generate({
      model,
      prompt: text,
      size: size as OpenAI.Images.ImageGenerateParams["size"],
      n: 1,
      quality: OPENAI_IMAGE_QUALITY,
      output_format: "png",
    }, {
      timeout: OPENAI_IMAGE_REQUEST_TIMEOUT_MS,
      maxRetries: 0,
    })

    const images = toGeneratedImages(response.data)
    if (images.length === 0) {
      throw new Error("OpenAIが画像データを返しませんでした")
    }
    return { images, model, usage: toImageGenerationUsage(response.usage) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[OpenAI Image] generation failed (${model}):`, message)
    throw error instanceof Error ? error : new Error(message)
  }
}

/**
 * 後方互換: 画像配列のみを返す簡易ラッパー。
 */
export async function generateImageWithOpenAI(
  params: GenerateImageParams,
): Promise<GeneratedImage[]> {
  const result = await generateImageWithOpenAIWithModel(params)
  return result.images
}
