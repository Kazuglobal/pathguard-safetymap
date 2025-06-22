import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"
import { analyzeImageForHazards } from "@/lib/openai"

// Request size limit (25MB to allow for base64 encoding overhead)
const MAX_REQUEST_SIZE = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json(
        { error: "画像データが必要です" },
        { status: 400 }
      )
    }

    if (typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: "画像データは文字列形式である必要があります" },
        { status: 400 }
      )
    }

    let analysisResult: any
    let sessionId = null

    try {
      // Analyze image with OpenAI
      analysisResult = await analyzeImageForHazards(
        imageBase64,
        userDetectedHazards
      )
      
      console.log(`Analysis completed for user ${user.id}: ${analysisResult.hazards.length} hazards detected, score: ${analysisResult.score}`)
      
    } catch (analysisError) {
      console.error("Image analysis failed:", analysisError)
      
      // Return specific error message from OpenAI analysis
      const errorMessage = analysisError instanceof Error 
        ? analysisError.message 
        : "画像の分析中にエラーが発生しました"
      
      return NextResponse.json(
        { error: errorMessage },
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