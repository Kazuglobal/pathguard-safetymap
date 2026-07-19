import { getSanitizedGeminiApiKey, getSanitizedGeminiVisionModel } from "./gemini-util"
import {
  FALLBACK_SIMULATION_PROMPTS,
  FALLBACK_VIZ_PROMPT,
  UNVERIFIED_SAFE_HOUSE_ADDITION_GUARD,
} from "./disaster-image-prompt-fallbacks"

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

// Gemini Schema形式(type は大文字)。responseMimeType: application/json と併用する。
// structureConditions を vizPrompt/simulationPrompts より前に置く(condition-first: 台帳→プロンプトの生成順を propertyOrdering で強制)。
// この台帳は TypeScript の返却処理では読まない = GeneratedPrompts 型は不変。
const PROMPTS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: "OBJECT",
  properties: {
    riskObservation: {
      type: "OBJECT",
      properties: {
        elements: { type: "ARRAY", items: { type: "STRING" } },
        tableMarkdown: { type: "STRING" },
      },
      required: ["elements", "tableMarkdown"],
    },
    structureConditions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          object: { type: "STRING" },
          material: { type: "STRING" },
          conditionTier: { type: "STRING" },
          evidence: { type: "STRING" },
          maxDamage: { type: "STRING" },
        },
        required: ["object", "conditionTier", "maxDamage"],
      },
    },
    vizPrompt: { type: "STRING" },
    simulationPrompts: {
      type: "OBJECT",
      properties: {
        earthquake: { type: "STRING" },
        typhoon: { type: "STRING" },
        flood: { type: "STRING" },
        fire: { type: "STRING" },
      },
      required: ["earthquake", "typhoon", "flood", "fire"],
    },
  },
  required: ["riskObservation", "structureConditions", "vizPrompt", "simulationPrompts"],
  propertyOrdering: ["riskObservation", "structureConditions", "vizPrompt", "simulationPrompts"],
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
    flood: string | null
    fire: string
  }
}

export async function generateDisasterPrompts(
  imageBase64OrDataUrl: string,
  opts?: {
    language?: "ja" | "en"
    customHazards?: string[]
    accidentContext?: string
  }
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
  const accidentContextInstruction = opts?.accidentContext?.trim()
    ? `\n\nOBJECTIVE TRAFFIC-ACCIDENT CONTEXT (apply only to prioritization in vizPrompt; do not add objects absent from the photo and do not alter the four disaster simulation prompts):\n${opts.accidentContext.trim()}`
    : ""

  const uploadMessage =
    opts?.language === "en"
      ? "Please upload an image."
      : "\u753b\u50cf\u3092\u30a2\u30c3\u30d7\u30ed\u30fc\u30c9\u3057\u3066\u304f\u3060\u3055\u3044\u3002"

  const instruction = `You are a bilingual (Japanese and English) disaster-risk visualization assistant named "DocuImage Assistant GPT". ${languageInstruction} Never output addresses, personal data, or other sensitive identifiers.${accidentContextInstruction}

If the input image is missing or blank, return the JSON object described below with riskObservation.elements = [], riskObservation.tableMarkdown = "${uploadMessage}", structureConditions = [], and every prompt field set to "" (empty string).

LANGUAGE RULE: riskObservation.elements, every structureConditions entry, the vizPrompt, and all simulationPrompts MUST be written in English regardless of the response language above — they feed an English-language image-editing API, and no Japanese may appear in them except the fixed label strings quoted in Step 2. Only tableMarkdown and its countermeasures follow the response language.

EXECUTION FACT: the Gemini Image Generation API that later executes your vizPrompt and simulationPrompts receives THE SAME PHOTO you are analyzing now as an input image. Every prompt you write must therefore be an image-EDITING instruction that modifies the provided photo — never a request to create, imagine, or re-render a new scene.

Follow this protocol exactly and return JSON only (no extra narration):

Step 1 – Risk Observation
- Inspect the uploaded photo and list visually identifiable elements in English, each written as "<object> (<horizontal position: left/center/right>, <depth: foreground/midground/background>)", e.g. "concrete block wall (right, foreground)". These exact strings are the anchors quoted verbatim in Step 2 and Step 3.
- For each hazard in: ${hazardList} (use custom hazard wording exactly as supplied):
  - Describe 2–3 plausible, visually grounded risks revealed or implied by the scene.
  - Suggest simple, specific on-the-spot countermeasures ${countermeasureLanguage}.
- Summarize the findings in a compact Markdown table using this header:
  ${tableHeader}
  |---|---|---|
- Keep entries concise and actionable while avoiding private information.

Step 2 – Hazard Visualization Prompt (image-EDITING instruction)
- Provide one polished English prompt that adds a flat 2D hazard-annotation overlay layer on top of the provided photo.
- The prompt MUST begin with: "Using the provided photo as the immutable base image, add a flat 2D hazard-annotation overlay layer on top. Do not redraw, repaint, move, remove, or re-synthesize anything in the underlying photograph; every area not covered by an overlay must remain identical to the input photo. Keep the photo's exact framing and original aspect ratio."
- Select ONLY hazards whose anchor object appears in your Step 1 elements list — never force all four and never invent an object to justify a label. Default Japanese label vocabulary: "フェンス倒壊注意" (fence/block wall), "電柱倒壊注意" (utility pole), "冠水注意" (low spot/drainage/gutter), "延焼注意" (adjacent dense or wooden buildings). If custom hazards were supplied, use their exact supplied wording as labels instead. If only two hazards are grounded in the photo, mark exactly two.
- For each selected hazard write one compact marker line quoting its Step 1 element verbatim as the anchor: a semi-transparent polygon (about 40% fill opacity, solid outline) hugging the anchor object's silhouette, a numbered circular badge (white numeral on the same color), a short leader line, and the Japanese label on a high-contrast rounded pill beside the badge. Colors: red = collapse/falling, blue = flooding, amber = fire.
- Self-check before finalizing: delete any marker whose anchor object is not in the Step 1 elements list.
- CLOSED TEXT SET: the generated image may contain ONLY (1) the labels selected above, copied character-for-character; (2) one compact legend on a small opaque rounded panel at bottom-left drawn from "凡例 赤=倒壊・落下注意 / 青=冠水注意 / 橙=火災注意", listing only the colors actually used; (3) marker numerals "1"–"4". The prompt must enumerate these exact strings, require each to be reproduced glyph-for-glyph in a clean bold Japanese gothic (sans-serif) typeface on its badge/pill, and forbid every other character of any script — no deformed kanji-like glyphs, no alphabet, no watermarks, no model names, no captions.
- Include this exact grounding guard in the vizPrompt: "${UNVERIFIED_SAFE_HOUSE_ADDITION_GUARD}"
- Require affirmative anonymization: if any human face is visible, repaint it as an unrecognizable soft blur covering the whole face; if any license plate is visible, repaint the entire plate as a blank surface with no characters.
- Require clean flat-vector digital-infographic quality (sharp, balanced contrast, mobile-readable) — the overlays must NOT look like physical signs or objects inside the scene — and explicitly forbid gore and graphic destruction.

Step 3 – Post-Disaster Simulation Prompts (condition-first protocol)

Step 3a – Structure condition ledger (fill BEFORE writing any simulation prompt):
For up to 6 major structures visible in the photo (prioritize the most safety-relevant: walls, fences, utility poles, building facades, signs, road surface), add one English entry to "structureConditions":
- "object": the Step 1 element string copied verbatim
- "material": e.g. "concrete block", "galvanized steel", "asphalt"
- "conditionTier": exactly one of "new" | "aging" | "deteriorated" (new = clean surfaces, no cracks, straight alignment / aging = some discoloration or minor wear, intact / deteriorated = existing cracks, rust, tilting, crumbling mortar)
- "evidence": the visible cues that justify the tier
- "maxDamage": the strongest damage this structure may EVER receive in any simulation, derived from the tier: new → hairline cracks, thin dust film, barely perceptible lean; aging → a few visible cracks, slight rigid lean, small fallen fragments; deteriorated → partial failure of the already-weak section only, with the rest still standing

Step 3b – CRITICAL REALISM RULE (proportionality, mandatory):
- Damage in every simulation prompt MUST be copied from the ledger; no structure may receive damage stronger than its "maxDamage". If every structure is "new", the whole scene must look nearly intact with only subtle traces — do NOT dramatize to make the image more striking.
- Each simulation prompt MUST name the ledger structures it changes (quote each element string verbatim) and state their exact damage. Generic phrases like "damaged walls" or "debris everywhere" are forbidden.

Step 3c – Write four English prompts (earthquake aftermath, typhoon-class wind aftermath, flash flood, nearby fire), each phrased as an EDIT of the provided photo and beginning with: "Edit the provided photo. Keep the exact camera position, framing, lens, daylight, and the photo's original aspect ratio; keep every structure in its original position" — then describe ONLY the hazard-specific changes. Each prompt must also request a photorealistic result with no people, no added vehicles, faces and license plates repainted unrecognizable (soft blur for faces, blank surface for plates), no added text of any kind, no watermarks, and no model names. Include this exact grounding guard in every simulation prompt: "${UNVERIFIED_SAFE_HOUSE_ADDITION_GUARD}" Hazard physics to instantiate with the ledger structures:
  • Earthquake (JMA seismic intensity 5-upper — strong but not catastrophic): cracks follow structural logic — stair-step along mortar joints or radiating from corners and openings; pavement cracks only along existing seams; tilting objects rotate rigidly at the base and never bend mid-span; fallen fragments lie directly below their origin; a thin dust film only near fresh cracks. Overall: shaken but standing.
  • Typhoon (sustained wind about 30 m/s — strong but survivable): choose ONE wind direction and make every cue agree with it — leaves and small branches accumulate downwind, lightweight objects (bins, cones, potted plants) topple or shift downwind, flexible signs and mesh fences bow downwind but stay standing. Mass rule: only objects a person could lift move visibly; anchored structures at most tilt slightly. Pavement rain-wet with a dull sheen; sky overcast but normal daylight.
  • Flash flood (15–20 cm standing water — ankle to shin): render ONE horizontally consistent waterline across the whole scene, calibrated to real anchors in the photo (a standard curb is about 15 cm, so water just reaches the curb top). Water is silty brown and opaque enough to hide road markings, with small ripples and matte, broken reflections; floating leaves and light debris; a damp high-water stain a few centimeters above the waterline on walls and curbs. Everything above the waterline stays exactly as in the photo.
  • Fire (source strictly OUTSIDE the frame): first decide the off-frame fire direction, then keep every cue consistent with it — translucent smoke haze densest toward that edge and thinning across the scene; faint soot only on surfaces facing that direction; a slight warm tint confined to the haze itself while all surfaces keep their normal daylight color — no orange glow and no rim light, because no flames are visible. Distant objects slightly softened by haze; foreground clear.

Step 3d – Emotional register (mandatory in every simulation prompt, encoded as concrete constraints; never mention children, education, or audiences inside the prompts themselves):
- Keep the original daylight and weather mood except for the minimal change the hazard itself requires; never darken the sky for drama; no horror-like color grading.
- No cinematic effects: no motion blur, dutch angle, vignette, lens flare, or desaturated "disaster movie" tone.
- The street must remain instantly recognizable as the same place in the photo: keep the layout, colors, and every undamaged structure identical.
- Damage must read as discrete, pointable clues (a crack HERE, water up to HERE), not an atmosphere of devastation.
- FORBIDDEN in all four prompts: explosion-like imagery, dramatic dust clouds, completely flattened structures (unless the ledger marks them "deteriorated"), burning vehicles, flames in frame, injured people, and scattered personal belongings that suggest a victim (shoes, school bags).

Language & customisation
- If language = "en", write the risk table and countermeasures in English; otherwise write them in Japanese.
- If custom hazards are provided, replace the default four hazards with the exact supplied list (including as the Step 2 label vocabulary).

Return JSON with this exact structure and this exact key order:
{
  "riskObservation": {
    "elements": ["..."],
    "tableMarkdown": "..."
  },
  "structureConditions": [
    { "object": "...", "material": "...", "conditionTier": "new|aging|deteriorated", "evidence": "...", "maxDamage": "..." }
  ],
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
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: PROMPTS_RESPONSE_SCHEMA,
        },
      }),
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

  // responseSchema 強制時は素のJSONが返るため直接パースし、
  // 万一コードフェンス等が混ざった場合のみ extractFirstJson で救済する(既存の安全網は温存)。
  let parsed: any
  try {
    parsed = JSON.parse(textPart)
  } catch {
    parsed = extractFirstJson(textPart)
  }

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
