import { NextRequest, NextResponse } from "next/server"

import { verifyCronSecret } from "@/lib/cron-auth"
import { monitorDangerModerationOperations } from "@/lib/danger-report-moderation-monitoring"
import {
  getDangerModerationFallbackCount,
  getDangerModerationMode,
  markDangerReportModerationFailed,
  moderateDangerReportRecord,
} from "@/lib/danger-report-moderation-service"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const maxDuration = 300

const SWEEP_LIMIT = 10
const MIN_REPORT_AGE_MS = 2 * 60 * 1000
const MAX_FALLBACKS = 3

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const mode = getDangerModerationMode()
  if (mode === "off") {
    return NextResponse.json({
      mode,
      processed: 0,
      updated: 0,
      shadow: 0,
      exhausted: 0,
      failed: 0,
    })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const cutoff = new Date(Date.now() - MIN_REPORT_AGE_MS).toISOString()
  const { data: reports, error } = await supabaseAdmin
    .from("danger_reports")
    .select("*")
    .eq("status", "pending")
    .or(
      "ai_moderation_status.is.null,ai_moderation_status.eq.pending",
    )
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(SWEEP_LIMIT)

  if (error) {
    return NextResponse.json(
      { error: "審査待ちレポートの取得に失敗しました" },
      { status: 500 },
    )
  }

  let updated = 0
  let shadow = 0
  let exhausted = 0
  let failed = 0

  // Geminiレート制限とコストを有界化するため、意図的に直列処理する。
  for (const report of reports ?? []) {
    try {
      const fallbackCount = await getDangerModerationFallbackCount(
        supabaseAdmin,
        report.id,
      )
      if (fallbackCount >= MAX_FALLBACKS) {
        await markDangerReportModerationFailed(
          supabaseAdmin,
          report.id,
          new Date(),
        )
        exhausted += 1
        continue
      }

      const result = await moderateDangerReportRecord({
        supabaseAdmin,
        report,
        mode,
      })
      if (result.outcome === "updated") updated += 1
      if (result.outcome === "shadow") shadow += 1
    } catch (error) {
      failed += 1
      console.error(
        "[cron/moderation-sweep] report failed:",
        report.id,
        error instanceof Error ? error.message : "unknown error",
      )
    }
  }

  let monitoring
  try {
    monitoring = await monitorDangerModerationOperations(supabaseAdmin)
  } catch (error) {
    console.error(
      "[cron/moderation-sweep] monitoring failed:",
      error instanceof Error ? error.message : "unknown error",
    )
    monitoring = { error: true }
  }

  return NextResponse.json({
    mode,
    processed: reports?.length ?? 0,
    updated,
    shadow,
    exhausted,
    failed,
    monitoring,
  })
}
