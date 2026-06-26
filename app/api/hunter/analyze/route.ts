import { NextRequest, NextResponse } from "next/server"

import { analyzeImagePipeline } from "@/lib/gemini-hazard"
import { createServerClient } from "@/lib/supabase-server"
import { fetchNearbyAccidentStats } from "@/lib/traffic-accident/server"
import {
  buildAccidentPromptContext,
  buildAccidentSummary,
} from "@/lib/hunter/accident-context"
import { mapDetectionsToHunterHazards } from "@/lib/hunter/detection-mapper"
import { resolveExploreTargets } from "@/lib/hunter/fallback-hazards"
import { parseAnalyzeBody } from "@/lib/hunter/validation"
import {
  checkGeminiRateLimit,
  rateLimitedResponse,
} from "@/lib/upstash-rate-limiter"
import type { DetectionItem } from "@/lib/hazard-game-types"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * POST /api/hunter/analyze — きけんハンター 探索モードの画像解析 (Phase 0)
 *
 * - 認証必須
 * - レート制限 (高コストAIエンドポイント, B6)
 * - 第三者AI送信の同意ゲート (consent, B3)
 * - 画像は保存しない (Phase 0)。マスク済み画像のみが送られてくる前提。
 * - ピン周辺の事故統計を AI プロンプトに注入し、「気をつけるカード」用サマリを返す。
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const rate = await checkGeminiRateLimit(`hunter-analyze:${user.id}`)
  if (!rate.success) {
    return rateLimitedResponse(rate.reset)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "リクエストJSONが正しくありません" }, { status: 400 })
  }

  const parsed = parseAnalyzeBody(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { imageBase64, pin } = parsed.data

  // 事故統計は失敗してもゲームを止めない (graceful degrade)。
  const accidentStats = await fetchNearbyAccidentStats(supabase, pin)
  const accidentContext = buildAccidentPromptContext(accidentStats)
  const accidentSummary = buildAccidentSummary(accidentStats)

  const sessionId =
    globalThis.crypto?.randomUUID?.() ?? `hunter-${Date.now()}`

  try {
    const analysis = await analyzeImagePipeline(imageBase64, {
      promptType: "child",
      accidentContext,
      purpose: "hunter-explore",
    })

    const detections: DetectionItem[] = [
      ...analysis.vision.hazards,
      ...analysis.vision.traffic,
      ...analysis.vision.obstructions,
    ]
    const mapped = mapDetectionsToHunterHazards(detections, { sessionId })
    // ダブル空 (事故0件 + AI検出0件) でもゲームが成立するようフォールバック (B5)
    const hazards = resolveExploreTargets(mapped)

    return NextResponse.json({
      sessionId,
      hazards,
      accident: accidentSummary,
      usedFallback: mapped.length === 0,
      analysisTimestamp: analysis.analysisTimestamp,
    })
  } catch (error) {
    console.error("hunter/analyze pipeline failed:", error)
    return NextResponse.json(
      { error: "写真の解析にしっぱいしました。もう一度ためしてね。" },
      { status: 502 },
    )
  }
}
