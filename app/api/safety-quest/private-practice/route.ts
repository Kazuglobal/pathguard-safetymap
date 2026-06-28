import { NextRequest, NextResponse } from "next/server"

import { analyzeImagePipeline } from "@/lib/gemini-hazard"
import { createServerClient } from "@/lib/supabase-server"
import {
  calculateSafetyQuestPoints,
  parseSafetyQuestMarkers,
} from "@/lib/safety-quest"

export const runtime = "nodejs"

const MAX_IMAGE_BASE64_LENGTH = 25 * 1024 * 1024

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "リクエストJSONが正しくありません" }, { status: 400 })
  }

  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : ""
  const userMarkers = parseSafetyQuestMarkers(body.userMarkers ?? [])

  if (!imageBase64 || imageBase64.length > MAX_IMAGE_BASE64_LENGTH || !userMarkers) {
    return NextResponse.json({ error: "画像データまたはマーカーが正しくありません" }, { status: 400 })
  }

  const analysis = await analyzeImagePipeline(imageBase64, userMarkers, "child")
  const pointsAwarded = calculateSafetyQuestPoints({
    rawPoints: analysis.score.score,
    sourceType: "private",
  })

  return NextResponse.json({
    private: true,
    pointsAwarded,
    score: analysis.score,
    vision: analysis.vision,
    think: analysis.think,
    educationalTips: [
      "この練習写真は公開チャレンジには追加されません。",
      ...analysis.educationalTips,
    ],
    analysisTimestamp: analysis.analysisTimestamp,
  })
}
