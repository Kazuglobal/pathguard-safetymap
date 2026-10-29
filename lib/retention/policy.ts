/**
 * データの保持期間(UIUX改装 項目60)。毎日 19:00 UTC の /api/cron/retention-cleanup で消す。
 * プライバシーポリシーの保持期間の表(app/privacy/page.tsx)はこの値から作り、削除の処理(/api/cron/retention-cleanup・
 * きけんハンターの写真の期限 /api/hunter/analyze)もこの値を使う(tests/unit/lib/retention-policy.test.ts が確かめる)。
 *
 * | データ | 保持 |
 * |---|---|
 * | 非公開のまま(審査待ち・却下)の報告と写真 | 作成から90日 |
 * | 公開中の報告・写真・コメント | 公開(承認)から2年。解決済みは解決から90日 |
 * | 通学路・お子さま | 退会まで(両端は保存しない) |
 * | 通知の購読 | 配信に失敗したらすぐ。180日、更新も配信もなければ |
 * | きけんハンターの写真 | 90日(/api/cron/hunter-retention-cleanup) |
 * | 報告の作成の記録(連続投稿の制限用) | 30日 |
 * | D1 のバックアップ(R2) | 30日 |
 */
export const RETENTION_DAYS = {
  unpublishedReport: 90,
  publishedReport: 730,
  resolvedReport: 90,
  staleSubscription: 180,
  hunterPhoto: 90,
  reportCreateHistory: 30,
  backup: 30,
} as const

/** 1回の実行で消す報告の上限(Worker の処理時間とサブリクエストの上限に収めるため。残りは次の日) */
export const RETENTION_REPORT_BATCH = 200

const DAY_MS = 24 * 60 * 60 * 1000

/** now から days 日前の ISO 時刻 */
export function retentionCutoff(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString()
}

/** バックアップのキー(d1/YYYY-MM-DD.sql.gz)の日付が、保持期間を過ぎたか */
export function isExpiredBackupKey(key: string, now: Date): boolean {
  const date = key.match(/^d1\/(\d{4}-\d{2}-\d{2})\.sql\.gz$/)?.[1]
  if (!date) return false
  return `${date}T00:00:00.000Z` < retentionCutoff(now, RETENTION_DAYS.backup)
}
