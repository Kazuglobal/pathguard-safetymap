import { NextRequest, NextResponse } from "next/server"
import { openai } from "@/lib/openai"

// セキュリティ上の理由により、このエンドポイントは本番環境では無効化されています
// APIキーの部分的な漏洩を防ぐため

export async function GET(request: NextRequest) {
  // 本番環境では常に403を返す
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is disabled in production" },
      { status: 403 }
    )
  }

  try {
    // If OpenAI is not configured, gracefully return a 200 response
    if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.startsWith('sk-')) {
      return NextResponse.json({
        success: false,
        message: 'OpenAI is not configured. Using Gemini instead for image tasks.',
        provider: 'gemini',
        timestamp: new Date().toISOString(),
      })
    }

    // Test API key with a simple request
    const response = await openai().chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello, respond with 'API key works'" }],
      max_tokens: 10,
    })

    const content = response.choices[0]?.message?.content

    // Test vision models - updated to current models
    const visionModels = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"]
    const modelAvailability: Record<string, boolean> = {}

    for (const model of visionModels) {
      try {
        await openai().chat.completions.create({
          model,
          messages: [{ role: "user", content: "test" }],
          max_tokens: 5,
        })
        modelAvailability[model] = true
      } catch {
        modelAvailability[model] = false
      }
    }

    // APIキーの部分情報は返さない
    return NextResponse.json({
      success: true,
      message: "OpenAI API key is working",
      response: content,
      modelAvailability,
      timestamp: new Date().toISOString(),
      warning: "Debug endpoint - API key details hidden for security"
    })
  } catch (error) {
    console.error('OpenAI API test failed:', error)
    
    if (error instanceof Error) {
      const errorObj = error as any
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        status: errorObj.status,
        code: errorObj.code,
        response: errorObj.response
      })
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isAuthError = errorMessage.includes('api_key') || errorMessage.includes('unauthorized') || errorMessage.includes('401')
    const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('billing')
    const isRateLimitError = errorMessage.includes('rate limit')
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorType: isAuthError ? 'auth' : isQuotaError ? 'quota' : isRateLimitError ? 'rate_limit' : 'unknown',
      apiKeyExists: !!process.env.OPENAI_API_KEY,
      apiKeyFormat: process.env.OPENAI_API_KEY?.startsWith('sk-') ? 'Valid format' : 'Invalid format',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
