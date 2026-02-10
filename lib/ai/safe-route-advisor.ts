/**
 * AI通学路安全アドバイザー
 *
 * 研究データに基づき、以下の観点からルートを包括的に分析:
 * - 交通安全（速度制限、インフラ、歩車分離）
 * - 大気汚染・健康影響（排気ガス、粒子状物質）
 * - 気候変動リスク（熱波、洪水、暴風雨）
 * - 防犯（不審者、暗い道、人通り）
 * - インフラ品質（歩道、横断歩道、ガードレール）
 */

import { getSanitizedGeminiApiKey, getSanitizedGeminiModel } from "../gemini-util"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"

// セーフシステムアプローチの5つの柱
export interface SafeSystemPillar {
  name: string
  nameEn: string
  score: number // 0-100 (高いほど安全)
  findings: string[]
  recommendations: string[]
  urgency: "critical" | "high" | "medium" | "low"
}

export interface EnvironmentalRisk {
  type: "air_pollution" | "heat" | "flood" | "storm" | "noise"
  level: "high" | "medium" | "low"
  description: string
  mitigation: string
  healthImpact: string
}

export interface ChildPerspectiveAnalysis {
  walkability: number // 0-100
  perceivedSafety: number // 0-100
  parentConfidence: number // 0-100
  keyBarriers: string[]
  encouragingFactors: string[]
}

export interface SafeRouteAnalysis {
  overallSafetyGrade: "A" | "B" | "C" | "D" | "F"
  overallScore: number
  safeSystemPillars: SafeSystemPillar[]
  environmentalRisks: EnvironmentalRisk[]
  childPerspective: ChildPerspectiveAnalysis
  speed30Zone: {
    recommended: boolean
    reason: string
    currentEstimatedSpeed: number
  }
  activeSchoolTravelScore: number // 徒歩・自転車通学の適性 0-100
  summary: string
  actionPlan: {
    immediate: string[]   // すぐにできること
    shortTerm: string[]   // 1-3ヶ月
    longTerm: string[]    // 半年以上
  }
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

async function callGeminiText(prompt: string): Promise<string> {
  const apiKey = getSanitizedGeminiApiKey()
  const model = getSanitizedGeminiModel("gemini-2.5-flash")

  const res = await fetch(
    `${GEMINI_API_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gemini API error: ${res.status} - ${text}`)
  }

  const data = await res.json()
  const textPart = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
  if (!textPart) throw new Error("Gemini response did not contain text")
  return textPart
}

export interface RouteContext {
  startAddress: string
  endAddress: string
  distanceMeters?: number
  estimatedTimeMinutes?: number
  routeGeometry?: any
  dangerReports?: Array<{
    type: string
    level: number
    description?: string
    latitude: number
    longitude: number
  }>
  timeOfDay?: "morning" | "afternoon" | "evening"
  weatherCondition?: string
}

export async function analyzeRouteSafety(context: RouteContext): Promise<SafeRouteAnalysis> {
  const dangerSummary = context.dangerReports?.length
    ? context.dangerReports.map((r, i) =>
        `${i + 1}. タイプ:${r.type}, レベル:${r.level}/5, ${r.description || ""}`
      ).join("\n")
    : "報告なし"

  const prompt = `あなたは通学路安全の専門家AIです。以下のルート情報を分析し、セーフシステムアプローチに基づいた包括的な安全評価を行ってください。

【ルート情報】
- 出発地: ${context.startAddress}
- 目的地: ${context.endAddress}
- 距離: ${context.distanceMeters ? `${(context.distanceMeters / 1000).toFixed(1)}km` : "不明"}
- 所要時間: ${context.estimatedTimeMinutes ? `${context.estimatedTimeMinutes}分` : "不明"}
- 時間帯: ${context.timeOfDay === "morning" ? "朝（登校時）" : context.timeOfDay === "afternoon" ? "午後（下校時）" : context.timeOfDay === "evening" ? "夕方" : "不明"}
- 天候: ${context.weatherCondition || "晴天"}

【既存の危険報告】
${dangerSummary}

【分析要件】
世界の通学路安全に関する最新の研究知見を踏まえ、以下の観点から分析してください：

1. **セーフシステムアプローチの5つの柱**
   - 安全な速度 (Safer Speeds): 学校周辺30km/h制限の必要性
   - 安全な道路 (Safer Roads): 歩道、横断歩道、ガードレール、緩衝帯
   - 安全な車両 (Safer Vehicles): 大型車両の通行、スクールバス
   - 安全な利用者 (Safer Road Users): 子どもの行動特性への配慮
   - 事故後の対応 (Post-crash Response): 救急アクセス

2. **環境・健康リスク**
   - 大気汚染（排気ガス、PM2.5）による呼吸器への影響
   - 騒音ストレス
   - 熱波リスク（熱中症）
   - 洪水・冠水リスク
   - 暴風雨リスク

3. **子どもの視点分析**
   - 歩きやすさ（段差、幅員、見通し）
   - 体感安全性（不審者リスク、暗い場所、人通り）
   - 保護者の安心度

以下のJSON形式で出力してください。説明文や前置きは不要。

{
  "overallSafetyGrade": "A〜Fの評価",
  "overallScore": 0-100の数値,
  "safeSystemPillars": [
    {
      "name": "柱の名前（日本語）",
      "nameEn": "英語名",
      "score": 0-100,
      "findings": ["発見事項1", "発見事項2"],
      "recommendations": ["推奨事項1"],
      "urgency": "critical/high/medium/low"
    }
  ],
  "environmentalRisks": [
    {
      "type": "air_pollution/heat/flood/storm/noise",
      "level": "high/medium/low",
      "description": "リスクの説明",
      "mitigation": "対策",
      "healthImpact": "健康への影響"
    }
  ],
  "childPerspective": {
    "walkability": 0-100,
    "perceivedSafety": 0-100,
    "parentConfidence": 0-100,
    "keyBarriers": ["障壁1"],
    "encouragingFactors": ["良い点1"]
  },
  "speed30Zone": {
    "recommended": true/false,
    "reason": "理由",
    "currentEstimatedSpeed": 推定速度(km/h)
  },
  "activeSchoolTravelScore": 0-100,
  "summary": "総合評価サマリー（3-4文）",
  "actionPlan": {
    "immediate": ["すぐにできる対策"],
    "shortTerm": ["1-3ヶ月の対策"],
    "longTerm": ["半年以上の対策"]
  }
}

必ずJSONのみを出力。`

  const response = await callGeminiText(prompt)
  const parsed = extractJsonFromResponse(response)

  return validateAndNormalize(parsed)
}

function validateAndNormalize(raw: any): SafeRouteAnalysis {
  const clamp = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Number(v)
    return isNaN(n) ? fallback : Math.max(min, Math.min(max, n))
  }

  const validGrades = ["A", "B", "C", "D", "F"] as const
  const grade = validGrades.includes(raw?.overallSafetyGrade)
    ? raw.overallSafetyGrade
    : "C"

  return {
    overallSafetyGrade: grade,
    overallScore: clamp(raw?.overallScore, 0, 100, 50),
    safeSystemPillars: Array.isArray(raw?.safeSystemPillars)
      ? raw.safeSystemPillars.map((p: any) => ({
          name: String(p?.name ?? ""),
          nameEn: String(p?.nameEn ?? ""),
          score: clamp(p?.score, 0, 100, 50),
          findings: Array.isArray(p?.findings) ? p.findings.map(String) : [],
          recommendations: Array.isArray(p?.recommendations) ? p.recommendations.map(String) : [],
          urgency: ["critical", "high", "medium", "low"].includes(p?.urgency) ? p.urgency : "medium",
        }))
      : [],
    environmentalRisks: Array.isArray(raw?.environmentalRisks)
      ? raw.environmentalRisks.map((r: any) => ({
          type: ["air_pollution", "heat", "flood", "storm", "noise"].includes(r?.type) ? r.type : "air_pollution",
          level: ["high", "medium", "low"].includes(r?.level) ? r.level : "medium",
          description: String(r?.description ?? ""),
          mitigation: String(r?.mitigation ?? ""),
          healthImpact: String(r?.healthImpact ?? ""),
        }))
      : [],
    childPerspective: {
      walkability: clamp(raw?.childPerspective?.walkability, 0, 100, 50),
      perceivedSafety: clamp(raw?.childPerspective?.perceivedSafety, 0, 100, 50),
      parentConfidence: clamp(raw?.childPerspective?.parentConfidence, 0, 100, 50),
      keyBarriers: Array.isArray(raw?.childPerspective?.keyBarriers)
        ? raw.childPerspective.keyBarriers.map(String)
        : [],
      encouragingFactors: Array.isArray(raw?.childPerspective?.encouragingFactors)
        ? raw.childPerspective.encouragingFactors.map(String)
        : [],
    },
    speed30Zone: {
      recommended: raw?.speed30Zone?.recommended ?? true,
      reason: String(raw?.speed30Zone?.reason ?? ""),
      currentEstimatedSpeed: clamp(raw?.speed30Zone?.currentEstimatedSpeed, 0, 200, 40),
    },
    activeSchoolTravelScore: clamp(raw?.activeSchoolTravelScore, 0, 100, 50),
    summary: String(raw?.summary ?? ""),
    actionPlan: {
      immediate: Array.isArray(raw?.actionPlan?.immediate)
        ? raw.actionPlan.immediate.map(String) : [],
      shortTerm: Array.isArray(raw?.actionPlan?.shortTerm)
        ? raw.actionPlan.shortTerm.map(String) : [],
      longTerm: Array.isArray(raw?.actionPlan?.longTerm)
        ? raw.actionPlan.longTerm.map(String) : [],
    },
  }
}
