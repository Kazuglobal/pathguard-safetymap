import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    
    return NextResponse.json({
      hasApiKey: !!apiKey,
      apiKeyStart: apiKey?.substring(0, 15) + '...' || 'Not found',
      apiKeyFormat: apiKey?.startsWith('sk-') || false,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to check environment',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}