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
}

// Security: 出力サイズと枚数の上限（過大ペイロード防止）
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8MB
const MAX_IMAGE_COUNT = 4

// GPT Image が許可する画像サイズのみ受け付ける。
const ALLOWED_IMAGE_SIZES = new Set([
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "auto",
])

const ALLOWED_INPUT_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"]

function sanitizeInputMimeType(mimeType: string | undefined | null): string {
  if (typeof mimeType === "string" && ALLOWED_INPUT_MIME_TYPES.includes(mimeType)) {
    return mimeType
  }
  return "image/png"
}

function estimateBase64Bytes(base64: string): number {
  const len = base64.length
  if (len === 0) return 0
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.max(0, Math.floor((len * 3) / 4) - padding)
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
      const mimeType = sanitizeInputMimeType(imageMimeType)
      const extension = mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : "png"
      const inputFile = await toFile(
        Buffer.from(imageBase64, "base64"),
        `input.${extension}`,
        { type: mimeType },
      )

      const response = await client.images.edit({
        model,
        image: inputFile,
        prompt: text,
        size: size as OpenAI.Images.ImageEditParams["size"],
      })

      const images = toGeneratedImages(response.data)
      if (images.length === 0) {
        throw new Error("OpenAIが画像データを返しませんでした")
      }
      return { images, model }
    }

    const response = await client.images.generate({
      model,
      prompt: text,
      size: size as OpenAI.Images.ImageGenerateParams["size"],
      n: 1,
    })

    const images = toGeneratedImages(response.data)
    if (images.length === 0) {
      throw new Error("OpenAIが画像データを返しませんでした")
    }
    return { images, model }
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
