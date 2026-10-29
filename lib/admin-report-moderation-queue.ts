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

/**
 * scripts/ops/seed-demo-account.ts がデモ用サンプル報告に付ける AI審査理由。
 * サンプル報告は status='pending'・ai_moderation_status='needs_review' で入るため公開されず、
 * 5分ごとの審査スイープ(未審査 = NULL/'pending' だけを拾う)にも拾われない。
 */
export const DEMO_SAMPLE_MODERATION_REASON = "デモ用サンプル（公開しません）"

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
  /** 報告の写真(管理者は見られる)。無ければ null */
  image_url?: string | null
  /** 写真が端末でぼかした(加工済みの)ものか。false の写真はほかの人には出ていない */
  image_masked?: boolean
  /**
   * 投稿者がデモ・テストアカウント(lib/leaderboard-exclusions.ts の判定)か。
   * サーバー(lib/admin-reports-service.ts)が付ける。メールアドレス自体は画面に渡さない。
   */
  owner_excluded?: boolean
}

/**
 * 審査キューから隠すデモ用サンプルか。理由文だけでなく「投稿者がデモ・テストアカウント」も条件にする
 * (誤って実ユーザーへ流し込まれたサンプルは隠さず、管理者が気づけるようにする)。
 * 表示の整理だけで、公開状態や審査の判定には使わない。
 */
export function isDemoSampleReport(
  report: Pick<AdminModerationReport, "owner_excluded" | "ai_moderation_reason">,
): boolean {
  return (
    report.owner_excluded === true &&
    report.ai_moderation_reason === DEMO_SAMPLE_MODERATION_REASON
  )
}

export function filterModerationQueue(
  reports: readonly AdminModerationReport[],
  queue: ModerationQueue,
): AdminModerationReport[] {
  const reviewable = reports.filter((report) => !isDemoSampleReport(report))
  if (queue === "all") return reviewable
  return reviewable.filter(
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
    all: filterModerationQueue(reports, "all").length,
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
