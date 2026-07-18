import { calculateDistance } from "@/lib/ar-utils"
import {
  buildDangerModerationUpdate,
  type DangerModerationStatus,
} from "@/lib/danger-report-moderation"
import {
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

export function getDangerModerationMode(
  value = process.env.DANGER_REPORT_AI_MODERATION_MODE,
): DangerReportModerationMode {
  return value === "shadow" || value === "live" ? value : "off"
}

export async function getDangerModerationFallbackCount(
  supabaseAdmin: any,
  reportId: string,
): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("danger_report_moderation_log")
    .select("id", { count: "exact", head: true })
    .eq("report_id", reportId)
    .eq("fallback", true)
  if (error) throw new Error("AI審査試行回数の取得に失敗しました")
  return count ?? 0
}

export async function markDangerReportModerationFailed(
  supabaseAdmin: any,
  reportId: string,
  now = new Date(),
): Promise<void> {
  const { error } = await supabaseAdmin
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
  if (error) throw new Error("AI審査失敗状態の保存に失敗しました")
}

export type ModerationServiceResult =
  | {
      outcome: "shadow"
      verdict: DangerModerationResult
      report: Record<string, unknown>
    }
  | {
      outcome: "updated"
      verdict: DangerModerationResult
      report: Record<string, unknown>
    }
  | {
      outcome: "conflict"
      verdict: DangerModerationResult
      report: null
    }

function hasImage(report: Record<string, any>): boolean {
  return (
    Boolean(report.image_url) ||
    (Array.isArray(report.processed_image_urls) &&
      report.processed_image_urls.length > 0)
  )
}

async function notifyModerationResult(
  supabaseAdmin: any,
  report: Record<string, any>,
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
  supabaseAdmin: any
  report: Record<string, any>
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

  const update = buildDangerModerationUpdate(
    verdict,
    now.toISOString(),
  )
  let updateQuery = supabaseAdmin
    .from("danger_reports")
    .update(update)
    .eq("id", report.id)
    .eq("status", "pending")
    .or(
      "ai_moderation_status.is.null,ai_moderation_status.eq.pending",
    )

  if (update.status === "approved" && !reportHasImage) {
    updateQuery = updateQuery
      .is("image_url", null)
      .or(
        "processed_image_urls.is.null,processed_image_urls.eq.{}",
      )
  }

  const { data: updatedReport, error: updateError } = await updateQuery
    .select("*")
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
