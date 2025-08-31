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

export async function generateImageWithGemini({
  prompt,
  imageBase64,
  imageMimeType,
}: GenerateImageParams): Promise<GeneratedImage[]> {
  const apiKey = getSanitizedGeminiApiKey()

  // Prefer the 2.5 Flash Image-capable model by default; can be overridden via env
  const model = getSanitizedGeminiModel("gemini-2.5-flash")

  const parts: any[] = []
  if (imageBase64 && imageMimeType) {
    parts.push({
      inline_data: {
        mime_type: imageMimeType,
        data: imageBase64,
      },
    })
  }
  parts.push({ text: prompt || "Create an image using the provided reference." })

  const body = {
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    tools: [
      {
        image_generation: {},
      },
    ],
  }

  const res = await fetch(
    `${GEMINI_API_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini request failed: ${res.status} ${res.statusText} - ${text}`)
  }

  const data = await res.json()
  const images: GeneratedImage[] = []

  const candidates = data?.candidates || []
  for (const c of candidates) {
    const parts = c?.content?.parts || []
    for (const p of parts) {
      const inline = p?.inline_data
      if (inline?.data && inline?.mime_type?.startsWith("image/")) {
        images.push({
          mimeType: inline.mime_type,
          dataUrl: `data:${inline.mime_type};base64,${inline.data}`,
        })
      }
    }
  }

  if (images.length === 0) {
    throw new Error("No image data returned from Gemini")
  }

  return images
}
