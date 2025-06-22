import OpenAI from "openai"

// OpenAI クライアントを初期化して再利用できるようにエクスポートします。
// 環境変数に OPENAI_API_KEY と（必要なら）OPENAI_ORG_ID を設定してください。
// 例: .env.local
//      OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
//      OPENAI_ORG_ID=org_xxxxxxxxxxxxx

// OpenAI API key validation
const validateOpenAIConfig = () => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  if (!apiKey.startsWith('sk-')) {
    throw new Error('Invalid OpenAI API key format')
  }
  return apiKey
}

// Simple circuit breaker for OpenAI API
class OpenAICircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private readonly failureThreshold = 5
  private readonly recoveryTimeMs = 60000 // 1 minute

  isOpen(): boolean {
    if (this.failureCount >= this.failureThreshold) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime
      if (timeSinceLastFailure < this.recoveryTimeMs) {
        return true
      } else {
        // Reset circuit breaker after recovery time
        this.failureCount = 0
        return false
      }
    }
    return false
  }

  recordSuccess(): void {
    this.failureCount = 0
  }

  recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
  }
}

const circuitBreaker = new OpenAICircuitBreaker()

// Initialize OpenAI client with validation
const initializeOpenAI = () => {
  try {
    const apiKey = validateOpenAIConfig()
    return new OpenAI({
      apiKey,
      organization: process.env.OPENAI_ORG_ID,
      timeout: 30000, // 30 second timeout
      maxRetries: 2, // Retry failed requests up to 2 times
    })
  } catch (error) {
    console.error('OpenAI initialization failed:', error)
    throw error
  }
}

export const openai = initializeOpenAI()

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

// Image validation constants
const MAX_IMAGE_SIZE = 20 * 1024 * 1024 // 20MB
const MIN_IMAGE_SIZE = 1024 // 1KB
const SUPPORTED_FORMATS = ['jpeg', 'jpg', 'png', 'gif', 'webp']

// Image validation function
const validateImageData = (imageBase64: string): void => {
  if (!imageBase64) {
    throw new Error('画像データが提供されていません')
  }

  // Check if it's valid base64
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
  if (!base64Regex.test(imageBase64)) {
    throw new Error('無効なbase64形式の画像データです')
  }

  // Check image size
  const sizeInBytes = (imageBase64.length * 3) / 4
  if (sizeInBytes > MAX_IMAGE_SIZE) {
    throw new Error(`画像サイズが大きすぎます。最大${MAX_IMAGE_SIZE / 1024 / 1024}MBまでです`)
  }
  if (sizeInBytes < MIN_IMAGE_SIZE) {
    throw new Error('画像サイズが小さすぎます')
  }

  // Try to detect image format from base64 header
  try {
    const header = imageBase64.substring(0, 50)
    const buffer = Buffer.from(header, 'base64')
    const uint8Array = new Uint8Array(buffer)
    
    // Check for common image file signatures
    const isJPEG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8
    const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47
    const isGIF = (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46)
    const isWebP = (uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50)
    
    if (!isJPEG && !isPNG && !isGIF && !isWebP) {
      throw new Error('サポートされていない画像形式です。JPEG、PNG、GIF、WebPのいずれかをご使用ください')
    }
  } catch (formatError) {
    console.warn('Image format validation failed:', formatError)
    // Continue with analysis even if format detection fails
  }
}

export async function analyzeImageForHazards(
  imageBase64: string,
  userDetectedHazards?: string[]
): Promise<HazardAnalysisResult> {
  // Check circuit breaker before making API call
  if (circuitBreaker.isOpen()) {
    throw new Error('画像分析サービスが一時的に利用できません。しばらく時間をおいてから再度お試しください。')
  }

  try {
    // Validate input data
    validateImageData(imageBase64)
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

    // Record successful API call
    circuitBreaker.recordSuccess()

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error("OpenAIからの応答が空です")
    }

    // Parse JSON response with error handling
    let analysisResult: {
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

    try {
      analysisResult = JSON.parse(content)
    } catch (parseError) {
      console.error('JSON parsing failed:', parseError, 'Content:', content)
      
      // Try to extract JSON from markdown code block if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        try {
          analysisResult = JSON.parse(jsonMatch[1])
        } catch (secondParseError) {
          console.error('Second JSON parsing attempt failed:', secondParseError)
          throw new Error('OpenAIからの応答を正しく解析できませんでした')
        }
      } else {
        throw new Error('OpenAIからの応答形式が正しくありません')
      }
    }

    // Validate response structure
    if (!analysisResult.hazards || !Array.isArray(analysisResult.hazards)) {
      throw new Error('分析結果の形式が正しくありません')
    }

    // Sanitize and validate hazard data
    analysisResult.hazards = analysisResult.hazards.map(hazard => ({
      type: String(hazard.type || '不明'),
      description: String(hazard.description || '説明なし'),
      severity: Math.max(1, Math.min(5, Number(hazard.severity) || 1)),
      location: String(hazard.location || '不明'),
      confidence: Math.max(0, Math.min(1, Number(hazard.confidence) || 0))
    }))

    analysisResult.overallSafety = Math.max(1, Math.min(5, Number(analysisResult.overallSafety) || 3))
    analysisResult.educationalTips = Array.isArray(analysisResult.educationalTips) 
      ? analysisResult.educationalTips.map(tip => String(tip))
      : []

    // Calculate score based on analysis quality and user interaction
    const score = calculateGameScore(analysisResult.hazards, userDetectedHazards)

    return {
      ...analysisResult,
      score,
    }
  } catch (error) {
    console.error("Error analyzing image:", error)
    
    // Record failure for circuit breaker (only for actual API failures, not validation errors)
    if (error instanceof Error) {
      const isApiError = error.message.includes('rate limit') || 
                         error.message.includes('quota') || 
                         error.message.includes('timeout') ||
                         error.message.includes('model') ||
                         error.message.includes('OpenAI')
      
      if (isApiError) {
        circuitBreaker.recordFailure()
      }
    }
    
    // Categorize errors for better user experience
    if (error instanceof Error) {
      // OpenAI specific errors
      if (error.message.includes('rate limit')) {
        throw new Error('現在、多くのリクエストが処理されています。少し時間をおいてから再度お試しください。')
      }
      if (error.message.includes('insufficient_quota') || error.message.includes('quota')) {
        throw new Error('一時的にサービスが利用できません。しばらく時間をおいてから再度お試しください。')
      }
      if (error.message.includes('invalid_api_key')) {
        throw new Error('サービスの設定に問題があります。管理者にお問い合わせください。')
      }
      if (error.message.includes('model_not_found') || error.message.includes('model')) {
        throw new Error('画像分析機能が一時的に利用できません。しばらく時間をおいてから再度お試しください。')
      }
      if (error.message.includes('timeout')) {
        throw new Error('処理に時間がかかりすぎました。画像サイズを小さくするか、しばらく時間をおいてから再度お試しください。')
      }
      
      // Re-throw validation errors as-is (they're already user-friendly)
      const validationErrorPrefixes = [
        '画像データが提供されていません',
        '無効なbase64形式',
        '画像サイズが',
        'サポートされていない画像形式',
        '分析結果の形式が正しくありません',
        'OpenAIからの応答'
      ]
      
      if (validationErrorPrefixes.some(prefix => error.message.includes(prefix))) {
        throw error
      }
    }
    
    // Generic fallback error
    throw new Error("画像の分析に失敗しました。画像形式やサイズを確認の上、もう一度お試しください。")
  }
}

function calculateGameScore(
  detectedHazards: HazardAnalysisResult["hazards"],
  userDetectedHazards?: string[]
): number {
  // Ensure we have valid hazards array
  if (!Array.isArray(detectedHazards) || detectedHazards.length === 0) {
    return 10 // Minimum score for attempting analysis
  }

  let baseScore = Math.min(detectedHazards.length * 15, 80) // Base score for detected hazards
  
  // Bonus for high-confidence detections
  const highConfidenceHazards = detectedHazards.filter(h => 
    typeof h.confidence === 'number' && h.confidence > 0.8
  )
  baseScore += highConfidenceHazards.length * 5

  // Bonus for severe hazards detected
  const severeHazards = detectedHazards.filter(h => 
    typeof h.severity === 'number' && h.severity >= 4
  )
  baseScore += severeHazards.length * 10

  // Bonus for user interaction (if user detected hazards)
  if (userDetectedHazards && userDetectedHazards.length > 0) {
    baseScore += Math.min(userDetectedHazards.length * 3, 15)
  }

  return Math.max(10, Math.min(baseScore, 100)) // Ensure score is between 10 and 100
} 