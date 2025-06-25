import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"
import { analyzeImageForHazards } from "@/lib/openai"

// Request size limit (25MB to allow for base64 encoding overhead)
const MAX_REQUEST_SIZE = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
    console.log('Starting hazard game analysis request...')
    
    // Check request size before processing
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > MAX_REQUEST_SIZE) {
      return NextResponse.json(
        { error: `リクエストサイズが大きすぎます。最大${MAX_REQUEST_SIZE / 1024 / 1024}MBまでです` },
        { status: 413 }
      )
    }

    const supabase = await createServerClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.warn('Authentication failed:', authError)
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    console.log(`User authenticated: ${user.id}`)

    let body: any
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError)
      return NextResponse.json(
        { error: "リクエストデータの形式が正しくありません" },
        { status: 400 }
      )
    }

    const { imageBase64, userDetectedHazards } = body

    if (!imageBase64) {
      console.error('No image data provided')
      return NextResponse.json(
        { error: "画像データが必要です" },
        { status: 400 }
      )
    }

    if (typeof imageBase64 !== 'string') {
      console.error('Invalid image data type:', typeof imageBase64)
      return NextResponse.json(
        { error: "画像データは文字列形式である必要があります" },
        { status: 400 }
      )
    }

    console.log(`Image data received, size: ${imageBase64.length} characters`)

    let analysisResult: any
    let sessionId = null

    try {
      console.log('Starting OpenAI analysis...')
      console.log('User ID:', user.id)
      console.log('Image base64 length:', imageBase64.length)
      console.log('User detected hazards:', userDetectedHazards)
      console.log('Environment check - OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY)
      console.log('Environment check - OPENAI_API_KEY starts with sk-:', process.env.OPENAI_API_KEY?.startsWith('sk-'))
      
      // Analyze image with OpenAI
      analysisResult = await analyzeImageForHazards(
        imageBase64,
        userDetectedHazards
      )
      
      console.log(`Analysis completed for user ${user.id}: ${analysisResult.hazards.length} hazards detected, score: ${analysisResult.score}`)
      
    } catch (analysisError) {
      console.error("=== IMAGE ANALYSIS ERROR DETAILS ===")
      console.error("Error occurred during image analysis:", analysisError)
      
      // Log detailed error information
      if (analysisError instanceof Error) {
        console.error('Error name:', analysisError.name)
        console.error('Error message:', analysisError.message)
        console.error('Error stack:', analysisError.stack)
        
        // Log specific error patterns for debugging
        if (analysisError.message.includes('rate limit')) {
          console.error('RATE LIMIT ERROR detected')
        }
        if (analysisError.message.includes('quota')) {
          console.error('QUOTA ERROR detected')
        }
        if (analysisError.message.includes('api_key')) {
          console.error('API KEY ERROR detected')
        }
        if (analysisError.message.includes('model')) {
          console.error('MODEL ERROR detected')
        }
      }
      
      console.error("=== END ERROR DETAILS ===")
      
      // Return specific error message from OpenAI analysis
      const errorMessage = analysisError instanceof Error 
        ? analysisError.message 
        : "画像の分析中にエラーが発生しました"
      
      return NextResponse.json(
        { error: errorMessage, debugInfo: process.env.NODE_ENV === 'development' ? {
          errorName: analysisError instanceof Error ? analysisError.name : 'Unknown',
          originalError: analysisError instanceof Error ? analysisError.message : 'Unknown'
        } : undefined },
        { status: 422 } // Unprocessable Entity for analysis failures
      )
    }

    // Only award points if analysis was successful
    try {
      const { error: pointsError } = await supabase.rpc("increment_user_points", {
        p_user_id: user.id,
        p_delta: analysisResult.score,
      })
      
      if (pointsError) {
        console.error("Error updating points:", pointsError)
        // Don't fail the request if points update fails, but log it
      } else {
        console.log(`Points awarded to user ${user.id}: ${analysisResult.score}`)
      }

      // For mission progress, we'll implement this later when the missions are properly set up
      // TODO: Update mission progress for hazard game missions
      
    } catch (pointsError) {
      console.error("Error in points transaction:", pointsError)
      // Continue even if points update fails - the analysis was successful
    }

    return NextResponse.json({
      success: true,
      ...analysisResult,
      sessionId,
    })

  } catch (error) {
    console.error("Error in hazard game analysis:", error)
    
    // Categorize errors for appropriate HTTP status codes
    if (error instanceof Error) {
      // Authentication errors
      if (error.message.includes('認証')) {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        )
      }
      
      // Validation errors
      if (error.message.includes('画像データ') || 
          error.message.includes('形式') || 
          error.message.includes('サイズ')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
      
      // Rate limiting errors
      if (error.message.includes('rate limit') || error.message.includes('多くのリクエスト')) {
        return NextResponse.json(
          { error: error.message },
          { status: 429 }
        )
      }
      
      // Service unavailable errors
      if (error.message.includes('一時的に') || error.message.includes('利用できません')) {
        return NextResponse.json(
          { error: error.message },
          { status: 503 }
        )
      }
    }
    
    // Generic server error
    const errorMessage = error instanceof Error 
      ? error.message 
      : "画像の分析中にエラーが発生しました。もう一度お試しください。"

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.warn('Authentication failed for GET request:', authError)
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    console.log(`Fetching game history for user ${user.id}`)

    // For now, return mock data until database migration is complete
    // TODO: Implement real game history once hazard_game_sessions table is created
    
    return NextResponse.json({
      sessions: [],
      stats: {
        totalSessions: 0,
        averageScore: 0,
        highScore: 0,
        totalHazardsDetected: 0,
      },
    })

  } catch (error) {
    console.error("Error fetching game history:", error)
    
    const errorMessage = error instanceof Error 
      ? `ゲーム履歴の取得に失敗しました: ${error.message}` 
      : "ゲーム履歴の取得に失敗しました"
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}