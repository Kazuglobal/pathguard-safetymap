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
  createPhotoSignedUrl,
  uploadMaskedPhoto,
} from "@/lib/hunter/storage"
import { writeAuditLog } from "@/lib/hunter/audit"
import {
  checkGeminiRateLimit,
  rateLimitedResponse,
} from "@/lib/upstash-rate-limiter"
import type { DetectionItem } from "@/lib/hazard-game-types"
import type { HunterHazard } from "@/lib/hunter/types"

export const runtime = "nodejs"
export const maxDuration = 60

/** 検出に紐づける推論モデル名 (hazard_detections.model 用)。 */
const HUNTER_VISION_MODEL = "gemini-2.5-flash"
/** 写真の保持期限 (90日)。サーバ側で now() から算出する。 */
const PHOTO_RETENTION_DAYS = 90

/**
 * save=true のときだけ呼ばれる保存フロー (Phase 1)。
 * - マスク済み画像のみを非公開バケットへ保存 (未マスク画像は保存・ログしない)。
 * - hunter_photos / hazard_detections へ insert、監査ログを記録、署名URLを発行。
 * - 失敗してもゲームは継続できるよう、ここでは throw せず結果を返す。
 */
async function savePhoto(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string,
  imageBase64: string,
  pin: { latitude: number; longitude: number },
  hazards: readonly HunterHazard[],
): Promise<{ photoId: string | null; signedUrl: string | null; savedError: boolean }> {
  try {
    const photoId = crypto.randomUUID()
    const { path } = await uploadMaskedPhoto(supabase, userId, photoId, imageBase64)

    const retentionUntil = new Date(
      Date.now() + PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()

    const { error: photoError } = await supabase.from("hunter_photos").insert({
      id: photoId,
      player_id: userId,
      image_path: path,
      pin_lat: pin.latitude,
      pin_lng: pin.longitude,
      masked: true,
      exif_stripped: true,
      retention_until: retentionUntil,
    })
    if (photoError) {
      throw new Error(`写真メタデータの保存に失敗しました: ${photoError.message}`)
    }

    if (hazards.length > 0) {
      const detectionRows = hazards.map((hazard) => ({
        photo_id: photoId,
        type: hazard.type,
        region: hazard.region,
        severity: hazard.severity,
        kid_explanation: hazard.kidExplanation,
        safe_action: hazard.safeAction,
        confidence: hazard.confidence,
        model: HUNTER_VISION_MODEL,
      }))
      const { error: detectionError } = await supabase
        .from("hazard_detections")
        .insert(detectionRows)
      if (detectionError) {
        throw new Error(`検出結果の保存に失敗しました: ${detectionError.message}`)
      }
    }

    await writeAuditLog(supabase, userId, "analyze_save", photoId)

    const signedUrl = await createPhotoSignedUrl(supabase, path)
    return { photoId, signedUrl, savedError: false }
  } catch (error) {
    console.error("hunter/analyze save failed:", error)
    return { photoId: null, signedUrl: null, savedError: true }
  }
}

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

  const { imageBase64, pin, save } = parsed.data

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

    // 保存はオプトイン (save=true)。保存失敗してもゲームは継続する (検出結果は返す)。
    const saved = save
      ? await savePhoto(supabase, user.id, imageBase64, pin, hazards)
      : null

    return NextResponse.json({
      sessionId,
      hazards,
      accident: accidentSummary,
      usedFallback: mapped.length === 0,
      analysisTimestamp: analysis.analysisTimestamp,
      ...(saved
        ? {
            photoId: saved.photoId,
            signedUrl: saved.signedUrl,
            savedError: saved.savedError,
          }
        : {}),
    })
  } catch (error) {
    console.error("hunter/analyze pipeline failed:", error)
    return NextResponse.json(
      { error: "写真の解析にしっぱいしました。もう一度ためしてね。" },
      { status: 502 },
    )
  }
}
