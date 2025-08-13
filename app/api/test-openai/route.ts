import { NextRequest, NextResponse } from "next/server"
import { openai } from "@/lib/openai"

export async function GET(request: NextRequest) {
  try {
    console.log('Testing OpenAI API key...')
    console.log('API key exists:', !!process.env.OPENAI_API_KEY)
    console.log('API key format:', process.env.OPENAI_API_KEY?.startsWith('sk-') ? 'Valid (sk-)' : 'Invalid format')
    
    // Test API key with a simple request
    const response = await openai().chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello, respond with 'API key works'" }],
      max_tokens: 10,
    })
    
    const content = response.choices[0]?.message?.content
    console.log('API test response:', content)
    
    // Test vision models - updated to current models
    const visionModels = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4-turbo-2024-04-09", "gpt-4-1106-vision-preview"]
    const modelAvailability: Record<string, boolean> = {}
    
    for (const model of visionModels) {
      try {
        console.log(`Testing model ${model}...`)
        await openai().chat.completions.create({
          model,
          messages: [{ role: "user", content: "test" }],
          max_tokens: 5,
        })
        modelAvailability[model] = true
        console.log(`✓ Model ${model} is available`)
      } catch (modelError) {
        modelAvailability[model] = false
        console.log(`✗ Model ${model} is not available:`, modelError instanceof Error ? modelError.message : 'Unknown error')
      }
    }
    
    return NextResponse.json({
      success: true,
      message: "OpenAI API key is working",
      response: content,
      modelAvailability,
      apiKeyPrefix: process.env.OPENAI_API_KEY?.substring(0, 10) + "...",
      timestamp: new Date().toISOString()
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