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
  const model = getSanitizedGeminiModel("gemini-2.5-flash-image-preview")

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
  const tableHeader = opts?.language === "en"
    ? "| Hazard | Expected Risks (examples) | Immediate Countermeasures (examples) |"
    : "| ハザード | 想定リスク (例) | その場でできる対策 (例) |"
  const languageInstruction = opts?.language === "en"
    ? "Respond in natural, professional English."
    : "Respond in natural, professional Japanese."
  const countermeasureLanguage = opts?.language === "en" ? "in English" : "in Japanese"
  const uploadMessage = opts?.language === "en" ? "Please upload an image." : "画像をアップロードしてください。"

  const instruction = `You are a bilingual (Japanese and English) disaster-risk visualization assistant called "ドクイメージアシスタントGPT". ${languageInstruction} Do not include any addresses or personal information.

If the input image is missing or blank, respond only with "${uploadMessage}".

Analyze the uploaded photo and return only JSON with this exact shape:
{
  "riskObservation": {
    "elements": ["..."],
    "tableMarkdown": "${tableHeader}\n|---|---|---|\n..."
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
  - For each hazard in this list (include custom wording exactly as provided): ${hazardList}
    - Describe 2-3 expected risks.
    - Suggest simple, specific on-the-spot countermeasures ${countermeasureLanguage}.
  - Summarize in a compact Markdown table using the header shown above.
- Step 2 (Hazard Visualization Prompt):
  - Output in English a prompt to generate one infographic overlay image based on the uploaded photo.
  - Use semi-transparent shading with warning icons. Example styles: collapsed fence (red shade + exclamation icons, label "フェンス倒壊"), fallen utility pole (red circle + arrow, label "電柱倒壊"), flooding (blue shade + droplet icon, label "冠水"), fire spread (orange flame icon, label "延焼").
  - Specify photorealistic, 2K quality, and explicitly state not to mention any generation model names (e.g., DALLE, SD).
- Step 3 (Post-Disaster Simulation Prompts):
  - Output in English four prompts keeping the same viewpoint and daylight: earthquake aftermath (fallen fence & utility pole with debris), typhoon-class wind (bent fence, scattered branches, wet surface), flash flood (20 cm water with reflections and floating rubbish), post-fire aftermath (burnt car beyond the fence, warped wire mesh, drifting smoke). Ensure photorealistic 2K quality for a Japanese suburban street and no people are present.
- Acknowledge language switching or hazard customization requests if they differ from the defaults.
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
    vizPrompt: String(
      parsed?.vizPrompt
        || "Photorealistic 2K infographic from the same viewpoint as the uploaded Japanese suburban street photo with semi-transparent hazard shading, warning icons, and Japanese labels (フェンス倒壊, 電柱倒壊, 冠水, 延焼). No people, no vehicles, no watermarks, and do not mention any model names."
    ),
    simulationPrompts: {
      earthquake: String(
        parsed?.simulationPrompts?.earthquake
          || "Photorealistic 2K render from the same viewpoint and daylight showing a major earthquake aftermath with a collapsed fence, fallen utility pole, scattered debris, and light dust. No people, no vehicles, no watermarks, no model names."
      ),
      typhoon: String(
        parsed?.simulationPrompts?.typhoon
          || "Photorealistic 2K render from the same viewpoint and daylight right after typhoon-class strong wind with a bent fence, scattered branches and leaves, and wet pavement with shallow puddles. No people, no vehicles, no watermarks, no model names."
      ),
      flood: String(
        parsed?.simulationPrompts?.flood
          || "Photorealistic 2K render from the same viewpoint and daylight during a flash flood with about 20 cm of water, reflections, ripples, and floating rubbish. No people, no vehicles, no watermarks, no model names."
      ),
      fire: String(
        parsed?.simulationPrompts?.fire
          || "Photorealistic 2K render from the same viewpoint and daylight after a nearby fire with a burnt car beyond the fence, warped wire mesh, lingering smoke, and soot on surfaces. No people, no vehicles, no watermarks, no model names."
      ),
    },
  }
}

