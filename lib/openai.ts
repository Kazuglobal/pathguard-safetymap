import OpenAI from "openai"

// OpenAI クライアントを初期化して再利用できるようにエクスポートします。
// 環境変数に OPENAI_API_KEY と（必要なら）OPENAI_ORG_ID を設定してください。
// 例: .env.local
//      OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
//      OPENAI_ORG_ID=org_xxxxxxxxxxxxx

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
})

export interface HazardAnalysisResult {
  hazards: {
    type: string
    description: string
    severity: number // 1-5 scale
    location: string
    confidence: number // 0-1 scale
  }[]
  overallSafety: number // 1-5 scale (1=very dangerous, 5=very safe)
  educationalTips: string[]
  score: number // 0-100 points based on accuracy of detected hazards
}

export async function analyzeImageForHazards(
  imageBase64: string,
  userDetectedHazards?: string[]
): Promise<HazardAnalysisResult> {
  try {
    const prompt = `
あなたは安全専門家です。この写真を分析して、潜在的な危険や安全上の問題を特定してください。

以下の項目を含む詳細な分析を日本語で提供してください：

1. 特定された危険要素（種類、説明、深刻度1-5、場所、確信度0-1）
2. 全体的な安全レベル（1-5、1=非常に危険、5=非常に安全）
3. 安全に関する教育的なアドバイス

危険の種類例：
- 交通関連（車、バイク、自転車の動線）
- 歩行者の安全（段差、障害物、滑りやすい場所）
- 構造物の問題（壊れた設備、不安定な物）
- 照明・視界の問題
- 子供の安全に関する問題
- その他の安全上の懸念

JSON形式で回答してください。
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("No response from OpenAI")
    }

    // Parse JSON response
    const analysisResult = JSON.parse(content) as {
      hazards: Array<{
        type: string
        description: string
        severity: number
        location: string
        confidence: number
      }>
      overallSafety: number
      educationalTips: string[]
    }

    // Calculate score based on analysis quality and user interaction
    const score = calculateGameScore(analysisResult.hazards, userDetectedHazards)

    return {
      ...analysisResult,
      score,
    }
  } catch (error) {
    console.error("Error analyzing image:", error)
    throw new Error("画像の分析に失敗しました。もう一度お試しください。")
  }
}

function calculateGameScore(
  detectedHazards: HazardAnalysisResult["hazards"],
  userDetectedHazards?: string[]
): number {
  let baseScore = Math.min(detectedHazards.length * 15, 80) // Base score for detected hazards
  
  // Bonus for high-confidence detections
  const highConfidenceHazards = detectedHazards.filter(h => h.confidence > 0.8)
  baseScore += highConfidenceHazards.length * 5

  // Bonus for severe hazards detected
  const severeHazards = detectedHazards.filter(h => h.severity >= 4)
  baseScore += severeHazards.length * 10

  return Math.min(baseScore, 100)
} 