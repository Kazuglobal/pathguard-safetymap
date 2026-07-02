import { NextRequest, NextResponse } from "next/server"

import { createServerClient } from "@/lib/supabase-server"
import { createPhotoSignedUrl } from "@/lib/hunter/storage"

export const runtime = "nodejs"

/**
 * GET /api/hunter/photos — きけんハンター 自分の写真一覧 (Phase 1)
 *
 * - 認証必須 (未認証は 401)。
 * - player_id === auth.uid() の行のみ取得 (所有者スコープ)。
 * - 各 image_path に短TTLの署名URLを付けて返す。公開URLは使用しない。
 *   署名URL発行に失敗した行は signedUrl: null とし、一覧自体は返す (graceful degrade)。
 */
export async function GET(_request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const { data: rows, error: selectError } = await supabase
    .from("hunter_photos")
    .select(
      "id, image_path, pin_lat, pin_lng, captured_at, masked, retention_until, created_at, hazard_detections(type, kind, severity)",
    )
    .eq("player_id", user.id)
    .order("created_at", { ascending: false })
    // 署名URL発行回数の上限 (自己DoS防止)。直近 60 件のみ返す。
    .limit(60)

  if (selectError) {
    console.error("hunter/photos list failed:", selectError)
    return NextResponse.json(
      { error: "写真の一覧取得にしっぱいしました。もう一度ためしてね。" },
      { status: 500 },
    )
  }

  const list = rows ?? []

  const photos = await Promise.all(
    list.map(async (row: { image_path: string } & Record<string, unknown>) => {
      const signedUrl = row.image_path
        ? await createPhotoSignedUrl(supabase, row.image_path)
        : null
      const { dangers, topSeverity } = summarizeDangers(row.hazard_detections)
      return {
        id: row.id,
        pinLat: row.pin_lat,
        pinLng: row.pin_lng,
        capturedAt: row.captured_at,
        masked: row.masked,
        retentionUntil: row.retention_until,
        createdAt: row.created_at,
        signedUrl,
        // みつけた危険の種類(危険マップのチップ用)。重複は除く。
        dangers,
        topSeverity,
      }
    }),
  )

  return NextResponse.json({ photos }, { status: 200 })
}

const SEVERITY_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 }

/** 写真に紐づく hazard_detections を「種類リスト + 最大severity」へ集約する。 */
function summarizeDangers(
  raw: unknown,
): { dangers: string[]; topSeverity: string | null } {
  const detections = Array.isArray(raw)
    ? (raw as Array<{ type?: unknown; severity?: unknown }>)
    : []
  const dangers: string[] = []
  let topSeverity: string | null = null
  let topRank = 0
  for (const det of detections) {
    const type = typeof det?.type === "string" ? det.type : null
    if (type && !dangers.includes(type)) dangers.push(type)
    const sev = typeof det?.severity === "string" ? det.severity : null
    const rank = sev ? (SEVERITY_RANK[sev] ?? 0) : 0
    if (rank > topRank) {
      topRank = rank
      topSeverity = sev
    }
  }
  return { dangers: dangers.slice(0, 4), topSeverity }
}
