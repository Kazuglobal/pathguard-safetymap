import { NextRequest, NextResponse } from "next/server"

import { getActor } from "@/lib/auth/actor"
import { saveHunterPhoto } from "@/lib/db/repos/hunter.repo"
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
  deletePhotoObjects,
  uploadMaskedPhoto,
} from "@/lib/hunter/storage"
import { writeAuditLog } from "@/lib/hunter/audit"
import {
  checkGeminiRateLimit,
  rateLimitedResponse,
} from "@/lib/upstash-rate-limiter"
import {
  getSanitizedGeminiVisionModel,
  REALTIME_VISION_DEFAULT_MODEL,
} from "@/lib/gemini-util"
import type { HunterHazard } from "@/lib/hunter/types"

export const runtime = "nodejs"
export const maxDuration = 60

/**
 * 検出に紐づける推論モデル名 (hazard_detections.model 用)。
 * callGeminiVision が実際に解決するモデルと同じ手順で解決し、DB記録と実呼び出しを一致させる。
 */
const HUNTER_VISION_MODEL = getSanitizedGeminiVisionModel(REALTIME_VISION_DEFAULT_MODEL)
/** 写真の保持期限 (90日)。サーバ側で now() から算出する。 */
const PHOTO_RETENTION_DAYS = 90

/**
 * save=true のときだけ呼ばれる保存フロー (Phase 1)。
 * - マスク済み画像のみを非公開バケットへ保存 (未マスク画像は保存・ログしない)。
 * - hunter_photos / hazard_detections へ insert、監査ログを記録、署名URLを発行。
 * - 失敗してもゲームは継続できるよう、ここでは throw せず結果を返す。
 */
async function savePhoto(
  actor: Extract<Awaited<ReturnType<typeof getActor>>, { kind: "user" }>,
  imageBase64: string,
  pin: { latitude: number; longitude: number },
  hazards: readonly HunterHazard[],
): Promise<{ photoId: string | null; signedUrl: string | null; savedError: boolean }> {
  try {
    const photoId = crypto.randomUUID()
    const { path } = await uploadMaskedPhoto(actor.id, photoId, imageBase64)

    const retentionUntil = new Date(
      Date.now() + PHOTO_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString()

    try {
      await saveHunterPhoto(actor, {
        id: photoId, imageKey: path, pinLat: pin.latitude, pinLng: pin.longitude,
        retentionUntil,
        detections: hazards.map((hazard) => ({
        type: hazard.type,
        kind: hazard.kind ?? null,
        accidentLink: hazard.accidentLink ?? null,
        region: { ...hazard.region },
        severity: hazard.severity,
        kidExplanation: hazard.kidExplanation,
        safeAction: hazard.safeAction,
        confidence: hazard.confidence,
        model: HUNTER_VISION_MODEL,
        })),
      })
    } catch (error) {
      await deletePhotoObjects(actor.id, photoId).catch(() => undefined)
      throw error
    }

    await writeAuditLog(actor, "analyze_save", photoId)

    const signedUrl = createPhotoSignedUrl(path)
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
  const actor = await getActor()
  if (actor.kind !== "user") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const rate = await checkGeminiRateLimit(`hunter-analyze:${actor.id}`)
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
  const accidentStats = await fetchNearbyAccidentStats(pin)
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
        ? await savePhoto(actor, imageBase64, pin, analysis.hazards)
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
      // 「のこす」を選んだのに保存しなかった理由(guide=危険が見つからなかった)。
      // 黙って空のノートにせず、クライアントが子どもに理由を伝えるための印。
      ...(save && !saved ? { saveSkipped: analysis.mode === "guide" ? "guide" : "no-hazards" } : {}),
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
