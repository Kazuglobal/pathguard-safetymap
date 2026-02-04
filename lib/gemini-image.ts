export type GeneratedImage = {
  mimeType: string
  dataUrl: string
}

export type GenerateImageParams = {
  prompt?: string
  imageBase64?: string
  imageMimeType?: string
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"
import { getSanitizedGeminiApiKey } from "./gemini-util"

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

// Available image generation models (in order of preference)
const IMAGE_GEN_MODELS = [
  "gemini-3-pro-image-preview",                 // Gemini 3 Pro Image Preview (NanoBanana Pro)
  "gemini-2.0-flash-exp-image-generation",      // Gemini 2.0 Flash Exp Image Generation
  "gemini-2.0-flash-preview-image-generation",  // Gemini 2.0 Flash Preview
  "imagen-3.0-generate-001",                    // Imagen 3 standard
]

function getImageModel(): string {
  const envModel = process.env.GEMINI_IMAGE_MODEL?.trim()
  if (envModel && envModel.length > 0) {
    return envModel
  }
  return IMAGE_GEN_MODELS[0]
}

async function tryImagesGenerate(apiKey: string, model: string, prompt: string, imageBase64?: string, imageMimeType?: string) {
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
  const apiKey = getSanitizedGeminiApiKey()

  // Get the image generation model (user-specified or default)
  const primaryModel = getImageModel()

  // Build list of models to try (primary first, then fallbacks)
  const modelsToTry = [primaryModel, ...IMAGE_GEN_MODELS.filter(m => m !== primaryModel)]

  const text = prompt || "Create an image using the provided reference."
  let lastError: Error | null = null

  for (const model of modelsToTry) {
    console.log(`[Gemini] Trying model: ${model}`)

    // First attempt: dedicated images:generate endpoint (preferred per Gemini docs)
    try {
      const primary = await tryImagesGenerate(apiKey, model, text, imageBase64, imageMimeType)
      if (primary.ok) {
        const payload = await primary.json()
        const primaryImages = await extractImagesFromAny(payload, apiKey)
        if (primaryImages.length > 0) {
          console.log(`[Gemini] Success with model: ${model} via images:generate`)
          return primaryImages
        }
      } else {
        // If the endpoint rejects (e.g., unsupported model), fall through to generateContent
        const errText = await primary.text()
        console.warn(`[Gemini] images:generate failed for ${model}: ${errText}`)
      }
    } catch (error) {
      console.warn(`[Gemini] images:generate error for ${model}:`, error)
    }

    // Fallback: generateContent with response_modalities for native image generation
    try {
      // Security: Sanitize model name and MIME type
      const safeModel = sanitizeModelName(model)
      const safeMimeType = imageMimeType ? sanitizeMimeType(imageMimeType) : null

      const requestBody: any = {
        contents: [
          {
            role: "user",
            parts: [
              ...(imageBase64 && safeMimeType
                ? [{ inline_data: { mime_type: safeMimeType, data: imageBase64 } }]
                : []),
              { text },
            ],
          },
        ],
        generation_config: {
          temperature: 0.4,
          top_p: 0.9,
          response_modalities: ["IMAGE", "TEXT"],
        },
      }

      const res = await fetch(
        `${GEMINI_API_URL}/models/${encodeURIComponent(safeModel)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
          body: JSON.stringify(requestBody),
        }
      )

      if (res.ok) {
        const data = await res.json()
        const images = await extractImagesFromAny(data, apiKey)
        if (images.length > 0) {
          console.log(`[Gemini] Success with model: ${model} via generateContent`)
          return images
        }
      } else {
        const errText = await res.text()
        lastError = new Error(`${model}: ${res.status} ${res.statusText} - ${errText}`)
        console.warn(`[Gemini] generateContent failed for ${model}: ${errText}`)
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`[Gemini] generateContent error for ${model}:`, error)
    }
  }

  // All models failed
  throw lastError || new Error("All image generation models failed. Please check your API key and model availability.")
}
