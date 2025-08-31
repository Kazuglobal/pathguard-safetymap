type Hazard = {
  type: string
  description: string
  severity: number
  location: string
  confidence: number
}

export type HazardAnalysisResult = {
  hazards: Hazard[]
  overallSafety: number
  educationalTips: string[]
  score: number
}

import { getSanitizedGeminiApiKey, getSanitizedGeminiModel } from "./gemini-util"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"

function extractFirstJson(text: string): any {
  // Try code fences first
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fence ? fence[1] : text
  // Heuristic: find first { ... } block
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start >= 0 && end > start) {
    const jsonSlice = candidate.slice(start, end + 1)
    try { return JSON.parse(jsonSlice) } catch {}
  }
  // Fallback: try parsing the whole string
  try { return JSON.parse(candidate) } catch {}
  throw new Error("Failed to parse JSON from Gemini response")
}

export async function analyzeImageForHazardsGemini(
  imageBase64OrDataUrl: string,
  userDetectedHazards?: string[]
): Promise<HazardAnalysisResult> {
  if (!imageBase64OrDataUrl || imageBase64OrDataUrl.length < 50) {
    throw new Error("画像データが不足しています")
  }

  const apiKey = getSanitizedGeminiApiKey()
  const model = getSanitizedGeminiModel("gemini-2.5-flash")

  // Accept both raw base64 and data URL
  let mimeType = "image/jpeg"
  let dataBase64 = imageBase64OrDataUrl
  if (imageBase64OrDataUrl.startsWith("data:")) {
    const match = imageBase64OrDataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) {
      throw new Error("画像のdata URLが不正です")
    }
    mimeType = match[1]
    dataBase64 = match[2]
  }

  const prompt = `以下の日本の街路・歩道の写真を分析し、JSONだけを出力してください。説明文や前置きは不要。フィールドは厳密に一致させてください。
{
  "hazards": [
    { "type": "string", "description": "string", "severity": 1, "location": "string", "confidence": 0.0 }
  ],
  "overallSafety": 1,
  "educationalTips": ["string"],
  "score": 0
}

要件:
- 想定ハザード: 地震・台風(強風)・豪雨(冠水)・火災。
- 各ハザードの視覚的な兆候や危険箇所を抽出し、2〜3件ずつ含めてOK。
- severity: 1(危険)〜5(安全)。confidence: 0〜1。
- overallSafety: 1(非常に危険)〜5(非常に安全)。
- educationalTips: 現場で実行可能な具体的対策を日本語で簡潔に。
- score: 0〜100。
${userDetectedHazards?.length ? `ユーザー指摘: ${userDetectedHazards.join(', ')}` : ''}
必ずJSONのみを出力。`;

  const parts: any[] = [
    { inline_data: { mime_type: mimeType, data: dataBase64 } },
    { text: prompt },
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
    throw new Error(`Gemini request failed: ${res.status} ${res.statusText} - ${text}`)
  }

  const data = await res.json()
  const textPart = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
  if (!textPart || typeof textPart !== "string") {
    throw new Error("Gemini response did not contain text output")
  }

  const parsed = extractFirstJson(textPart)

  // Minimal validation/coercion
  const hazards: Hazard[] = Array.isArray(parsed?.hazards) ? parsed.hazards.map((h: any) => ({
    type: String(h?.type ?? "unknown"),
    description: String(h?.description ?? ""),
    severity: Math.max(1, Math.min(5, Number(h?.severity ?? 3))),
    location: String(h?.location ?? ""),
    confidence: Math.max(0, Math.min(1, Number(h?.confidence ?? 0.5))),
  })) : []

  const overallSafety = Math.max(1, Math.min(5, Number(parsed?.overallSafety ?? 3)))
  const educationalTips = Array.isArray(parsed?.educationalTips) ? parsed.educationalTips.map((t: any) => String(t)) : []
  const score = Math.max(0, Math.min(100, Number(parsed?.score ?? 0)))

  return { hazards, overallSafety, educationalTips, score }
}
