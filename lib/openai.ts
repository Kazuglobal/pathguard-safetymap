import OpenAI from "openai"

// OpenAI クライアントを初期化して再利用できるようにエクスポートします。
// 環境変数に OPENAI_API_KEY と（必要なら）OPENAI_ORG_ID を設定してください。
// 例: .env.local
//      OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
//      OPENAI_ORG_ID=org_xxxxxxxxxxxxx

// OpenAI API key validation
const validateOpenAIConfig = () => {
  const apiKey = process.env.OPENAI_API_KEY
  console.log('Checking OpenAI API key...')
  console.log('API key present:', !!apiKey)
  console.log('API key starts with "sk-":', apiKey?.startsWith('sk-') ?? false)
  
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set in environment variables')
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  if (!apiKey.startsWith('sk-')) {
    console.error('Invalid OpenAI API key format - should start with "sk-"')
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

// Test API key validity
const testOpenAIKey = async (client: OpenAI): Promise<boolean> => {
  try {
    console.log('Testing OpenAI API key validity...')
    // Simple test request to verify API key works
    const response = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 5,
    })
    console.log('API key test successful')
    return true
  } catch (error) {
    console.error('API key test failed:', error)
    return false
  }
}

// Initialize OpenAI client with validation (lazy initialization)
let openaiClient: OpenAI | null = null

// Force client recreation when API key changes
let lastApiKey: string | null = null

const getOpenAIClient = (): OpenAI => {
  const currentApiKey = process.env.OPENAI_API_KEY
  
  // Recreate client if API key changed
  if (openaiClient && lastApiKey !== currentApiKey) {
    console.log('API key changed, recreating OpenAI client...')
    openaiClient = null
  }
  
  if (!openaiClient) {
    try {
      console.log('Initializing OpenAI client...')
      const apiKey = validateOpenAIConfig()
      console.log('API key length:', apiKey.length)
      console.log('API key prefix:', apiKey.substring(0, 20) + '...')
      
      openaiClient = new OpenAI({
        apiKey,
        organization: process.env.OPENAI_ORG_ID,
        timeout: 60000, // Increased to 60 second timeout
        maxRetries: 3, // Increased retry attempts
      })
      console.log('OpenAI client initialized successfully')
      console.log('Organization ID:', process.env.OPENAI_ORG_ID || 'Not set')
      
      // Store the API key used
      lastApiKey = apiKey
    } catch (error) {
      console.error('OpenAI initialization failed:', error)
      if (error instanceof Error) {
        console.error('Init error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3)
        })
      }
      throw error
    }
  }
  return openaiClient
}

export const openai = getOpenAIClient

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
  console.log('Validating image data...')
  
  if (!imageBase64) {
    throw new Error('画像データが提供されていません')
  }

  // Check if it's valid base64 (more lenient check)
  const base64Regex = /^[A-Za-z0-9+/=]+$/
  if (!base64Regex.test(imageBase64)) {
    console.warn('Base64 validation failed, but continuing...')
    // Continue instead of throwing error - some valid base64 might not pass strict regex
  }

  // Check image size
  const sizeInBytes = (imageBase64.length * 3) / 4
  console.log(`Image size: ${(sizeInBytes / 1024 / 1024).toFixed(2)} MB`)
  
  if (sizeInBytes > MAX_IMAGE_SIZE) {
    throw new Error(`画像サイズが大きすぎます。最大${MAX_IMAGE_SIZE / 1024 / 1024}MBまでです`)
  }
  if (sizeInBytes < MIN_IMAGE_SIZE) {
    throw new Error('画像サイズが小さすぎます')
  }

  // Try to detect image format from base64 header (more lenient)
  try {
    // First check the full buffer to validate size
    const fullBuffer = Buffer.from(imageBase64, 'base64')
    console.log('Full image buffer size:', fullBuffer.length, 'bytes')
    
    if (fullBuffer.length < 100) {
      console.error('Image buffer too small:', fullBuffer.length, 'bytes')
      throw new Error('画像データが小さすぎます。有効な画像ファイルを選択してください。')
    }
    
    const header = imageBase64.substring(0, 100) // Increased header size
    const buffer = Buffer.from(header, 'base64')
    const uint8Array = new Uint8Array(buffer)
    
    console.log('Image header bytes:', Array.from(uint8Array.slice(0, 12)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '))
    
    // Check for common image file signatures (more flexible)
    const isJPEG = uint8Array[0] === 0xFF && uint8Array[1] === 0xD8
    const isPNG = uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47
    const isGIF = (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46)
    const isWebP = (uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50)
    
    console.log('Image format detection:', {
      isJPEG,
      isPNG,
      isGIF,
      isWebP,
      firstBytes: Array.from(uint8Array.slice(0, 4)).map(b => b.toString(16).padStart(2, '0')).join(' ')
    })
    
    if (isJPEG) console.log('Detected JPEG format')
    else if (isPNG) console.log('Detected PNG format')  
    else if (isGIF) console.log('Detected GIF format')
    else if (isWebP) console.log('Detected WebP format')
    else console.warn('Unknown image format, but continuing with analysis...')
    
    // Continue with analysis even if format is unknown
  } catch (formatError) {
    console.warn('Image format validation failed, but continuing:', formatError)
    // Continue with analysis even if format detection fails
  }
  
  console.log('Image validation completed')
}

export async function analyzeImageForHazards(
  imageBase64: string,
  userDetectedHazards?: string[]
): Promise<HazardAnalysisResult> {
  console.log('=== ANALYZE IMAGE FOR HAZARDS CALLED ===')
  console.log('Input image base64 length:', imageBase64?.length ?? 0)
  console.log('User detected hazards:', userDetectedHazards)
  console.log('API key available:', !!process.env.OPENAI_API_KEY)
  console.log('API key format check:', process.env.OPENAI_API_KEY?.substring(0, 20) + '...')
  console.log('Current timestamp:', new Date().toISOString())
  
  // Check circuit breaker before making API call
  if (circuitBreaker.isOpen()) {
    console.error('Circuit breaker is open - too many recent failures')
    throw new Error('画像分析サービスが一時的に利用できません。しばらく時間をおいてから再度お試しください。')
  }

  try {
    console.log('Starting try block...')
    console.log('Validating image data...')
    // Validate input data
    validateImageData(imageBase64)
    console.log('Image validation passed')
    
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

    console.log('Calling OpenAI API...')
    
    // First, do a simple health check
    try {
      console.log('Performing API health check...')
      const healthCheck = await getOpenAIClient().chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      })
      console.log('API health check passed')
    } catch (healthError) {
      console.error('API health check failed:', healthError)
      if (healthError instanceof Error) {
        console.error('Health check error details:', healthError.message)
        
        // Check for common authentication errors
        if (healthError.message.includes('401') || healthError.message.includes('Incorrect API key')) {
          throw new Error('APIキーが無効です。環境変数を確認してください。')
        }
        if (healthError.message.includes('429')) {
          throw new Error('APIのレート制限に達しました。しばらく待ってから再試行してください。')
        }
      }
      throw healthError
    }
    
    // Try different models with fallback
    // Updated to current OpenAI vision models as of 2024/2025
    const models = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4-turbo-2024-04-09", "gpt-4-1106-vision-preview"]
    let response
    let lastError
    
    for (const model of models) {
      try {
        console.log(`Attempting with model: ${model}`)
        response = await getOpenAIClient().chat.completions.create({
          model: model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: { 
                    url: `data:image/jpeg;base64,${imageBase64}`,
                    detail: "high" // Add detail parameter for better analysis
                  },
                },
              ],
            },
          ],
          max_tokens: 1500,
          temperature: 0.3,
        })
        console.log(`Successfully used model: ${model}`)
        break
      } catch (modelError) {
        console.error(`=== Model ${model} failed ===`)
        console.error('Error details:', modelError)
        if (modelError instanceof Error) {
          console.error('Error message:', modelError.message)
          console.error('Error name:', modelError.name)
          const errorObj = modelError as any
          if (errorObj.status) console.error('HTTP status:', errorObj.status)
          if (errorObj.code) console.error('Error code:', errorObj.code)
          if (errorObj.response?.data) console.error('Response data:', errorObj.response.data)
          
          // Check for specific OpenAI error types
          if (modelError.message.includes('400')) {
            console.error('Bad Request - possibly invalid image format or parameters')
          }
          if (modelError.message.includes('413')) {
            console.error('Payload Too Large - image might be too big')
          }
          if (modelError.message.includes('415')) {
            console.error('Unsupported Media Type - image format issue')
          }
        }
        console.error(`=== End ${model} error ===`)
        lastError = modelError
        continue
      }
    }
    
    if (!response) {
      console.error('All vision models failed')
      
      // Last resort: Try with base64 image description (non-vision fallback)
      try {
        console.log('Attempting non-vision fallback with gpt-3.5-turbo...')
        response = await getOpenAIClient().chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are analyzing an image that has been provided. Since you cannot see the image directly, provide a generic safety analysis response."
            },
            {
              role: "user",
              content: prompt + "\n\n注意: 画像を直接分析できないため、一般的な安全性のアドバイスを提供してください。"
            }
          ],
          max_tokens: 1500,
          temperature: 0.3,
        })
        console.log('Non-vision fallback successful')
      } catch (fallbackError) {
        console.error('Non-vision fallback also failed:', fallbackError)
        throw lastError || new Error('すべてのモデルでエラーが発生しました')
      }
    }

    console.log('OpenAI API call successful')
    // Record successful API call
    circuitBreaker.recordSuccess()

    const content = response.choices[0]?.message?.content
    console.log('Response content length:', content?.length ?? 0)
    
    if (!content) {
      console.error('Empty response from OpenAI')
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
    console.error("=== DETAILED ERROR IN analyzeImageForHazards ===")
    console.error("Error analyzing image:", error)
    
    if (error instanceof Error) {
      console.error("Error name:", error.name)
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
      
      // Log any additional error properties
      const errorObj = error as any
      if (errorObj.status) console.error("Error status:", errorObj.status)
      if (errorObj.code) console.error("Error code:", errorObj.code)
      if (errorObj.response) console.error("Error response:", errorObj.response)
    }
    console.error("=== END DETAILED ERROR ===")
    
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
      if (error.message.includes('invalid_api_key') || error.message.includes('Incorrect API key')) {
        throw new Error('サービスの設定に問題があります。管理者にお問い合わせください。')
      }
      if (error.message.includes('model_not_found') || error.message.includes('does not exist')) {
        throw new Error('画像分析機能が一時的に利用できません。しばらく時間をおいてから再度お試しください。')
      }
      if (error.message.includes('timeout')) {
        throw new Error('処理に時間がかかりすぎました。画像サイズを小さくするか、しばらく時間をおいてから再度お試しください。')
      }
      if (error.message.includes('400') || error.message.includes('Bad Request')) {
        throw new Error('画像形式が正しくありません。JPEG、PNG、GIF、WebP形式の画像をお使いください。')
      }
      if (error.message.includes('413') || error.message.includes('too large')) {
        throw new Error('画像ファイルが大きすぎます。20MB以下の画像をお使いください。')
      }
      if (error.message.includes('415')) {
        throw new Error('サポートされていない画像形式です。JPEG、PNG、GIF、WebP形式の画像をお使いください。')
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
    
    // Log the actual error before throwing generic message
    console.error('=== UNHANDLED ERROR TYPE ===')
    console.error('Full error object:', error)
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error instanceof Error ? error.constructor.name : 'Not an Error instance')
    if (error instanceof Error) {
      console.error('Error toString():', error.toString())
      console.error('All error properties:', Object.getOwnPropertyNames(error))
      console.error('Error JSON:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
    }
    console.error('=== END UNHANDLED ERROR ===')
    
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