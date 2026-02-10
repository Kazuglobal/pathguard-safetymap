/**
 * AIインフラ安全評価システム
 *
 * セーフシステムアプローチに基づき、通学路のインフラを
 * 包括的に評価。WHO推奨の30km/h制限や、歩車分離、
 * バリアフリーなど多角的な基準で分析。
 */

import { getSanitizedGeminiApiKey, getSanitizedGeminiVisionModel } from "../gemini-util"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"

export interface InfrastructureAssessment {
  overallGrade: "A" | "B" | "C" | "D" | "F"
  overallScore: number

  categories: {
    pedestrianFacilities: InfraCategory
    crossingFacilities: InfraCategory
    speedManagement: InfraCategory
    visibility: InfraCategory
    bufferZones: InfraCategory
    accessibility: InfraCategory
  }

  missingInfrastructure: MissingInfra[]
  existingInfrastructure: ExistingInfra[]

  safeSystemCompliance: {
    speed30Zone: boolean
    separatedWalkway: boolean
    protectedCrossings: boolean
    trafficCalming: boolean
    adequateLighting: boolean
    complianceScore: number
  }

  priorityImprovements: PriorityImprovement[]
  estimatedRiskReduction: string
}

export interface InfraCategory {
  name: string
  score: number // 0-100
  status: "excellent" | "good" | "fair" | "poor" | "critical"
  details: string[]
}

export interface MissingInfra {
  type: string
  importance: "critical" | "high" | "medium" | "low"
  description: string
  expectedBenefit: string
}

export interface ExistingInfra {
  type: string
  condition: "good" | "fair" | "poor"
  description: string
}

export interface PriorityImprovement {
  rank: number
  title: string
  description: string
  urgency: "immediate" | "short_term" | "long_term"
  expectedImpact: "high" | "medium" | "low"
  estimatedCost: "high" | "medium" | "low"
}

function extractJsonFromResponse(text: string): any {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fence ? fence[1] : text
  const start = candidate.indexOf("{")
  const end = candidate.lastIndexOf("}")
  if (start >= 0 && end > start) {
    try { return JSON.parse(candidate.slice(start, end + 1)) } catch {}
  }
  try { return JSON.parse(candidate) } catch {}
  throw new Error("AIレスポンスのJSON解析に失敗しました")
}

/**
 * 画像からインフラ安全評価を実行
 */
export async function analyzeInfrastructureFromImage(
  imageBase64OrDataUrl: string
): Promise<InfrastructureAssessment> {
  const apiKey = getSanitizedGeminiApiKey()
  const model = getSanitizedGeminiVisionModel("gemini-2.5-flash")

  let mimeType = "image/jpeg"
  let dataBase64 = imageBase64OrDataUrl
  if (imageBase64OrDataUrl.startsWith("data:")) {
    const match = imageBase64OrDataUrl.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      mimeType = match[1]
      dataBase64 = match[2]
    }
  }

  const prompt = `あなたは通学路インフラ安全の専門家AIです。この画像を分析し、セーフシステムアプローチに基づいたインフラ評価を行ってください。

【評価基準】
WHO（世界保健機関）とUNICEFが推奨する「子どもの安全な移動」基準:
- 学校周辺の速度制限30km/h
- 歩道と車道の物理的分離
- 保護された横断施設
- トラフィックカーミング（速度抑制装置）
- 適切な照明
- 緩衝帯（街路樹、ボラードなど）

【分析項目】
1. 歩行者施設: 歩道の有無・幅・状態、バリアフリー
2. 横断施設: 横断歩道、信号機、歩行者用押しボタン
3. 速度管理: スピードバンプ、狭さく、ゾーン30表示
4. 視認性: 見通し、照明、ミラー、死角
5. 緩衝帯: 街路樹、植栽帯、ボラード、ガードレール
6. アクセシビリティ: 段差解消、点字ブロック、幅員

以下のJSON形式で出力。

{
  "overallGrade": "A-F",
  "overallScore": 0-100,
  "categories": {
    "pedestrianFacilities": { "name": "歩行者施設", "score": 0-100, "status": "excellent/good/fair/poor/critical", "details": ["詳細1"] },
    "crossingFacilities": { "name": "横断施設", "score": 0-100, "status": "...", "details": ["詳細1"] },
    "speedManagement": { "name": "速度管理", "score": 0-100, "status": "...", "details": ["詳細1"] },
    "visibility": { "name": "視認性", "score": 0-100, "status": "...", "details": ["詳細1"] },
    "bufferZones": { "name": "緩衝帯", "score": 0-100, "status": "...", "details": ["詳細1"] },
    "accessibility": { "name": "アクセシビリティ", "score": 0-100, "status": "...", "details": ["詳細1"] }
  },
  "missingInfrastructure": [
    { "type": "インフラの種類", "importance": "critical/high/medium/low", "description": "説明", "expectedBenefit": "導入効果" }
  ],
  "existingInfrastructure": [
    { "type": "インフラの種類", "condition": "good/fair/poor", "description": "説明" }
  ],
  "safeSystemCompliance": {
    "speed30Zone": true/false,
    "separatedWalkway": true/false,
    "protectedCrossings": true/false,
    "trafficCalming": true/false,
    "adequateLighting": true/false,
    "complianceScore": 0-100
  },
  "priorityImprovements": [
    {
      "rank": 1,
      "title": "改善項目",
      "description": "詳細",
      "urgency": "immediate/short_term/long_term",
      "expectedImpact": "high/medium/low",
      "estimatedCost": "high/medium/low"
    }
  ],
  "estimatedRiskReduction": "推定リスク低減効果の説明"
}

必ずJSONのみを出力。`

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
    throw new Error(`Gemini API error: ${res.status} - ${text}`)
  }

  const data = await res.json()
  const textPart = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
  if (!textPart) throw new Error("Gemini response did not contain text")

  const parsed = extractJsonFromResponse(textPart)
  return normalizeAssessment(parsed)
}

function normalizeAssessment(raw: any): InfrastructureAssessment {
  const validGrades = ["A", "B", "C", "D", "F"] as const
  const toGrade = (v: unknown) =>
    validGrades.includes(v as any) ? (v as typeof validGrades[number]) : "C"
  const clamp = (v: unknown, min: number, max: number, fb: number) => {
    const n = Number(v)
    return isNaN(n) ? fb : Math.max(min, Math.min(max, n))
  }
  const toStrArr = (v: unknown) => Array.isArray(v) ? v.map(String) : []

  const parseCategory = (cat: any, defaultName: string): InfraCategory => ({
    name: String(cat?.name ?? defaultName),
    score: clamp(cat?.score, 0, 100, 50),
    status: ["excellent", "good", "fair", "poor", "critical"].includes(cat?.status)
      ? cat.status : "fair",
    details: toStrArr(cat?.details),
  })

  const cats = raw?.categories ?? {}

  return {
    overallGrade: toGrade(raw?.overallGrade),
    overallScore: clamp(raw?.overallScore, 0, 100, 50),
    categories: {
      pedestrianFacilities: parseCategory(cats.pedestrianFacilities, "歩行者施設"),
      crossingFacilities: parseCategory(cats.crossingFacilities, "横断施設"),
      speedManagement: parseCategory(cats.speedManagement, "速度管理"),
      visibility: parseCategory(cats.visibility, "視認性"),
      bufferZones: parseCategory(cats.bufferZones, "緩衝帯"),
      accessibility: parseCategory(cats.accessibility, "アクセシビリティ"),
    },
    missingInfrastructure: Array.isArray(raw?.missingInfrastructure)
      ? raw.missingInfrastructure.map((m: any) => ({
          type: String(m?.type ?? ""),
          importance: ["critical", "high", "medium", "low"].includes(m?.importance) ? m.importance : "medium",
          description: String(m?.description ?? ""),
          expectedBenefit: String(m?.expectedBenefit ?? ""),
        }))
      : [],
    existingInfrastructure: Array.isArray(raw?.existingInfrastructure)
      ? raw.existingInfrastructure.map((e: any) => ({
          type: String(e?.type ?? ""),
          condition: ["good", "fair", "poor"].includes(e?.condition) ? e.condition : "fair",
          description: String(e?.description ?? ""),
        }))
      : [],
    safeSystemCompliance: {
      speed30Zone: !!raw?.safeSystemCompliance?.speed30Zone,
      separatedWalkway: !!raw?.safeSystemCompliance?.separatedWalkway,
      protectedCrossings: !!raw?.safeSystemCompliance?.protectedCrossings,
      trafficCalming: !!raw?.safeSystemCompliance?.trafficCalming,
      adequateLighting: !!raw?.safeSystemCompliance?.adequateLighting,
      complianceScore: clamp(raw?.safeSystemCompliance?.complianceScore, 0, 100, 30),
    },
    priorityImprovements: Array.isArray(raw?.priorityImprovements)
      ? raw.priorityImprovements.map((p: any, i: number) => ({
          rank: Number(p?.rank ?? i + 1),
          title: String(p?.title ?? ""),
          description: String(p?.description ?? ""),
          urgency: ["immediate", "short_term", "long_term"].includes(p?.urgency) ? p.urgency : "short_term",
          expectedImpact: ["high", "medium", "low"].includes(p?.expectedImpact) ? p.expectedImpact : "medium",
          estimatedCost: ["high", "medium", "low"].includes(p?.estimatedCost) ? p.estimatedCost : "medium",
        }))
      : [],
    estimatedRiskReduction: String(raw?.estimatedRiskReduction ?? ""),
  }
}
