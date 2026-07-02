import { getSanitizedGeminiApiKey, getSanitizedGeminiVisionModel } from "./gemini-util"
import { FALLBACK_SIMULATION_PROMPTS, FALLBACK_VIZ_PROMPT } from "./disaster-image-prompt-fallbacks"

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
  const model = getSanitizedGeminiVisionModel("gemini-2.5-flash")

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
- Provide a single polished English prompt for standard hazard-visualization (not post-disaster destruction) for the Gemini Image Generation API.
- The prompt must enforce strict scene preservation: same camera position, lens, perspective, horizon, daylight, object layout, and the ORIGINAL ASPECT RATIO of the uploaded photo. No scene replacement, no cropping to a different format, and no new people/vehicles/buildings.
- Select ONLY hazards whose anchor object is actually visible in this photo — never force all four and never invent an object to justify a label. Use this fixed Japanese label vocabulary for the hazards you include: "フェンス倒壊注意" (fence/block wall), "電柱倒壊注意" (utility pole), "冠水注意" (low spot/drainage/gutter), "延焼注意" (adjacent dense or wooden buildings). If only two hazards are grounded in the photo, mark exactly two.
- Require location-anchored callouts (semi-transparent polygons, arrows, warning icons, numbered markers with short leader lines) and a compact Japanese legend listing only the colors actually used, drawn from: "凡例 赤=倒壊・落下注意 / 青=冠水注意 / 橙=火災注意".
- Require that any visible faces or license plates be rendered unrecognizable.
- Require realistic civic-infographic quality (HDR, sharp focus, balanced contrast, mobile-readable labels; Japanese text rendered accurately with no garbled characters) and explicitly forbid gore, graphic destruction, extra text, watermarks, or model names.

Step 3 – Post-Disaster Simulation Prompts
- CRITICAL REALISM RULE: First analyze the actual condition of every structure visible in the photo (walls, fences, utility poles, buildings, signs, roads). Calibrate the simulated damage PROPORTIONALLY to the observed condition:
  • New/well-maintained structures (clean surfaces, no cracks, straight alignment): show only MINOR effects (hairline cracks, slight dust, small displacement)
  • Aging but intact structures (some discoloration, minor wear): show MODERATE effects (visible cracks, slight tilting, partial damage)
  • Visibly deteriorated structures (existing cracks, rust, tilting, crumbling mortar): show SIGNIFICANT effects (partial collapse, major tilting, fallen sections)
- Provide four English prompts (earthquake aftermath, typhoon-class wind aftermath, flash flood, post-fire) for the Gemini Image Generation API.
- Each prompt must maintain the original camera framing, lens, daylight conditions, and the uploaded photo's aspect ratio unless the hazard inherently affects the scene (e.g., reflective floodwater, thin haze from distant smoke).
- Each prompt must request a photorealistic high-resolution image with high dynamic range, Japanese suburban street context, no people, no added vehicles, no recognizable faces or license plates, and no model names.
- Each prompt MUST describe the specific structures visible in the photo and their realistic damage based on the condition analysis above. Do NOT use generic catastrophic descriptions.
- FORBIDDEN: explosion-like imagery, dramatic dust clouds, completely flattened structures (unless already severely deteriorated), burning vehicles, large fires in frame, any imagery that would cause excessive fear or anxiety.
- Specify hazard-specific visuals realistically based on what is in the photo:
  • Earthquake (震度5強 equivalent — strong but not catastrophic): For new block walls show only hairline cracks and minor mortar dust; for old block walls with existing cracks show partial tilting or a few fallen blocks; utility poles may lean slightly; minor debris from loose items only. Road surface may have small cracks. Overall scene should look shaken but NOT devastated.
  • Typhoon (wind speed ~30m/s — strong but survivable): Lightweight objects displaced; tree branches broken (not uprooted unless tree is obviously weak); fences slightly bent or rattling; wet pavement with scattered leaves; signs may be tilted. Avoid showing destruction of solid structures.
  • Flash flood (~15-20 cm water depth — ankle to shin level): Muddy water covering lower portions of road; realistic water reflections and ripples; small floating debris (leaves, trash); water line visible on walls and curbs. Water should look like actual floodwater (brownish, not crystal clear).
  • Fire (nearby fire, NOT in frame — signs of proximity): Thin smoke haze reducing visibility slightly; light soot on surfaces nearest to assumed fire direction; no active flames visible in the scene; slight orange tint in haze. Scene should suggest a fire occurred nearby, not that everything is burning.

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
        : FALLBACK_VIZ_PROMPT,
    simulationPrompts: {
      earthquake:
        typeof parsed?.simulationPrompts?.earthquake === "string" && parsed.simulationPrompts.earthquake.trim().length > 0
          ? parsed.simulationPrompts.earthquake
          : FALLBACK_SIMULATION_PROMPTS.earthquake,
      typhoon:
        typeof parsed?.simulationPrompts?.typhoon === "string" && parsed.simulationPrompts.typhoon.trim().length > 0
          ? parsed.simulationPrompts.typhoon
          : FALLBACK_SIMULATION_PROMPTS.typhoon,
      flood:
        typeof parsed?.simulationPrompts?.flood === "string" && parsed.simulationPrompts.flood.trim().length > 0
          ? parsed.simulationPrompts.flood
          : FALLBACK_SIMULATION_PROMPTS.flood,
      fire:
        typeof parsed?.simulationPrompts?.fire === "string" && parsed.simulationPrompts.fire.trim().length > 0
          ? parsed.simulationPrompts.fire
          : FALLBACK_SIMULATION_PROMPTS.fire,
    },
  }
}
