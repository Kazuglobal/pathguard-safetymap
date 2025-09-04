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
import { getSanitizedGeminiApiKey, getSanitizedGeminiModel } from "./gemini-util"

async function tryImagesGenerate(apiKey: string, model: string, prompt: string, imageBase64?: string, imageMimeType?: string) {
  // Prefer the new Images API
  const body: any = {
    model: `models/${model}`,
    prompt: { text: prompt },
  }
  if (imageBase64 && imageMimeType) {
    body.image = { mimeType: imageMimeType, data: imageBase64 }
  }
  const url = `${GEMINI_API_URL}/images:generate?key=${encodeURIComponent(apiKey)}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return res
}

async function downloadToBase64(uri: string, apiKey: string): Promise<{ mimeType: string; dataUrl: string } | null> {
  try {
    let url = uri
    if (!/\bkey=/.test(url)) {
      url += (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(apiKey)
    }
    if (!/\balt=media\b/.test(url)) {
      url += '&alt=media'
    }
    const r = await fetch(url, { headers: { 'X-Goog-Api-Key': apiKey } })
    if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer())
    // Try to read mime from header; fallback to png
    const mt = r.headers.get('content-type') || 'image/png'
    const b64 = buf.toString('base64')
    return { mimeType: mt, dataUrl: `data:${mt};base64,${b64}` }
  } catch {
    return null
  }
}

async function extractImagesFromAny(data: any, apiKey: string): Promise<GeneratedImage[]> {
  const images: GeneratedImage[] = []
  const fileUris: { uri: string; mimeType?: string }[] = []
  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return
    // direct inline
    if (typeof node.data === 'string' && node.data.length > 100) {
      const mt = node.mime_type || node.mimeType || 'image/png'
      if (typeof mt === 'string' && mt.startsWith('image/')) {
        images.push({ mimeType: mt, dataUrl: `data:${mt};base64,${node.data}` })
      }
    }
    // nested image object
    if (node.image && typeof node.image === 'object' && typeof node.image.data === 'string') {
      const mt = node.image.mimeType || node.image.mime_type || 'image/png'
      images.push({ mimeType: mt, dataUrl: `data:${mt};base64,${node.image.data}` })
    }
    // inlineData / inline_data
    if (node.inlineData || node.inline_data) {
      const inline = node.inlineData || node.inline_data
      if (inline?.data) {
        const mt = inline.mimeType || inline.mime_type || 'image/png'
        images.push({ mimeType: mt, dataUrl: `data:${mt};base64,${inline.data}` })
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
    const mt = (it.mimeType as string | undefined) || 'image/png'
    if (!mt.startsWith('image/')) continue
    const downloaded = await downloadToBase64(it.uri, apiKey)
    if (downloaded) images.push(downloaded)
  }
  return images
}

export async function generateImageWithGemini({
  prompt,
  imageBase64,
  imageMimeType,
}: GenerateImageParams): Promise<GeneratedImage[]> {
  const apiKey = getSanitizedGeminiApiKey()

  // Use the image generation capable model
  const model = getSanitizedGeminiModel("gemini-2.5-flash-image-preview")

  const text = prompt || "Create an image using the provided reference."

  // Build request body for generateContent API
  const requestBody: any = {
    contents: [
      {
        role: "user",
        parts: [
          ...(imageBase64 && imageMimeType
            ? [{ inline_data: { mime_type: imageMimeType, data: imageBase64 } }]
            : []),
          { text },
        ],
      },
    ],
    generation_config: {
      response_mime_type: "application/json"
    }
  }

  const res = await fetch(
    `${GEMINI_API_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(requestBody) 
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini image generation failed: ${res.status} ${res.statusText} - ${text}`)
  }

  const data = await res.json()
  // Try to extract images from any shape; also download file URIs when present
  const images = await extractImagesFromAny(data, apiKey)

  if (images.length === 0) {
    throw new Error("No image data returned from Gemini. Response: " + JSON.stringify(data, null, 2))
  }

  return images
}
