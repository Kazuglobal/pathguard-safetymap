import { NextRequest, NextResponse } from "next/server"

import { createServerClient } from "@/lib/supabase-server"
import { fetchNearbyAccidentStats } from "@/lib/traffic-accident/server"
import {
  buildAccidentPromptContext,
  buildAccidentSummary,
} from "@/lib/hunter/accident-context"
import { analyzeHunterImage } from "@/lib/hunter/hunter-ai"
import { buildGuideMode } from "@/lib/hunter/fallback-hazards"
import { putAnswerKey } from "@/lib/hunter/answer-cache"
import { logAnalyzeFallback } from "@/lib/hunter/observability"
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
        kind: hazard.kind ?? null,
        accident_link: hazard.accidentLink ?? null,
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
    // 専用ハンターAIは throw しない (失敗/空/解析不能はガイドモードで吸収)。
    const analysis = await analyzeHunterImage(imageBase64, {
      sessionId,
      accidentContext,
      accidentSummary,
      purpose: "hunter-explore",
    })

    // フォールバック理由は HTTP では検知できないため必ず構造化ログへ。
    if (analysis.usedFallback && analysis.fallbackReason) {
      logAnalyzeFallback(analysis.fallbackReason, sessionId)
    }

    // トラスト境界の格上げ(任意): 正解鍵のみを匿名・短TTLで保存し、session 再採点を
    // サーバ権威にする。Upstash 未設定なら no-op(=従来のクライアント供給で採点)。
    // 画像/PII は保存しない。
    await putAnswerKey(sessionId, {
      hazards: analysis.hazards.map((h) => ({
        id: h.id,
        region: h.region,
        severity: h.severity,
        confidence: h.confidence,
      })),
      quiz: analysis.quiz.map((q) => ({
        id: q.id,
        kind: q.kind,
        correctChoiceId: q.correctChoiceId,
        answerRegion: q.answerRegion,
      })),
    })

    // 保存はオプトイン (save=true) かつ explore で hazards があるときのみ。
    const saved =
      save && analysis.mode === "explore" && analysis.hazards.length > 0
        ? await savePhoto(supabase, user.id, imageBase64, pin, analysis.hazards)
        : null

    return NextResponse.json({
      sessionId,
      mode: analysis.mode,
      hazards: analysis.hazards,
      quiz: analysis.quiz,
      safePoints: analysis.safePoints,
      accident: accidentSummary,
      usedFallback: analysis.usedFallback,
      fallbackReason: analysis.fallbackReason,
      noHazardFollow: analysis.noHazardFollow,
      analysisTimestamp: new Date().toISOString(),
      ...(saved
        ? {
            photoId: saved.photoId,
            signedUrl: saved.signedUrl,
            savedError: saved.savedError,
          }
        : {}),
    })
  } catch (error) {
    // belt: 想定外の例外でも 502 を出さず、ガイドモード 200 で体験を止めない。
    console.error("hunter/analyze unexpected error:", error)
    logAnalyzeFallback("ai_error", sessionId)
    const guide = buildGuideMode(accidentSummary, "ai_error", [], sessionId)

    // 通常経路と同じく正解鍵をキャッシュする(省略すると、Upstash 設定済み環境で
    // /api/hunter/session の 409 トラスト境界チェックがこのセッションを常に
    // 「キャッシュミス=改ざんの疑い」として弾いてしまい、正しく回答しても
    // 採点0点になる)。
    await putAnswerKey(sessionId, {
      hazards: [],
      quiz: guide.quiz.map((q) => ({
        id: q.id,
        kind: q.kind,
        correctChoiceId: q.correctChoiceId,
        answerRegion: q.answerRegion,
      })),
    })

    return NextResponse.json({
      sessionId,
      mode: guide.mode,
      hazards: guide.hazards,
      quiz: guide.quiz,
      safePoints: guide.safePoints,
      accident: accidentSummary,
      usedFallback: true,
      fallbackReason: guide.fallbackReason,
      noHazardFollow: guide.noHazardFollow,
      analysisTimestamp: new Date().toISOString(),
    })
  }
}
