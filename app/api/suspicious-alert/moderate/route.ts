import { NextRequest, NextResponse } from "next/server"

import { createServerClient } from "@/lib/supabase-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { SUSPICIOUS_DANGER_TYPE } from "@/lib/suspicious-alert"
import {
  buildModerationUpdate,
  moderateSuspiciousAlert,
} from "@/lib/suspicious-alert-moderation"

export const runtime = "nodejs"

interface ModerateRequestBody {
  reportId?: unknown
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  let body: ModerateRequestBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 })
  }

  const reportId = typeof body.reportId === "string" ? body.reportId : ""
  if (!reportId) {
    return NextResponse.json({ error: "reportId が必要です" }, { status: 400 })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const { data: report, error: fetchError } = await supabaseAdmin
    .from("danger_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle()

  if (fetchError) {
    console.error("suspicious moderation fetch failed:", fetchError)
    return NextResponse.json({ error: "審査対象の取得に失敗しました" }, { status: 500 })
  }

  if (!report) {
    return NextResponse.json({ error: "審査対象が見つかりません" }, { status: 404 })
  }

  if (report.user_id !== user.id) {
    return NextResponse.json({ error: "この報告を審査できません" }, { status: 403 })
  }

  if (report.danger_type !== SUSPICIOUS_DANGER_TYPE) {
    return NextResponse.json({ error: "不審者アラートではありません" }, { status: 400 })
  }

  const hasImage =
    Boolean(report.image_url) ||
    (Array.isArray(report.processed_image_urls) && report.processed_image_urls.length > 0)

  const verdict = moderateSuspiciousAlert({
    text: report.description ?? report.title,
    hasImage,
  })
  const update = buildModerationUpdate(verdict, new Date().toISOString())

  const { data: updatedReport, error: updateError } = await supabaseAdmin
    .from("danger_reports")
    .update(update)
    .eq("id", reportId)
    .select("*")
    .single()

  if (updateError) {
    console.error("suspicious moderation update failed:", updateError)
    return NextResponse.json({ error: "審査結果の保存に失敗しました" }, { status: 500 })
  }

  return NextResponse.json({
    verdict,
    update,
    report: updatedReport,
  })
}
