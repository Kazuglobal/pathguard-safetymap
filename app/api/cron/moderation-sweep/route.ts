import { NextRequest, NextResponse } from "next/server"

import { verifyCronSecret } from "@/lib/cron-auth"
import { DANGER_MODERATION_PROMPT_VERSION } from "@/lib/danger-report-moderation-ai"
import { hasModerationSweepTimeRemaining } from "@/lib/danger-report-moderation-sweep"
import { monitorDangerModerationOperations } from "@/lib/danger-report-moderation-monitoring"
import {
  MAX_DANGER_MODERATION_FALLBACKS,
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
      conflict: 0,
      retry: 0,
      exhausted: 0,
      failed: 0,
      deferred: 0,
    })
  }

  const supabaseAdmin = getSupabaseAdmin()
  const sweepStartedAt = Date.now()
  const cutoff = new Date(Date.now() - MIN_REPORT_AGE_MS).toISOString()
  const { data: reports, error } = await supabaseAdmin.rpc(
    "get_danger_reports_for_moderation_sweep",
    {
      p_mode: mode,
      p_prompt_version: DANGER_MODERATION_PROMPT_VERSION,
      p_cutoff: cutoff,
      p_limit: SWEEP_LIMIT,
    },
  )

  if (error) {
    return NextResponse.json(
      { error: "審査待ちレポートの取得に失敗しました" },
      { status: 500 },
    )
  }

  let updated = 0
  let shadow = 0
  let conflict = 0
  let retry = 0
  let exhausted = 0
  let failed = 0
  let processed = 0
  let deferred = 0

  // Geminiレート制限とコストを有界化するため、意図的に直列処理する。
  for (const report of reports ?? []) {
    if (!hasModerationSweepTimeRemaining(sweepStartedAt)) {
      deferred = (reports?.length ?? 0) - processed
      break
    }
    processed += 1

    try {
      if (mode === "live") {
        const fallbackCount = await getDangerModerationFallbackCount(
          supabaseAdmin,
          report.id,
        )
        if (fallbackCount >= MAX_DANGER_MODERATION_FALLBACKS) {
          const failedReport = await markDangerReportModerationFailed(
            supabaseAdmin,
            report.id,
            new Date(),
          )
          if (failedReport) {
            exhausted += 1
          } else {
            conflict += 1
          }
          continue
        }
      }

      const result = await moderateDangerReportRecord({
        supabaseAdmin,
        report,
        mode,
      })
      if (result.outcome === "updated") updated += 1
      if (result.outcome === "shadow") shadow += 1
      if (result.outcome === "conflict") conflict += 1
      if (result.outcome === "retry") retry += 1
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
    processed,
    updated,
    shadow,
    conflict,
    retry,
    exhausted,
    failed,
    deferred,
    monitoring,
  })
}
