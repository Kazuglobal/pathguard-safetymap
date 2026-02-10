/**
 * AI保護者向け安全レポート生成
 *
 * 保護者が最も懸念する以下の点について、データに基づいた
 * 安心レポートを生成:
 * - 交通事故リスク
 * - 不審者・防犯リスク
 * - 環境・気候リスク
 * - インフラ品質
 * - 推奨されるアクション
 */

import { getSanitizedGeminiApiKey, getSanitizedGeminiModel } from "../gemini-util"

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta"

export interface ParentSafetyReport {
  routeName: string
  generatedAt: string
  overallGrade: "A" | "B" | "C" | "D" | "F"
  overallMessage: string

  trafficSafety: {
    grade: "A" | "B" | "C" | "D" | "F"
    score: number
    keyFindings: string[]
    parentAdvice: string[]
    speedEnvironment: string
  }

  securityAssessment: {
    grade: "A" | "B" | "C" | "D" | "F"
    score: number
    lightingStatus: string
    pedestrianTraffic: string
    blindSpots: string[]
    safeHavens: string[]
    parentAdvice: string[]
  }

  environmentalHealth: {
    airQualityRisk: "high" | "medium" | "low"
    noiseLevel: "high" | "medium" | "low"
    heatRisk: "high" | "medium" | "low"
    floodRisk: "high" | "medium" | "low"
    healthTips: string[]
  }

  infrastructureQuality: {
    sidewalkCondition: "good" | "fair" | "poor" | "none"
    crosswalkAvailability: "adequate" | "partial" | "insufficient"
    guardrailPresence: boolean
    schoolZoneDesignation: boolean
    improvementNeeds: string[]
  }

  recommendedActions: {
    forParents: string[]
    forSchool: string[]
    forCommunity: string[]
    forAuthority: string[]
  }

  companionWalkingGuide: {
    suggestedCheckpoints: string[]
    dangerousSpots: string[]
    meetingPoints: string[]
    emergencyContacts: string
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

export interface ParentReportContext {
  routeName: string
  startAddress: string
  endAddress: string
  distanceMeters?: number
  estimatedTimeMinutes?: number
  childAge?: number
  childGrade?: string
  dangerReports?: Array<{
    type: string
    level: number
    description?: string
  }>
  safetyScore?: number
}

export async function generateParentSafetyReport(
  context: ParentReportContext
): Promise<ParentSafetyReport> {
  const apiKey = getSanitizedGeminiApiKey()
  const model = getSanitizedGeminiModel("gemini-2.5-flash")

  const dangerInfo = context.dangerReports?.length
    ? context.dangerReports.map((r, i) =>
        `${i + 1}. ${r.type}（レベル${r.level}/5）: ${r.description || "詳細なし"}`
      ).join("\n")
    : "現在報告されている危険箇所はありません"

  const prompt = `あなたは通学路安全の専門家です。以下のルート情報に基づき、保護者向けの安全レポートを生成してください。

【ルート情報】
- ルート名: ${context.routeName}
- 出発地: ${context.startAddress}
- 目的地: ${context.endAddress}
- 距離: ${context.distanceMeters ? `${(context.distanceMeters / 1000).toFixed(1)}km` : "不明"}
- 所要時間: ${context.estimatedTimeMinutes ? `約${context.estimatedTimeMinutes}分` : "不明"}
- お子様: ${context.childGrade || "小学生"}${context.childAge ? `（${context.childAge}歳）` : ""}
- 既存の安全スコア: ${context.safetyScore ?? "未評価"}

【地域の危険報告】
${dangerInfo}

【分析の背景知識】
世界の研究では以下が示されています：
- 交通事故は5-19歳の主要死因
- 学校周辺30km/h制限で歩行者死亡リスクが大幅低減
- 保護者の主な懸念は交通事故と不審者
- 大気汚染は子どもの呼吸器疾患リスクを増加
- 歩道と車道の間の緩衝帯が安全感を向上

保護者が理解しやすく、具体的なアクションに繋がるレポートを生成してください。

以下のJSON形式で出力してください。

{
  "routeName": "ルート名",
  "generatedAt": "ISO日時",
  "overallGrade": "A-F",
  "overallMessage": "保護者への総合メッセージ（安心感と注意点のバランス、3-4文）",
  "trafficSafety": {
    "grade": "A-F",
    "score": 0-100,
    "keyFindings": ["発見1", "発見2"],
    "parentAdvice": ["アドバイス1"],
    "speedEnvironment": "速度環境の説明"
  },
  "securityAssessment": {
    "grade": "A-F",
    "score": 0-100,
    "lightingStatus": "照明状況",
    "pedestrianTraffic": "人通りの状況",
    "blindSpots": ["死角1"],
    "safeHavens": ["緊急時に逃げ込める場所"],
    "parentAdvice": ["アドバイス1"]
  },
  "environmentalHealth": {
    "airQualityRisk": "high/medium/low",
    "noiseLevel": "high/medium/low",
    "heatRisk": "high/medium/low",
    "floodRisk": "high/medium/low",
    "healthTips": ["健康アドバイス1"]
  },
  "infrastructureQuality": {
    "sidewalkCondition": "good/fair/poor/none",
    "crosswalkAvailability": "adequate/partial/insufficient",
    "guardrailPresence": true/false,
    "schoolZoneDesignation": true/false,
    "improvementNeeds": ["改善点1"]
  },
  "recommendedActions": {
    "forParents": ["保護者ができること1"],
    "forSchool": ["学校への提案1"],
    "forCommunity": ["地域への提案1"],
    "forAuthority": ["行政への要望1"]
  },
  "companionWalkingGuide": {
    "suggestedCheckpoints": ["チェックポイント1"],
    "dangerousSpots": ["注意箇所1"],
    "meetingPoints": ["集合場所候補1"],
    "emergencyContacts": "緊急連絡先の案内"
  }
}

必ずJSONのみを出力。`

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

  const parsed = extractJsonFromResponse(textPart)
  return normalizeReport(parsed, context)
}

function normalizeReport(raw: any, context: ParentReportContext): ParentSafetyReport {
  const validGrades = ["A", "B", "C", "D", "F"] as const
  const toGrade = (v: unknown) =>
    validGrades.includes(v as any) ? (v as typeof validGrades[number]) : "C"
  const clamp = (v: unknown, min: number, max: number, fb: number) => {
    const n = Number(v)
    return isNaN(n) ? fb : Math.max(min, Math.min(max, n))
  }
  const toStrArr = (v: unknown) => Array.isArray(v) ? v.map(String) : []

  return {
    routeName: String(raw?.routeName ?? context.routeName),
    generatedAt: raw?.generatedAt ?? new Date().toISOString(),
    overallGrade: toGrade(raw?.overallGrade),
    overallMessage: String(raw?.overallMessage ?? ""),
    trafficSafety: {
      grade: toGrade(raw?.trafficSafety?.grade),
      score: clamp(raw?.trafficSafety?.score, 0, 100, 50),
      keyFindings: toStrArr(raw?.trafficSafety?.keyFindings),
      parentAdvice: toStrArr(raw?.trafficSafety?.parentAdvice),
      speedEnvironment: String(raw?.trafficSafety?.speedEnvironment ?? ""),
    },
    securityAssessment: {
      grade: toGrade(raw?.securityAssessment?.grade),
      score: clamp(raw?.securityAssessment?.score, 0, 100, 50),
      lightingStatus: String(raw?.securityAssessment?.lightingStatus ?? ""),
      pedestrianTraffic: String(raw?.securityAssessment?.pedestrianTraffic ?? ""),
      blindSpots: toStrArr(raw?.securityAssessment?.blindSpots),
      safeHavens: toStrArr(raw?.securityAssessment?.safeHavens),
      parentAdvice: toStrArr(raw?.securityAssessment?.parentAdvice),
    },
    environmentalHealth: {
      airQualityRisk: ["high", "medium", "low"].includes(raw?.environmentalHealth?.airQualityRisk)
        ? raw.environmentalHealth.airQualityRisk : "medium",
      noiseLevel: ["high", "medium", "low"].includes(raw?.environmentalHealth?.noiseLevel)
        ? raw.environmentalHealth.noiseLevel : "medium",
      heatRisk: ["high", "medium", "low"].includes(raw?.environmentalHealth?.heatRisk)
        ? raw.environmentalHealth.heatRisk : "medium",
      floodRisk: ["high", "medium", "low"].includes(raw?.environmentalHealth?.floodRisk)
        ? raw.environmentalHealth.floodRisk : "low",
      healthTips: toStrArr(raw?.environmentalHealth?.healthTips),
    },
    infrastructureQuality: {
      sidewalkCondition: ["good", "fair", "poor", "none"].includes(raw?.infrastructureQuality?.sidewalkCondition)
        ? raw.infrastructureQuality.sidewalkCondition : "fair",
      crosswalkAvailability: ["adequate", "partial", "insufficient"].includes(raw?.infrastructureQuality?.crosswalkAvailability)
        ? raw.infrastructureQuality.crosswalkAvailability : "partial",
      guardrailPresence: !!raw?.infrastructureQuality?.guardrailPresence,
      schoolZoneDesignation: !!raw?.infrastructureQuality?.schoolZoneDesignation,
      improvementNeeds: toStrArr(raw?.infrastructureQuality?.improvementNeeds),
    },
    recommendedActions: {
      forParents: toStrArr(raw?.recommendedActions?.forParents),
      forSchool: toStrArr(raw?.recommendedActions?.forSchool),
      forCommunity: toStrArr(raw?.recommendedActions?.forCommunity),
      forAuthority: toStrArr(raw?.recommendedActions?.forAuthority),
    },
    companionWalkingGuide: {
      suggestedCheckpoints: toStrArr(raw?.companionWalkingGuide?.suggestedCheckpoints),
      dangerousSpots: toStrArr(raw?.companionWalkingGuide?.dangerousSpots),
      meetingPoints: toStrArr(raw?.companionWalkingGuide?.meetingPoints),
      emergencyContacts: String(raw?.companionWalkingGuide?.emergencyContacts ?? "110（警察）、119（消防・救急）"),
    },
  }
}
