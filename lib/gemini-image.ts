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
  // Use Imagen API with correct format
  const body: any = {
    instances: [{ prompt }],
    parameters: { sampleCount: imageBase64 ? 2 : 4 }
  }

  // Note: For image-to-image, we may need a different approach
  // The standard Imagen API is primarily text-to-image
  if (imageBase64 && imageMimeType) {
    // Add reference image if the model supports it
    body.instances[0].referenceImage = { mimeType: imageMimeType, data: imageBase64 }
  }

  const url = `${GEMINI_API_URL}/models/${model}:predict`
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

  // Handle Imagen API response format (generatedImages with imageBytes)
  if (data.predictions && Array.isArray(data.predictions)) {
    for (const pred of data.predictions) {
      if (pred.bytesBase64Encoded) {
        const mt = pred.mimeType || 'image/png'
        images.push({ mimeType: mt, dataUrl: `data:${mt};base64,${pred.bytesBase64Encoded}` })
      }
    }
  }

  const visit = (node: any) => {
    if (!node || typeof node !== 'object') return

    // Imagen format: imageBytes or bytesBase64Encoded
    if (typeof node.imageBytes === 'string' && node.imageBytes.length > 100) {
      const mt = node.mimeType || 'image/png'
      images.push({ mimeType: mt, dataUrl: `data:${mt};base64,${node.imageBytes}` })
    }
    if (typeof node.bytesBase64Encoded === 'string' && node.bytesBase64Encoded.length > 100) {
      const mt = node.mimeType || 'image/png'
      images.push({ mimeType: mt, dataUrl: `data:${mt};base64,${node.bytesBase64Encoded}` })
    }

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

  // Use the Gemini 3 Pro Image Preview model for image generation
  const model = getSanitizedGeminiModel("gemini-3-pro-image-preview")

  const text = prompt || "Create an image using the provided reference."

  // First attempt: dedicated images:generate endpoint (preferred per Gemini docs)
  try {
    const primary = await tryImagesGenerate(apiKey, model, text, imageBase64, imageMimeType)
    if (primary.ok) {
      const payload = await primary.json()
      const primaryImages = await extractImagesFromAny(payload, apiKey)
      if (primaryImages.length > 0) {
        return primaryImages
      }
    } else {
      // If the endpoint rejects (e.g., unsupported model), fall through to generateContent
      await primary.text() // consume body for debugging; ignore content
    }
  } catch (error) {
    console.warn("[Gemini] images:generate fallback triggered", error)
  }

  // Fallback: generateContent without response_mime_type (text-based response)
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
      temperature: 0.4,
      top_p: 0.9,
    },
  }

  const res = await fetch(
    `${GEMINI_API_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }
  )

  if (!res.ok) {
    const responseText = await res.text()
    throw new Error(`Gemini image generation failed: ${res.status} ${res.statusText} - ${responseText}`)
  }

  const data = await res.json()
  const images = await extractImagesFromAny(data, apiKey)

  if (images.length === 0) {
    throw new Error("No image data returned from Gemini. Response: " + JSON.stringify(data, null, 2))
  }

  return images
}
