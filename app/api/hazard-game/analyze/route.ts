import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
import { createServerClient } from "@/lib/supabase-server"
import { analyzeImagePipeline } from "@/lib/gemini-hazard"
import type { PipelineAnalysisResult, SafetyLevel } from "@/lib/hazard-game-types"

// Request size limit (25MB to allow for base64 encoding overhead)
const MAX_REQUEST_SIZE = 25 * 1024 * 1024

function toLegacyOverallSafety(level: SafetyLevel): number {
  switch (level) {
    case "safe": return 4
    case "caution": return 3
    case "warning": return 2
    case "danger": return 1
  }
}

function toLegacyHazards(result: PipelineAnalysisResult) {
  return result.vision.hazards.map((item) => ({
    type: item.label,
    description: item.description,
    severity: item.confidence >= 0.8 ? 1 : item.confidence >= 0.5 ? 2 : 3,
    location: item.category,
    confidence: item.confidence,
    bbox: item.positions[0]
      ? {
          x: item.positions[0].x,
          y: item.positions[0].y,
          width: item.positions[0].width,
          height: item.positions[0].height,
        }
      : undefined,
  }))
}

export async function POST(request: NextRequest) {
  try {
    const includeDebug = process.env.NODE_ENV !== "production"
    console.log('Starting hazard game pipeline analysis...')

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

    if (includeDebug) console.log(`User authenticated: ${user.id.slice(0, 8)}***`)

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

    const { imageBase64, userDetectedHazards, promptType } = body

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

    if (includeDebug) console.log(`Image data received, size: ${imageBase64.length} characters`)

    let pipelineResult: PipelineAnalysisResult
    let sessionId = null

    try {
      if (includeDebug) {
        console.log('Starting pipeline analysis (Vision → Think → Score)...')
        console.log('Prompt type:', promptType || "default")
      }

      pipelineResult = await analyzeImagePipeline(
        imageBase64,
        userDetectedHazards,
        promptType || "default"
      )

      const { score, vision } = pipelineResult
      const totalDetections =
        vision.safetyEquipment.length +
        vision.hazards.length +
        vision.traffic.length +
        vision.obstructions.length

      console.log(
        `Pipeline complete: score=${score.score} (${score.level}), ` +
        `detections=${totalDetections}, ` +
        `contextual_risks=${pipelineResult.think.contextualRisks.length}, ` +
        `inference=${vision.inferenceTimeMs}ms`
      )

    } catch (analysisError) {
      console.error("=== PIPELINE ANALYSIS ERROR ===")
      console.error("Error:", analysisError)

      if (analysisError instanceof Error) {
        console.error('Error name:', analysisError.name)
        console.error('Error message:', analysisError.message)

        const msg = analysisError.message || ''

        // Auth errors
        if (/\b401\b|\b403\b/i.test(msg) || /unauthorized|forbidden|api\s*key/i.test(msg)) {
          return NextResponse.json(
            {
              error: '画像分析サービスの認証に失敗しました。管理者にお問い合わせください。',
              ...(includeDebug ? { debugInfo: { originalError: msg, timestamp: new Date().toISOString() } } : {}),
            },
            { status: 401 }
          )
        }

        // Quota errors
        if (msg.includes('利用枠') || msg.includes('quota') || msg.includes('クレジット')) {
          return NextResponse.json(
            {
              error: 'Gemini APIの利用枠を超過しています。Google Cloud Console でクォータ/請求設定をご確認ください。',
              ...(includeDebug ? { debugInfo: { originalError: msg, timestamp: new Date().toISOString() } } : {}),
            },
            { status: 429 }
          )
        }
      }

      console.error("=== END ERROR DETAILS ===")

      const errorMessage = analysisError instanceof Error
        ? analysisError.message
        : "画像の分析中にエラーが発生しました"

      let status = 422
      if (errorMessage.includes('認証') || errorMessage.includes('APIキー')) status = 401
      else if (errorMessage.includes('rate limit') || errorMessage.includes('利用枠')) status = 429
      else if (errorMessage.includes('サイズ') || errorMessage.includes('大きすぎ')) status = 413

      const clientMessage = includeDebug ? errorMessage : "画像の分析中にエラーが発生しました。"
      return NextResponse.json(
        {
          error: clientMessage,
          ...(includeDebug ? { debugInfo: { originalError: errorMessage, timestamp: new Date().toISOString() } } : {}),
        },
        { status }
      )
    }

    // Award points based on deterministic score
    try {
      const { error: pointsError } = await supabase.rpc("increment_user_points", {
        p_user_id: user.id,
        p_delta: pipelineResult.score.score,
      })

      if (pointsError) {
        console.error("Error updating points:", pointsError)
      } else {
        console.log(`Points awarded to user ${user.id}: ${pipelineResult.score.score}`)
      }
    } catch (pointsError) {
      console.error("Error in points transaction:", pointsError)
    }

    // Return both new pipeline format and legacy-compatible fields
    return NextResponse.json({
      success: true,
      // New pipeline fields
      vision: pipelineResult.vision,
      think: pipelineResult.think,
      score: pipelineResult.score,
      educationalTips: pipelineResult.educationalTips,
      analysisTimestamp: pipelineResult.analysisTimestamp,
      // Legacy-compatible fields
      hazards: toLegacyHazards(pipelineResult),
      overallSafety: toLegacyOverallSafety(pipelineResult.score.level),
      legacyScore: pipelineResult.score.score,
      sessionId,
    })

  } catch (error) {
    console.error("Error in hazard game analysis:", error)

    if (error instanceof Error) {
      if (error.message.includes('認証')) {
        return NextResponse.json({ error: error.message }, { status: 401 })
      }
      if (error.message.includes('画像データ') || error.message.includes('形式') || error.message.includes('サイズ')) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      if (error.message.includes('rate limit') || error.message.includes('多くのリクエスト')) {
        return NextResponse.json({ error: error.message }, { status: 429 })
      }
    }

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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.warn('Authentication failed for GET request:', authError)
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 }
      )
    }

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
