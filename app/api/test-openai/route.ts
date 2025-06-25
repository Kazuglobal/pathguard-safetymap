import { NextRequest, NextResponse } from "next/server"
import { openai } from "@/lib/openai"

export async function GET(request: NextRequest) {
  try {
    console.log('Testing OpenAI API key...')
    
    // Test API key with a simple request
    const response = await openai().chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello, respond with 'API key works'" }],
      max_tokens: 10,
    })
    
    const content = response.choices[0]?.message?.content
    console.log('API test response:', content)
    
    return NextResponse.json({
      success: true,
      message: "OpenAI API key is working",
      response: content,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('OpenAI API test failed:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isAuthError = errorMessage.includes('api_key') || errorMessage.includes('unauthorized')
    const isQuotaError = errorMessage.includes('quota') || errorMessage.includes('billing')
    const isRateLimitError = errorMessage.includes('rate limit')
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      errorType: isAuthError ? 'auth' : isQuotaError ? 'quota' : isRateLimitError ? 'rate_limit' : 'unknown',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}