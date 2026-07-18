export type ModerationQueue =
  | "escalated"
  | "needs_review"
  | "approved"
  | "all"

export type AiModerationStatus =
  | "pending"
  | "approved"
  | "needs_review"
  | "escalated"
  | null

export interface AdminModerationReport {
  id: string
  title: string | null
  description: string | null
  danger_type: string | null
  danger_level: number | null
  status: string
  latitude: number | null
  longitude: number | null
  created_at: string
  profiles: { display_name: string | null } | null
  ai_moderation_status: AiModerationStatus
  ai_moderation_reason: string | null
  ai_moderation_score: number | null
  ai_moderation_checked_at: string | null
}

export function filterModerationQueue(
  reports: readonly AdminModerationReport[],
  queue: ModerationQueue,
): AdminModerationReport[] {
  if (queue === "all") return [...reports]
  return reports.filter(
    (report) => report.ai_moderation_status === queue,
  )
}

export function countModerationQueues(
  reports: readonly AdminModerationReport[],
): Record<ModerationQueue, number> {
  return {
    escalated: filterModerationQueue(reports, "escalated").length,
    needs_review: filterModerationQueue(reports, "needs_review").length,
    approved: filterModerationQueue(reports, "approved").length,
    all: reports.length,
  }
}

export function sampleApprovedReports(
  reports: readonly AdminModerationReport[],
  random: () => number = Math.random,
): AdminModerationReport[] {
  const approved = filterModerationQueue(reports, "approved")
  for (let index = approved.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1))
    ;[approved[index], approved[target]] = [
      approved[target],
      approved[index],
    ]
  }
  return approved.slice(0, 10)
}
