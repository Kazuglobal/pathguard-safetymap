import { getSanitizedGeminiApiKey, getSanitizedGeminiModel } from "./gemini-util"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"

function extractFirstJson(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fence ? fence[1] : text
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start >= 0 && end > start) {
    const slice = candidate.slice(start, end + 1)
    try {
      return JSON.parse(slice)
    } catch {
      /* ignore */
    }
  }
  try {
    return JSON.parse(candidate)
  } catch {
    /* ignore */
  }
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
    throw new Error("\u753b\u50cf\u30c7\u30fc\u30bf\u304c\u4e0d\u8db3\u3057\u3066\u3044\u307e\u3059")
  }

  const apiKey = getSanitizedGeminiApiKey()
  const model = getSanitizedGeminiModel("gemini-2.5-flash-image-preview")

  let mimeType = "image/jpeg"
  let dataBase64 = imageBase64OrDataUrl
  if (imageBase64OrDataUrl.startsWith("data:")) {
    const m = imageBase64OrDataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!m) throw new Error("\u753b\u50cf\u304cdata URL\u3068\u3057\u3066\u4e0d\u6b63\u3067\u3059")
    mimeType = m[1]
    dataBase64 = m[2]
  }

  const hazardList =
    opts?.customHazards && opts.customHazards.length > 0
      ? opts.customHazards.join(", ")
      : "earthquake, typhoon (strong wind), heavy rain (flooding), fire"

  const tableHeader =
    opts?.language === "en"
      ? "| Hazard | Expected Risks (examples) | Immediate Countermeasures (examples) |"
      : "| \u30cf\u30b6\u30fc\u30c9 | \u60f3\u5b9a\u30ea\u30b9\u30af (\u4f8b) | \u305d\u306e\u5834\u3067\u3067\u304d\u308b\u5bfe\u7b56 (\u4f8b) |"

  const languageInstruction =
    opts?.language === "en"
      ? "Respond in natural, professional English."
      : "Respond in natural, professional Japanese."

  const countermeasureLanguage = opts?.language === "en" ? "in English" : "in Japanese"

  const uploadMessage =
    opts?.language === "en"
      ? "Please upload an image."
      : "\u753b\u50cf\u3092\u30a2\u30c3\u30d7\u30ed\u30fc\u30c9\u3057\u3066\u304f\u3060\u3055\u3044\u3002"

  const instruction = `You are a bilingual (Japanese and English) disaster-risk visualization assistant named "DocuImage Assistant GPT". ${languageInstruction} Never output addresses, personal data, or other sensitive identifiers.

If the input image is missing or blank, respond only with "${uploadMessage}".

Follow this protocol exactly and return JSON only (no extra narration):

Step 1 – Risk Observation
- Inspect the uploaded photo and list visually identifiable elements (fences, utility poles, buildings, trees, vegetation, drainage, tactile paving, signage, parked vehicles, etc.).
- For each hazard in: ${hazardList} (use custom hazard wording exactly as supplied):
  - Describe 2–3 plausible, visually grounded risks revealed or implied by the scene.
  - Suggest simple, specific on-the-spot countermeasures ${countermeasureLanguage}.
- Summarize the findings in a compact Markdown table using this header:
  ${tableHeader}
  |---|---|---|
- Keep entries concise and actionable while avoiding private information.

Step 2 – Hazard Visualization Prompt
- Provide a single English prompt suited for the Gemini Image Generation API (Gemini 2.5 Flash Image) that creates one photorealistic 2048×2048 infographic.
- Requirements: retain the same camera position, lens, perspective, and daylight as the uploaded photo; natural color grading; crisp focus; high dynamic range; Japanese suburban street context; do not introduce new people or vehicles.
- Describe semi-transparent overlays and warning icons for each hazard, with the specified Japanese labels: collapsed fence (red shade + exclamation icons, label "フェンス倒壊"), fallen utility pole (red circle + arrow, label "電柱倒壊"), flooding (blue haze + droplet icons, label "冠水"), fire spread (orange glow + flame icons, label "延焼"). Explicitly request “no extra text or watermarks” and forbid mentioning model names.

Step 3 – Post-Disaster Simulation Prompts
- Provide four English prompts (earthquake aftermath, typhoon-class wind aftermath, flash flood, post-fire) for the Gemini Image Generation API.
- Each prompt must maintain the original camera framing, lens, and daylight conditions unless the hazard inherently affects the scene (e.g., reflective floodwater, residual smoke).
- Each prompt must request a photorealistic 2048×2048 image with high dynamic range, Japanese suburban street context, no people, no added vehicles, and no model names.
- Specify hazard-specific visuals clearly:
  • Earthquake: collapsed fence, fallen utility pole, scattered debris.
  • Typhoon: bent or twisted fence, scattered branches and leaves, wet asphalt.
  • Flash flood: ~20 cm water depth, surface reflections, floating debris.
  • Fire aftermath: burnt car beyond the fence, warped wire mesh, lingering smoke/soot.

Language & customisation
- If language = "en", write the risk table and countermeasures in English; otherwise write them in Japanese.
- If custom hazards are provided, replace the default four hazards with the exact supplied list.

Return JSON with this exact structure:
{
  "riskObservation": {
    "elements": ["..."],
    "tableMarkdown": "..."
  },
  "vizPrompt": "<English prompt>",
  "simulationPrompts": {
    "earthquake": "<English>",
    "typhoon": "<English>",
    "flood": "<English>",
    "fire": "<English>"
  }
}

Do not output anything except the JSON object.`

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
    const text = await res.text()
    throw new Error(`Gemini prompts failed: ${res.status} ${res.statusText} - ${text}`)
  }

  const data = await res.json()
  const textPart = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
  if (typeof textPart !== "string") {
    throw new Error("Gemini returned no text for prompts")
  }

  const parsed = extractFirstJson(textPart)

  return {
    riskObservation: {
      elements: Array.isArray(parsed?.riskObservation?.elements)
        ? parsed.riskObservation.elements.map((element: any) => String(element))
        : [],
      tableMarkdown: String(parsed?.riskObservation?.tableMarkdown || ""),
    },
    vizPrompt:
      typeof parsed?.vizPrompt === "string" && parsed.vizPrompt.trim().length > 0
        ? parsed.vizPrompt
        : "Photorealistic 2048x2048 infographic from the same viewpoint as the uploaded Japanese suburban street photo. Maintain identical camera angle, daylight, and composition. Overlay semi-transparent hazard shading with warning icons and Japanese labels: collapsed fence (red shade + exclamation icons, label \"フェンス倒壊\"), fallen utility pole (red circle + arrow, label \"電柱倒壊\"), flooding (blue haze + droplet icons, label \"冠水\"), fire spread (orange glow + flame icons, label \"延焼\"). High dynamic range, sharp focus, no extra people, vehicles, text, or watermarks, and do not mention model names.",
    simulationPrompts: {
      earthquake:
        typeof parsed?.simulationPrompts?.earthquake === "string" && parsed.simulationPrompts.earthquake.trim().length > 0
          ? parsed.simulationPrompts.earthquake
          : "Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo, showing a major earthquake aftermath: collapsed fence, a fallen utility pole with loose wires, scattered masonry and debris, light dust in the air. High dynamic range, sharp focus, no people, no added vehicles, no watermarks, no model names.",
      typhoon:
        typeof parsed?.simulationPrompts?.typhoon === "string" && parsed.simulationPrompts.typhoon.trim().length > 0
          ? parsed.simulationPrompts.typhoon
          : "Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo right after typhoon-class strong wind: bent and partially collapsed fence, scattered branches and leaves, wet reflective pavement, displaced small objects. High dynamic range, sharp focus, no people, no extra vehicles, no watermarks, no model names.",
      flood:
        typeof parsed?.simulationPrompts?.flood === "string" && parsed.simulationPrompts.flood.trim().length > 0
          ? parsed.simulationPrompts.flood
          : "Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo during a flash flood: roughly 20 cm of water covering the road and sidewalk, realistic reflections, ripples, floating leaves and trash. High dynamic range, sharp focus, no people, no extra vehicles, no watermarks, no model names.",
      fire:
        typeof parsed?.simulationPrompts?.fire === "string" && parsed.simulationPrompts.fire.trim().length > 0
          ? parsed.simulationPrompts.fire
          : "Photorealistic 2048x2048 render from the same viewpoint and daylight as the uploaded Japanese suburban street photo after a nearby fire: burnt car beyond the fence, warped wire mesh, charred debris, lingering smoke or haze, soot on nearby surfaces. High dynamic range, sharp focus, no people, no extra vehicles, no watermarks, no model names.",
    },
  }
}
