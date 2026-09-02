import { NextRequest, NextResponse } from "next/server"

import { getActor } from "@/lib/auth/actor"
import {
  deleteHunterPhoto,
  getHunterPhoto,
  getHunterPhotoWithDetections,
} from "@/lib/db/repos/hunter.repo"
import { putAnswerKey } from "@/lib/hunter/answer-cache"
import { writeAuditLog } from "@/lib/hunter/audit"
import { detectionsToHazards } from "@/lib/hunter/replay"
import { createPhotoSignedUrl, deletePhotoObjects } from "@/lib/hunter/storage"
import { parsePhotoId } from "@/lib/hunter/validation"
import { checkApiRateLimit, rateLimitedResponse } from "@/lib/upstash-rate-limiter"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
}

/**
 * GET /api/hunter/photo/[id] — きろくの再プレイ用データ
 *
 * - 認証必須。所有者以外は存在を漏らさず 404。
 * - 保存済みの検出結果を HunterHazard へ戻し、新しい sessionId を発行して正解鍵を
 *   サーバキャッシュへ置く(再解析なし = AI コスト 0・待ち 0 で「もういちど さがす」)。
 * - 画像は署名経路(/api/media/private)の URL だけを返す。キーそのものは露出しない。
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const actor = await getActor()
  if (actor.kind !== "user") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  // 1 リクエストごとに正解鍵(Redis, TTL 3h)と監査行を作るため、他の hunter API と同じ上限を掛ける。
  const rate = await checkApiRateLimit(`hunter-replay:${actor.id}`)
  if (!rate.success) return rateLimitedResponse(rate.reset)

  const { id: rawId } = await context.params
  const parsed = parsePhotoId(rawId)
  if (!parsed.ok || !parsed.id) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  let bundle: Awaited<ReturnType<typeof getHunterPhotoWithDetections>>
  try {
    bundle = await getHunterPhotoWithDetections(actor, parsed.id)
  } catch {
    bundle = null
  }
  if (!bundle) {
    return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 })
  }

  const sessionId = globalThis.crypto?.randomUUID?.() ?? `hunter-${Date.now()}`
  const hazards = detectionsToHazards(bundle.detections, sessionId)

  await putAnswerKey(sessionId, {
    hazards: hazards.map((h) => ({
      id: h.id,
      region: h.region,
      severity: h.severity,
      confidence: h.confidence,
    })),
    quiz: [],
  })
  await writeAuditLog(actor, "replay_photo", bundle.photo.id)

  const { photo } = bundle
  const hasPin = typeof photo.pinLat === "number" && typeof photo.pinLng === "number"
  return NextResponse.json({
    sessionId,
    photoId: photo.id,
    signedUrl: createPhotoSignedUrl(photo.imageKey),
    pin: hasPin ? { latitude: photo.pinLat, longitude: photo.pinLng } : null,
    capturedAt: photo.capturedAt,
    retentionUntil: photo.retentionUntil,
    hazards,
  })
}

/**
 * DELETE /api/hunter/photo/[id] — きけんハンター 写真の削除 (Phase 1)
 *
 * - 認証必須 (未認証は 401)。
 * - photoId は UUID 検証 (不正は 400)。
 * - 所有者検証はアプリ層でも実施: hunter_photos.player_id === auth.uid()。
 *   RLS 任せにせず、他人の写真は存在を漏らさないため 404 を返す。
 * - ストレージ配下 ({uid}/{photoId}/) のオブジェクトを削除し、行を削除。
 *   hazard_detections は ON DELETE CASCADE で連動削除される。
 * - 監査ログは best-effort (失敗しても本処理を止めない)。
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const actor = await getActor()
  if (actor.kind !== "user") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const { id: rawId } = await context.params
  const parsed = parsePhotoId(rawId)
  if (!parsed.ok || !parsed.id) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const photoId = parsed.id

  let photo
  try { photo = await getHunterPhoto(actor, photoId) } catch { photo = null }
  if (!photo) {
    return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 })
  }

  try {
    // 先にストレージ実体を消す (行だけ残るとオブジェクトが孤児化するため)。
    await deletePhotoObjects(actor.id, photoId)
    await deleteHunterPhoto(actor, photoId)
  } catch (error) {
    console.error("hunter/photo delete failed:", error)
    return NextResponse.json(
      { error: "写真の削除にしっぱいしました。もう一度ためしてね。" },
      { status: 500 },
    )
  }

  // 監査は best-effort。失敗しても 200 を返す。
  await writeAuditLog(actor, "delete_photo", photoId)

  return NextResponse.json({ ok: true }, { status: 200 })
}
