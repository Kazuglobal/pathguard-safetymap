import { NextRequest, NextResponse } from "next/server"

import {
  getDangerModerationMode,
  moderateDangerReportRecord,
} from "@/lib/danger-report-moderation-service"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { createServerClient } from "@/lib/supabase-server"
import {
  checkApiRateLimit,
  rateLimitedResponse,
} from "@/lib/upstash-rate-limiter"

interface HandlerOptions {
  requiredDangerType?: string
  rateLimitPrefix?: string
}

export async function handleDangerReportModeration(
  request: NextRequest,
  options: HandlerOptions = {},
) {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
  }

  const rate = await checkApiRateLimit(
    `${options.rateLimitPrefix ?? "danger-moderate"}:${user.id}`,
  )
  if (!rate.success) return rateLimitedResponse(rate.reset)

  let body: { reportId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: "不正なリクエストです" },
      { status: 400 },
    )
  }
  const reportId =
    typeof body.reportId === "string" ? body.reportId : ""
  if (!reportId) {
    return NextResponse.json(
      { error: "reportId が必要です" },
      { status: 400 },
    )
  }

  const mode = getDangerModerationMode()
  if (mode === "off") {
    return NextResponse.json({ mode, skipped: true })
  }

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>
  try {
    supabaseAdmin = getSupabaseAdmin()
  } catch {
    return NextResponse.json(
      { error: "サーバ審査の設定が不足しています" },
      { status: 503 },
    )
  }

  const { data: report, error: fetchError } = await supabaseAdmin
    .from("danger_reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle()
  if (fetchError) {
    return NextResponse.json(
      { error: "審査対象の取得に失敗しました" },
      { status: 500 },
    )
  }
  if (!report) {
    return NextResponse.json(
      { error: "審査対象が見つかりません" },
      { status: 404 },
    )
  }

  if (
    options.requiredDangerType &&
    report.danger_type !== options.requiredDangerType
  ) {
    return NextResponse.json(
      { error: "対象の危険種別ではありません" },
      { status: 400 },
    )
  }

  if (report.user_id !== user.id) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle()
    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "この報告を審査できません" },
        { status: 403 },
      )
    }
  }

  if (
    report.ai_moderation_status &&
    report.ai_moderation_status !== "pending"
  ) {
    return NextResponse.json(
      { error: "この報告はすでに審査済みです", report },
      { status: 409 },
    )
  }

  try {
    const result = await moderateDangerReportRecord({
      supabaseAdmin,
      report,
      mode,
    })
    if (result.outcome === "conflict") {
      return NextResponse.json(
        { error: "この報告はすでに処理済みです" },
        { status: 409 },
      )
    }
    return NextResponse.json({
      mode,
      verdict: result.verdict,
      report: result.report,
    })
  } catch (error) {
    console.error(
      "[danger-report/moderate] failed:",
      error instanceof Error ? error.message : "unknown error",
    )
    return NextResponse.json(
      { error: "AI一次審査に失敗しました" },
      { status: 500 },
    )
  }
}
