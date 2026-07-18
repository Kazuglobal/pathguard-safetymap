import type { SupabaseClient } from "@supabase/supabase-js"

import { calculateDistance } from "@/lib/ar-utils"
import type { Database } from "@/lib/database.types"
import type { DangerReport } from "@/lib/types"
import {
  buildDangerModerationUpdate,
  type DangerModerationStatus,
} from "@/lib/danger-report-moderation"
import {
  DANGER_MODERATION_PROMPT_VERSION,
  moderateDangerReportWithAi,
  type DangerModerationResult,
} from "@/lib/danger-report-moderation-ai"
import { collectDangerReportImageDataUrls } from "@/lib/danger-report-moderation-images"
import {
  buildEscalationPushPayload,
  buildModerationResultPushPayload,
} from "@/lib/notifications/builders"
import { sendPushToUser } from "@/lib/web-push"

export type DangerReportModerationMode = "off" | "shadow" | "live"

export type DangerReportModerationRecord = Pick<
  DangerReport,
  | "id"
  | "user_id"
  | "title"
  | "description"
  | "danger_type"
  | "danger_level"
  | "latitude"
  | "longitude"
  | "status"
> &
  Partial<DangerReport>

export const DANGER_REPORT_MODERATION_SELECT =
  "id,user_id,title,description,latitude,longitude,danger_type,danger_level,status,image_url,processed_image_url,processed_image_urls,prefecture,prefecture_code,city,municipality_code,town,postal_code,geocode_source,geocoded_at,geocode_confidence,address_hash,created_at,updated_at,alert_radius_m,ai_moderation_status"

export const MAX_DANGER_MODERATION_FALLBACKS = 3

export function getDangerModerationMode(
  value = process.env.DANGER_REPORT_AI_MODERATION_MODE,
): DangerReportModerationMode {
  return value === "shadow" || value === "live" ? value : "off"
}

export async function getDangerModerationFallbackCount(
  supabaseAdmin: SupabaseClient<Database>,
  reportId: string,
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("danger_report_moderation_log")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId)
    .eq("fallback", true)
    .eq("mode", "live")
    .eq("prompt_version", DANGER_MODERATION_PROMPT_VERSION)
  if (error) throw new Error("AI審査試行回数の取得に失敗しました")
  return count ?? 0
}

export async function markDangerReportModerationFailed(
  supabaseAdmin: SupabaseClient<Database>,
  reportId: string,
  now = new Date(),
): Promise<DangerReportModerationRecord | null> {
  const { data: updatedReport, error } = await supabaseAdmin
    .from("danger_reports")
    .update({
      ai_moderation_status: "needs_review",
      ai_moderation_reason:
        "AI審査が繰り返し失敗したため人間の確認に回します。",
      ai_moderation_score: 0.5,
      ai_moderation_checked_at: now.toISOString(),
    })
    .eq("id", reportId)
    .eq("status", "pending")
    .or(
      "ai_moderation_status.is.null,ai_moderation_status.eq.pending",
    )
    .select(DANGER_REPORT_MODERATION_SELECT)
    .maybeSingle()
  if (error) throw new Error("AI審査失敗状態の保存に失敗しました")
  if (!updatedReport) return null

  await notifyModerationResult(
    supabaseAdmin,
    updatedReport,
    "needs_review",
  )
  return updatedReport
}

export type ModerationServiceResult =
  | {
      outcome: "shadow"
      verdict: DangerModerationResult
      report: DangerReportModerationRecord
    }
  | {
      outcome: "retry"
      verdict: DangerModerationResult
      report: DangerReportModerationRecord
    }
  | {
      outcome: "updated"
      verdict: DangerModerationResult
      report: DangerReportModerationRecord
    }
  | {
      outcome: "conflict"
      verdict: DangerModerationResult
      report: null
    }

function hasImage(report: DangerReportModerationRecord): boolean {
  return (
    Boolean(report.image_url) ||
    (Array.isArray(report.processed_image_urls) &&
      report.processed_image_urls.length > 0)
  )
}

async function notifyModerationResult(
  supabaseAdmin: SupabaseClient<Database>,
  report: DangerReportModerationRecord,
  status: DangerModerationStatus,
): Promise<void> {
  try {
    await sendPushToUser(
      report.user_id,
      buildModerationResultPushPayload({
        reportId: report.id,
        verdictStatus: status,
      }),
      "danger_reports",
    )
  } catch (error) {
    console.error(
      "[danger-report/moderation] submitter push failed:",
      error,
    )
  }

  if (status !== "escalated") return

  const { data: admins, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
  if (error) {
    console.error("[danger-report/moderation] admin lookup failed:", error)
    return
  }

  await Promise.allSettled(
    (admins ?? []).map((admin: { id: string }) =>
      sendPushToUser(
        admin.id,
        buildEscalationPushPayload({ reportId: report.id }),
        "danger_reports",
      ),
    ),
  )
}

export async function moderateDangerReportRecord(params: {
  supabaseAdmin: SupabaseClient<Database>
  report: DangerReportModerationRecord
  mode: Exclude<DangerReportModerationMode, "off">
  now?: Date
}): Promise<ModerationServiceResult> {
  const { supabaseAdmin, report, mode } = params
  const now = params.now ?? new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString()

  const [
    { count: recentCount, error: recentError },
    { data: recentReports, error: nearbyError },
    { count: rejectedCount, error: rejectedError },
  ] = await Promise.all([
    supabaseAdmin
      .from("danger_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", report.user_id)
      .gte("created_at", oneHourAgo),
    supabaseAdmin
      .from("danger_reports")
      .select("id, latitude, longitude, created_at")
      .eq("user_id", report.user_id)
      .neq("id", report.id)
      .gte("created_at", oneDayAgo),
    supabaseAdmin
      .from("danger_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", report.user_id)
      .eq("status", "rejected")
      .gte("created_at", thirtyDaysAgo),
  ])

  if (recentError || nearbyError || rejectedError) {
    throw new Error("審査コンテキストの取得に失敗しました")
  }

  const nearbyDuplicateCount = (recentReports ?? []).filter(
    (candidate: { latitude: number; longitude: number }) =>
      Number.isFinite(candidate.latitude) &&
      Number.isFinite(candidate.longitude) &&
      calculateDistance(
        report.latitude,
        report.longitude,
        candidate.latitude,
        candidate.longitude,
      ) <= 50,
  ).length

  const reportHasImage = hasImage(report)
  const imageDataUrls = reportHasImage
    ? await collectDangerReportImageDataUrls(supabaseAdmin, report)
    : []

  const verdict = await moderateDangerReportWithAi({
    title: report.title ?? "",
    description: report.description ?? null,
    dangerType: report.danger_type ?? "other",
    dangerLevel: report.danger_level ?? 1,
    latitude: report.latitude,
    longitude: report.longitude,
    geocodeConfidence: report.geocode_confidence ?? null,
    prefecture: report.prefecture ?? null,
    city: report.city ?? null,
    hasImage: reportHasImage,
    recentReportsByUserLastHour: recentCount ?? 0,
    nearbyDuplicateCount,
    userRejectedCountLast30d: rejectedCount ?? 0,
    imageDataUrls,
  })

  const { error: logError } = await supabaseAdmin
    .from("danger_report_moderation_log")
    .insert({
      report_id: report.id,
      mode,
      heuristic_status: verdict.heuristicStatus,
      ai_verdict: verdict.aiVerdict,
      final_status: verdict.status,
      fallback: verdict.fallback,
      model: verdict.model,
      prompt_version: verdict.promptVersion,
      latency_ms: verdict.latencyMs,
    })
  if (logError) {
    throw new Error("審査監査ログの保存に失敗しました")
  }

  if (mode === "shadow") {
    return { outcome: "shadow", verdict, report }
  }

  // 一時的なAI障害では公開せずpendingのままにし、cronの有界リトライへ渡す。
  if (verdict.fallback) {
    return { outcome: "retry", verdict, report }
  }

  const update = buildDangerModerationUpdate(
    verdict,
    now.toISOString(),
  )
  let updateQuery = supabaseAdmin
    .from("danger_reports")
    .update(update)
    .eq("id", report.id)
    .eq("status", "pending")
    // AIが読んだ本文・判定コンテキストが審査中に差し替えられていないことを
    // 楽観ロックとして確認する。0行ならconflictとして次周期に再審査する。
    .eq("title", report.title)
    .eq("danger_type", report.danger_type)
    .eq("danger_level", report.danger_level)
    .eq("latitude", report.latitude)
    .eq("longitude", report.longitude)
    .or(
      "ai_moderation_status.is.null,ai_moderation_status.eq.pending",
    )

  updateQuery =
    report.description === null || report.description === undefined
      ? updateQuery.is("description", null)
      : updateQuery.eq("description", report.description)

  updateQuery =
    report.geocode_confidence === null ||
    report.geocode_confidence === undefined
      ? updateQuery.is("geocode_confidence", null)
      : updateQuery.eq("geocode_confidence", report.geocode_confidence)

  updateQuery =
    report.prefecture === null || report.prefecture === undefined
      ? updateQuery.is("prefecture", null)
      : updateQuery.eq("prefecture", report.prefecture)

  updateQuery =
    report.city === null || report.city === undefined
      ? updateQuery.is("city", null)
      : updateQuery.eq("city", report.city)

  if (update.status === "approved" && !reportHasImage) {
    updateQuery = updateQuery
      .is("image_url", null)
      .or(
        "processed_image_urls.is.null,processed_image_urls.eq.{}",
      )
  }

  const { data: updatedReport, error: updateError } = await updateQuery
    .select(DANGER_REPORT_MODERATION_SELECT)
    .maybeSingle()
  if (updateError) {
    throw new Error("審査結果の保存に失敗しました")
  }
  if (!updatedReport) {
    return { outcome: "conflict", verdict, report: null }
  }

  await notifyModerationResult(
    supabaseAdmin,
    updatedReport,
    verdict.status,
  )
  return { outcome: "updated", verdict, report: updatedReport }
}
