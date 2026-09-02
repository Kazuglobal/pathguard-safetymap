import { NextRequest, NextResponse } from "next/server"

import { getActor } from "@/lib/auth/actor"
import { listHunterAttempts } from "@/lib/db/repos/gamification.repo"
import { listHunterPhotos } from "@/lib/db/repos/hunter.repo"
import { summarizeHunterPlays, type HunterPhotoPlays } from "@/lib/hunter/rewards"
import { createPhotoSignedUrl } from "@/lib/hunter/storage"
import { checkApiRateLimit, rateLimitedResponse } from "@/lib/upstash-rate-limiter"

export const runtime = "nodejs"

/**
 * GET /api/hunter/photos — 自分の保存済み写真の一覧 (Phase 1)
 *
 * - 認証必須。
 * - hunter_photos を自分の行だけ、新しい順に返す。
 * - 各行に短TTL署名URL(signedUrl)を付与して返す。公開URLは使わない。
 *   署名URL発行に失敗した行は signedUrl: null とし、一覧自体は返す (graceful degrade)。
 * - 各写真で遊んだ回数/いちばん多く みつけた数(plays)を attempts から付ける。
 *   attempts の取得に失敗しても一覧は返す(plays: null)。
 */
export async function GET(_request: NextRequest) {
  const actor = await getActor()
  if (actor.kind !== "user") {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const rate = await checkApiRateLimit(`hunter-photos:${actor.id}`)
  if (!rate.success) return rateLimitedResponse(rate.reset)

  let rows
  try {
    rows = await listHunterPhotos(actor)
  } catch (error) {
    console.error("hunter/photos list failed:", error instanceof Error ? error.message : "unknown")
    return NextResponse.json(
      { error: "写真の一覧取得にしっぱいしました。もう一度ためしてね。" },
      { status: 500 },
    )
  }

  let plays = new Map<string, HunterPhotoPlays>()
  try {
    plays = summarizeHunterPlays(await listHunterAttempts(actor, actor.id))
  } catch (error) {
    console.error("hunter/photos attempts lookup failed:", error instanceof Error ? error.message : "unknown")
  }

  const photos = rows.map(({ photo, detections }) => {
    const signedUrl = createPhotoSignedUrl(photo.imageKey)
    const { dangers, topSeverity } = summarizeDangers(detections)
    return {
      id: photo.id,
      pinLat: photo.pinLat,
      pinLng: photo.pinLng,
      capturedAt: photo.capturedAt,
      masked: photo.masked,
      retentionUntil: photo.retentionUntil,
      createdAt: photo.createdAt,
      signedUrl,
      // みつけた危険の種類(危険マップのチップ用)。重複は除く。
      dangers,
      topSeverity,
      plays: plays.get(photo.id) ?? null,
    }
  })

  return NextResponse.json({ photos }, { status: 200 })
}

const SEVERITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }

/**
 * hazard_detections の配列から、表示用の種類リスト(重複除去・最大4件)と最大 severity を作る。
 * severity は AI 出力のため未知値の可能性があるので、ランク表にない値は無視する。
 */
function summarizeDangers(
  detections: unknown,
): { dangers: string[]; topSeverity: string | null } {
  if (!Array.isArray(detections)) return { dangers: [], topSeverity: null }
  const seen = new Set<string>()
  const dangers: string[] = []
  let top: string | null = null
  for (const d of detections as Array<{ type?: string | null; severity?: string | null }>) {
    const type = typeof d?.type === "string" ? d.type.trim() : ""
    if (type && !seen.has(type) && dangers.length < 4) {
      seen.add(type)
      dangers.push(type)
    }
    const sev = typeof d?.severity === "string" ? d.severity : ""
    if (SEVERITY_RANK[sev] && (!top || SEVERITY_RANK[sev] > SEVERITY_RANK[top])) {
      top = sev
    }
  }
  return { dangers, topSeverity: top }
}
