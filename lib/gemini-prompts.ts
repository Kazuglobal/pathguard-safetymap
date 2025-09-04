import { getSanitizedGeminiApiKey, getSanitizedGeminiModel } from "./gemini-util"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"

function extractFirstJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fence ? fence[1] : text
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start >= 0 && end > start) {
    const slice = candidate.slice(start, end + 1)
    try { return JSON.parse(slice) } catch {}
  }
  try { return JSON.parse(candidate) } catch {}
  throw new Error("Failed to parse JSON from Gemini response")
}

export type GeneratedPrompts = {
  riskObservation: {
    elements: string[]
    tableMarkdown: string
  }
  vizPrompt: string
  simulationPrompts: {
    earthquake: string
    typhoon: string
    flood: string
    fire: string
  }
}

export async function generateDisasterPrompts(
  imageBase64OrDataUrl: string,
  opts?: { language?: "ja" | "en"; customHazards?: string[] }
): Promise<GeneratedPrompts> {
  if (!imageBase64OrDataUrl || imageBase64OrDataUrl.length < 50) {
    throw new Error("画像データが不足しています")
  }

  const apiKey = getSanitizedGeminiApiKey()
  const model = getSanitizedGeminiModel("gemini-2.5-flash")

  let mimeType = "image/jpeg"
  let dataBase64 = imageBase64OrDataUrl
  if (imageBase64OrDataUrl.startsWith("data:")) {
    const m = imageBase64OrDataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) throw new Error("画像のdata URLが不正です")
    mimeType = m[1]
    dataBase64 = m[2]
  }

  const hazardList = (opts?.customHazards && opts.customHazards.length > 0)
    ? opts.customHazards.join(", ")
    : "earthquake, typhoon (strong wind), heavy rain (flooding), fire"

  const instruction = `You are a bilingual (Japanese and English) disaster-risk visualization assistant called "防災イメージアシスタントGPT". Always respond in Japanese unless specified otherwise. Do not include any addresses or personal information.

Analyze the uploaded photo and return only JSON with this exact shape:
{
  "riskObservation": {
    "elements": ["..."],
    "tableMarkdown": "| ハザード | リスク | 対策 |\n|---|---|---|\n..."
  },
  "vizPrompt": "<English prompt for a single infographic with semi-transparent overlays and warning icons>",
  "simulationPrompts": {
    "earthquake": "<English>",
    "typhoon": "<English>",
    "flood": "<English>",
    "fire": "<English>"
  }
}

Rules:
- Step 1 (Risk Observation):
  - List visually identifiable elements (fences, utility poles, buildings, trees, drainage, tactile paving, etc.).
  - For each of these four hazards: ${hazardList}
    - Provide 2–3 expected risks.
    - Provide simple, specific on-the-spot countermeasures.
  - Summarize in a compact Markdown table in Japanese.
- Step 2 (Hazard Visualization Prompt):
  - Output in English a prompt to generate one infographic overlay image based on the uploaded photo.
  - Use semi-transparent shading + warning icons. Example styles: collapsed fence (red shade + exclamation icons, label "フェンス倒壊"), fallen utility pole (red circle + arrow, label "電柱倒壊"), flooding (blue shade + droplet icon, label "冠水"), fire spread (orange flame icon, label "延焼").
  - Specify photorealistic, 2K quality, and do not mention any model names.
- Step 3 (Post-Disaster Simulation Prompts):
  - Output in English four prompts keeping the same viewpoint and daylight: earthquake aftermath (fallen fence & utility pole, debris), typhoon-class wind (bent fence, scattered branches, wet surface), flash flood (20 cm water, reflections, floating rubbish), post-fire aftermath (burnt car beyond fence, warped wire, smoke). Photorealistic, 2K, Japanese suburban street, no people.
- If no image is present, ask to upload; not applicable here since image is provided.
Return only JSON. No explanations.`

  const parts: any[] = [
    { inline_data: { mime_type: mimeType, data: dataBase64 } },
    { text: instruction },
  ]

  const res = await fetch(
    `${GEMINI_API_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }] }),
    }
  )
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gemini prompts failed: ${res.status} ${res.statusText} - ${t}`)
  }
  const data = await res.json()
  const textPart = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
  if (typeof textPart !== "string") throw new Error("Gemini returned no text for prompts")
  const parsed = extractFirstJson(textPart)

  return {
    riskObservation: {
      elements: Array.isArray(parsed?.riskObservation?.elements) ? parsed.riskObservation.elements.map((e: any) => String(e)) : [],
      tableMarkdown: String(parsed?.riskObservation?.tableMarkdown || ""),
    },
    vizPrompt: String(parsed?.vizPrompt || "Generate a 2K photorealistic infographic overlay of hazards with Japanese labels."),
    simulationPrompts: {
      earthquake: String(parsed?.simulationPrompts?.earthquake || "Photorealistic 2K, earthquake aftermath."),
      typhoon: String(parsed?.simulationPrompts?.typhoon || "Photorealistic 2K, after typhoon-class wind."),
      flood: String(parsed?.simulationPrompts?.flood || "Photorealistic 2K, flash flood 20cm."),
      fire: String(parsed?.simulationPrompts?.fire || "Photorealistic 2K, post-fire aftermath."),
    },
  }
}

