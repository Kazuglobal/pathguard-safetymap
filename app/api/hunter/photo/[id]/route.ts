import { NextRequest, NextResponse } from "next/server"

import { createServerClient } from "@/lib/supabase-server"
import { writeAuditLog } from "@/lib/hunter/audit"
import { deletePhotoObjects } from "@/lib/hunter/storage"
import { parsePhotoId } from "@/lib/hunter/validation"

export const runtime = "nodejs"

interface RouteContext {
  params: Promise<{ id: string }>
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
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const { id: rawId } = await context.params
  const parsed = parsePhotoId(rawId)
  if (!parsed.ok || !parsed.id) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const photoId = parsed.id

  // 行を取得して所有者をアプリ層で検証する (RLS と二重防御)。
  const { data: photo, error: selectError } = await supabase
    .from("hunter_photos")
    .select("id, player_id")
    .eq("id", photoId)
    .maybeSingle()

  if (selectError) {
    console.error("hunter/photo delete select failed:", selectError)
    return NextResponse.json(
      { error: "写真の取得にしっぱいしました。もう一度ためしてね。" },
      { status: 500 },
    )
  }

  // 存在しない、または他人の写真は存在を漏らさず 404。
  if (!photo || photo.player_id !== user.id) {
    return NextResponse.json({ error: "写真が見つかりません" }, { status: 404 })
  }

  try {
    // 先にストレージ実体を消す (行だけ残るとオブジェクトが孤児化するため)。
    await deletePhotoObjects(supabase, user.id, photoId)

    const { error: deleteError } = await supabase
      .from("hunter_photos")
      .delete()
      .eq("id", photoId)
      .eq("player_id", user.id)

    if (deleteError) {
      throw new Error(deleteError.message)
    }
  } catch (error) {
    console.error("hunter/photo delete failed:", error)
    return NextResponse.json(
      { error: "写真の削除にしっぱいしました。もう一度ためしてね。" },
      { status: 500 },
    )
  }

  // 監査は best-effort。失敗しても 200 を返す。
  await writeAuditLog(supabase, user.id, "delete_photo", photoId)

  return NextResponse.json({ ok: true }, { status: 200 })
}
