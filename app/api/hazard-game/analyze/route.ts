import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"
import { analyzeImageForHazards } from "@/lib/openai"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { imageBase64, userDetectedHazards } = body

    if (!imageBase64) {
      return NextResponse.json(
        { error: "画像データが必要です" },
        { status: 400 }
      )
    }

    // Analyze image with OpenAI
    const analysisResult = await analyzeImageForHazards(
      imageBase64,
      userDetectedHazards
    )

    // For now, we'll store the session in a JSON column in an existing table
    // TODO: Run the database migration to add the hazard_game_sessions table
    let sessionId = null

    // Award points to user using the existing function
    try {
      await supabase.rpc("increment_user_points", {
        p_user_id: user.id,
        p_delta: analysisResult.score,
      })

      // For mission progress, we'll implement this later when the missions are properly set up
      // TODO: Update mission progress for hazard game missions
      
    } catch (pointsError) {
      console.error("Error updating points:", pointsError)
      // Continue even if points update fails
    }

    return NextResponse.json({
      success: true,
      ...analysisResult,
      sessionId,
    })

  } catch (error) {
    console.error("Error in hazard game analysis:", error)
    
    // Return user-friendly error message
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
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

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
    return NextResponse.json(
      { error: "ゲーム履歴の取得に失敗しました" },
      { status: 500 }
    )
  }
}