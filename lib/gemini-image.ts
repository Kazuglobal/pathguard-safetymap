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

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"
import { getSanitizedGeminiApiKey } from "./gemini-util"
export const FORCED_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview"

// Security: Allowed domains for file downloads (SSRF protection)
const ALLOWED_DOWNLOAD_HOSTS = [
  'generativelanguage.googleapis.com',
  'storage.googleapis.com',
  'lh3.googleusercontent.com',
]

// Security: Allowed MIME types for images
const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

// Security: Limits to prevent large payloads or excessive images
const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8MB
const MAX_IMAGE_COUNT = 8

// Helper to validate and sanitize MIME type
function sanitizeMimeType(mimeType: string | undefined | null): string {
  if (typeof mimeType === 'string' && ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    return mimeType
  }
  return 'image/png'
}

function isAllowedDownloadUrl(url: URL): boolean {
  return url.protocol === 'https:' && ALLOWED_DOWNLOAD_HOSTS.includes(url.hostname)
}

function estimateBase64Bytes(base64: string): number {
  const len = base64.length
  if (len === 0) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((len * 3) / 4) - padding)
}

// Helper to validate model name (alphanumeric, dash, dot, underscore only)
function sanitizeModelName(model: string): string {
  return model.replace(/[^a-zA-Z0-9._-]/g, '')
}

// Per-call timeout to prevent hanging on slow API responses.
const DEFAULT_PER_CALL_TIMEOUT_MS = 30_000
const PRO_IMAGE_PER_CALL_TIMEOUT_MS = 40_000
const REQUEST_TIMEOUT_BUDGET_MS = 55_000
const MIN_CALL_TIMEOUT_MS = 5_000
const IMAGE_ONLY_RETRY_INSTRUCTION =
  "Strict output requirement: Return exactly one generated image and no text."

// Imagen models use the :predict endpoint; Gemini models use :generateContent
function isImagenModel(model: string): boolean {
  return model.startsWith('imagen-')
}

function getPerCallTimeoutMs(model: string): number {
  if (/pro-image-preview/i.test(model)) {
    return PRO_IMAGE_PER_CALL_TIMEOUT_MS
  }
  return DEFAULT_PER_CALL_TIMEOUT_MS
}

export function getImageModel(): string {
  return FORCED_GEMINI_IMAGE_MODEL
}

function buildGenerateContentRequestBody({
  promptText,
  imageBase64,
  imageMimeType,
  imageOnly,
}: {
  promptText: string
  imageBase64?: string
  imageMimeType?: string | null
  imageOnly: boolean
}): Record<string, unknown> {
  const fullPrompt = imageOnly ? `${promptText}\n\n${IMAGE_ONLY_RETRY_INSTRUCTION}` : promptText
  return {
    contents: [
      {
        role: "user",
        parts: [
          ...(imageBase64 && imageMimeType
            ? [{ inlineData: { mimeType: imageMimeType, data: imageBase64 } }]
            : []),
          { text: fullPrompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      topP: 0.9,
      responseModalities: imageOnly ? ["IMAGE"] : ["IMAGE", "TEXT"],
    },
  }
}

async function tryImagesGenerate(
  apiKey: string,
  model: string,
  prompt: string,
  timeoutMs: number,
  imageBase64?: string,
  imageMimeType?: string
) {
  // Security: Sanitize model name to prevent URL injection
  const safeModel = sanitizeModelName(model)

  // Use Imagen API with correct format
  const body: any = {
    instances: [{ prompt }],
    parameters: { sampleCount: imageBase64 ? 2 : 4 }
  }

  // Note: For image-to-image, we may need a different approach
  // The standard Imagen API is primarily text-to-image
  if (imageBase64 && imageMimeType) {
    // Add reference image if the model supports it
    body.instances[0].referenceImage = { mimeType: sanitizeMimeType(imageMimeType), data: imageBase64 }
  }

  const url = `${GEMINI_API_URL}/models/${safeModel}:predict`
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  return res
}

async function downloadToBase64(uri: string, apiKey: string): Promise<{ mimeType: string; dataUrl: string } | null> {
  try {
    // Security: Validate URL host to prevent SSRF attacks
    let parsed: URL
    try {
      parsed = new URL(uri)
    } catch {
      console.warn('[Gemini] Invalid URL for download:', uri)
      return null
    }

    if (!isAllowedDownloadUrl(parsed)) {
      console.warn('[Gemini] Blocked download from untrusted host:', parsed.hostname)
      return null
    }

    let url = uri
    if (!/\balt=media\b/.test(url)) {
      url += (url.includes('?') ? '&' : '?') + 'alt=media'
    }
    const r = await fetch(url, { headers: { 'X-Goog-Api-Key': apiKey }, redirect: 'manual' })
    if (r.status >= 300 && r.status < 400) {
      const location = r.headers.get('location')
      if (!location) return null
      const nextUrl = new URL(location, url)
      if (!isAllowedDownloadUrl(nextUrl)) {
        console.warn('[Gemini] Blocked redirect to untrusted host:', nextUrl.hostname)
        return null
      }
      const redirected = await fetch(nextUrl.toString(), { headers: { 'X-Goog-Api-Key': apiKey }, redirect: 'manual' })
      if (!redirected.ok) return null
      const len = Number(redirected.headers.get('content-length') || '0')
      if (len > MAX_IMAGE_BYTES) return null
      const buf = Buffer.from(await redirected.arrayBuffer())
      if (buf.length > MAX_IMAGE_BYTES) return null
      const mt = sanitizeMimeType(redirected.headers.get('content-type'))
      const b64 = buf.toString('base64')
      return { mimeType: mt, dataUrl: `data:${mt};base64,${b64}` }
    }
    if (!r.ok) return null
    const len = Number(r.headers.get('content-length') || '0')
    if (len > MAX_IMAGE_BYTES) return null
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > MAX_IMAGE_BYTES) return null
    // Security: Validate and sanitize MIME type from header
    const mt = sanitizeMimeType(r.headers.get('content-type'))
    const b64 = buf.toString('base64')
    return { mimeType: mt, dataUrl: `data:${mt};base64,${b64}` }
  } catch {
    return null
  }
}

async function extractImagesFromAny(data: any, apiKey: string): Promise<GeneratedImage[]> {
  const images: GeneratedImage[] = []
  const fileUris: { uri: string; mimeType?: string }[] = []

  const tryPushImage = (mimeType: string | undefined | null, base64: string) => {
    if (images.length >= MAX_IMAGE_COUNT) return
    const bytes = estimateBase64Bytes(base64)
    if (bytes > MAX_IMAGE_BYTES) return
    const mt = sanitizeMimeType(mimeType)
    images.push({ mimeType: mt, dataUrl: `data:${mt};base64,${base64}` })
  }

  // Handle Imagen API response format (generatedImages with imageBytes)
  if (data.predictions && Array.isArray(data.predictions)) {
    for (const pred of data.predictions) {
      if (pred.bytesBase64Encoded) {
        tryPushImage(pred.mimeType, pred.bytesBase64Encoded)
      }
    }
  }

  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return

    // Imagen format: imageBytes or bytesBase64Encoded
    if (typeof node.imageBytes === 'string' && node.imageBytes.length > 100) {
      tryPushImage(node.mimeType, node.imageBytes)
    }
    if (typeof node.bytesBase64Encoded === 'string' && node.bytesBase64Encoded.length > 100) {
      tryPushImage(node.mimeType, node.bytesBase64Encoded)
    }

    // direct inline
    if (typeof node.data === 'string' && node.data.length > 100) {
      tryPushImage(node.mime_type || node.mimeType, node.data)
    }
    // nested image object
    if (node.image && typeof node.image === 'object' && typeof node.image.data === 'string') {
      tryPushImage(node.image.mimeType || node.image.mime_type, node.image.data)
    }
    // inlineData / inline_data
    if (node.inlineData || node.inline_data) {
      const inline = node.inlineData || node.inline_data
      if (inline?.data) {
        tryPushImage(inline.mimeType || inline.mime_type, inline.data)
      }
    }
    // fileData / file_data with URI
    const fd = node.fileData || node.file_data
    if (fd && (fd.fileUri || fd.file_uri)) {
      const uri = fd.fileUri || fd.file_uri
      const mt = fd.mimeType || fd.mime_type
      fileUris.push({ uri, mimeType: mt })
    }
    if (node.image && typeof node.image === 'object') {
      const uri = node.image.uri || node.image.fileUri || node.image.file_uri
      if (uri) fileUris.push({ uri, mimeType: node.image.mimeType || node.image.mime_type })
    }
    for (const k of Object.keys(node)) {
      const v = (node as any)[k]
      if (v && typeof v === 'object') visit(v)
      if (Array.isArray(v)) v.forEach(visit)
    }
  }
  visit(data)
  // Download any referenced files
  for (const it of fileUris) {
    if (images.length >= MAX_IMAGE_COUNT) break
    const mt = (it.mimeType as string | undefined) || 'image/png'
    if (!mt.startsWith('image/')) continue
    const downloaded = await downloadToBase64(it.uri, apiKey)
    if (downloaded) images.push(downloaded)
  }

  // Remove duplicates based on dataUrl (same image data may be extracted multiple times)
  const uniqueImages = images.filter((img, index, self) =>
    index === self.findIndex(t => t.dataUrl === img.dataUrl)
  )
  return uniqueImages
}

export async function generateImageWithGemini({
  prompt,
  imageBase64,
  imageMimeType,
}: GenerateImageParams): Promise<GeneratedImage[]> {
  const result = await generateImageWithGeminiWithModel({
    prompt,
    imageBase64,
    imageMimeType,
  })
  return result.images
}
export async function generateImageWithGeminiWithModel({
  prompt,
  imageBase64,
  imageMimeType,
  model: _model,
}: GenerateImageParams): Promise<GenerateImageResult> {
  const apiKey = getSanitizedGeminiApiKey()

  // Product requirement: always use Gemini 3.1 flash image preview.
  const primaryModel = getImageModel()
  const modelsToTry = [primaryModel]

  const text = prompt || "Create an image using the provided reference."
  let lastError: Error | null = null
  const startedAtMs = Date.now()
  const getCallTimeoutMs = (model: string): number => {
    const elapsedMs = Date.now() - startedAtMs
    const remainingBudgetMs = REQUEST_TIMEOUT_BUDGET_MS - elapsedMs
    if (remainingBudgetMs < MIN_CALL_TIMEOUT_MS) {
      throw new Error(`${model}: タイムアウト予算不足 (${remainingBudgetMs}ms remaining)`)
    }
    const baseTimeoutMs = imageBase64 ? PRO_IMAGE_PER_CALL_TIMEOUT_MS : getPerCallTimeoutMs(model)
    return Math.min(baseTimeoutMs, remainingBudgetMs)
  }

  for (const model of modelsToTry) {
    console.log(`[Gemini] Trying model: ${model}`)
    let initialCallTimeoutMs: number
    try {
      initialCallTimeoutMs = getCallTimeoutMs(model)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      break
    }

    // Imagen models use :predict endpoint
    if (isImagenModel(model)) {
      try {
        const primary = await tryImagesGenerate(apiKey, model, text, initialCallTimeoutMs, imageBase64, imageMimeType)
        if (primary.ok) {
          const payload = await primary.json()
          const primaryImages = await extractImagesFromAny(payload, apiKey)
          if (primaryImages.length > 0) {
            console.log(`[Gemini] Success with model: ${model} via :predict`)
            return { images: primaryImages, model }
          }
          lastError = new Error(`${model}: 画像データが返されませんでした`)
        } else {
          const errText = await primary.text()
          lastError = new Error(`${model}: ${primary.status} - ${errText}`)
          console.warn(`[Gemini] :predict failed for ${model}: ${errText}`)
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'TimeoutError') {
          lastError = new Error(`${model}: タイムアウト (${initialCallTimeoutMs}ms)`)
        } else {
          lastError = error instanceof Error ? error : new Error(String(error))
        }
        console.warn(`[Gemini] :predict error for ${model}:`, error)
      }
      continue
    }

    // Gemini models use :generateContent with responseModalities
    try {
      const safeModel = sanitizeModelName(model)
      const safeMimeType = imageMimeType ? sanitizeMimeType(imageMimeType) : null
      let lastGenerateTimeoutMs = initialCallTimeoutMs

      const tryGenerateContent = async (imageOnly: boolean): Promise<GeneratedImage[] | null> => {
        const callTimeoutMs = getCallTimeoutMs(model)
        lastGenerateTimeoutMs = callTimeoutMs
        const requestBody = buildGenerateContentRequestBody({
          promptText: text,
          imageBase64,
          imageMimeType: safeMimeType,
          imageOnly,
        })

        const res = await fetch(
          `${GEMINI_API_URL}/models/${encodeURIComponent(safeModel)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(callTimeoutMs),
          }
        )

        if (!res.ok) {
          const errText = await res.text()
          lastError = new Error(`${model}: ${res.status} - ${errText.slice(0, 200)}`)
          console.warn(`[Gemini] generateContent failed for ${model}: ${errText}`)
          return null
        }

        const data = await res.json()
        return extractImagesFromAny(data, apiKey)
      }

      const tryGenerateContentWithTimeoutRetry = async (imageOnly: boolean): Promise<GeneratedImage[] | null> => {
        try {
          return await tryGenerateContent(imageOnly)
        } catch (error) {
          if (!(error instanceof DOMException && error.name === 'TimeoutError')) {
            throw error
          }
          let retryTimeoutMs: number
          try {
            retryTimeoutMs = getCallTimeoutMs(model)
          } catch {
            throw error
          }
          console.warn(`[Gemini] generateContent timed out for ${model}; retrying once (${retryTimeoutMs}ms)`)
          return tryGenerateContent(imageOnly)
        }
      }

      const firstImages = await tryGenerateContentWithTimeoutRetry(false)
      if (firstImages && firstImages.length > 0) {
        console.log(`[Gemini] Success with model: ${model} via generateContent`)
        return { images: firstImages, model }
      }

      if (firstImages && firstImages.length === 0) {
        console.warn(`[Gemini] No image payload from ${model}; retrying once with IMAGE-only modality`)
        const retryImages = await tryGenerateContentWithTimeoutRetry(true)
        if (retryImages && retryImages.length > 0) {
          console.log(`[Gemini] Success with model: ${model} via generateContent retry`)
          return { images: retryImages, model }
        }
      }

      if (!lastError) {
        lastError = new Error(`${model}: 画像データが返されませんでした`)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        lastError = new Error(`${model}: タイムアウト (${lastGenerateTimeoutMs}ms)`)
        console.warn(`[Gemini] generateContent timed out for ${model}`)
      } else {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`[Gemini] generateContent error for ${model}:`, error)
      }
    }
  }

  // All models failed
  throw lastError || new Error("All image generation models failed. Please check your API key and model availability.")
}
