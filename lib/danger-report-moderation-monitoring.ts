import { buildModerationOperationalAlertPushPayload } from "@/lib/notifications/builders"
import { sendPushToUser } from "@/lib/web-push"

export interface DangerModerationOperationalMetrics {
  totalLast24h: number
  fallbackLast24h: number
  pendingUnmoderated: number
}

export type DangerModerationAlertReason =
  | "fallback_rate"
  | "pending_backlog"

export function getDangerModerationAlertReasons(
  metrics: DangerModerationOperationalMetrics,
): DangerModerationAlertReason[] {
  const reasons: DangerModerationAlertReason[] = []
  const fallbackRate =
    metrics.totalLast24h === 0
      ? 0
      : metrics.fallbackLast24h / metrics.totalLast24h

  if (fallbackRate > 0.3) reasons.push("fallback_rate")
  if (metrics.pendingUnmoderated > 50) reasons.push("pending_backlog")
  return reasons
}

export async function monitorDangerModerationOperations(
  supabaseAdmin: any,
  now = new Date(),
) {
  const since = new Date(
    now.getTime() - 24 * 60 * 60 * 1000,
  ).toISOString()
  const [
    { count: totalLast24h, error: totalError },
    { count: fallbackLast24h, error: fallbackError },
    { count: pendingUnmoderated, error: pendingError },
  ] = await Promise.all([
    supabaseAdmin
      .from("danger_report_moderation_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabaseAdmin
      .from("danger_report_moderation_log")
      .select("id", { count: "exact", head: true })
      .eq("fallback", true)
      .gte("created_at", since),
    supabaseAdmin
      .from("danger_reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .or(
        "ai_moderation_status.is.null,ai_moderation_status.eq.pending",
      ),
  ])

  if (totalError || fallbackError || pendingError) {
    throw new Error("AI審査の運用指標取得に失敗しました")
  }

  const metrics: DangerModerationOperationalMetrics = {
    totalLast24h: totalLast24h ?? 0,
    fallbackLast24h: fallbackLast24h ?? 0,
    pendingUnmoderated: pendingUnmoderated ?? 0,
  }
  const reasons = getDangerModerationAlertReasons(metrics)
  if (reasons.length === 0) {
    return { alerted: false, adminCount: 0, metrics, reasons }
  }

  const { data: admins, error: adminsError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
  if (adminsError) {
    throw new Error("AI審査の管理者通知先取得に失敗しました")
  }

  const fallbackRate =
    metrics.totalLast24h === 0
      ? 0
      : metrics.fallbackLast24h / metrics.totalLast24h
  const payload = buildModerationOperationalAlertPushPayload({
    reasons,
    fallbackRate,
    pendingUnmoderated: metrics.pendingUnmoderated,
  })
  await Promise.allSettled(
    (admins ?? []).map((admin: { id: string }) =>
      sendPushToUser(admin.id, payload, "danger_reports"),
    ),
  )

  return {
    alerted: (admins?.length ?? 0) > 0,
    adminCount: admins?.length ?? 0,
    metrics,
    reasons,
  }
}
