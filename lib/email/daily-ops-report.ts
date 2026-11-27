export interface ProviderBudgetSummary {
  provider: string
  totalCostUsd: number
  requestCount: number
  monthlyBudgetUsd: number
  alertThresholdPercent: number
  usagePercent: number | null
  alert: boolean
}

export interface BackupStatusSummary {
  latestKey: string | null
  sizeBytes: number | null
  uploadedAt: string | null
  stale: boolean
}

export interface DailyOpsMetrics {
  generatedAt: string
  yearMonth: string
  newDangerReports24h: number
  pendingModerationReports: number
  failedModerationReports: number
  newAbuseReports24h: number
  newContactMessages24h: number
  failedContactDeliveries24h: number
  newLocalSafetyAlerts24h: number
  failedApiCalls24h: number
  providers: ProviderBudgetSummary[]
  totalMonthlyCostUsd: number
  backup: BackupStatusSummary
}

export function buildDailyOpsReportMail(metrics: DailyOpsMetrics): {
  subject: string
  text: string
  hasWarnings: boolean
  budgetAlertProviders: ProviderBudgetSummary[]
} {
  const jstDate = new Date(new Date(metrics.generatedAt).getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const budgetAlertProviders = metrics.providers.filter((p) => p.alert)
  const warnings: string[] = []

  if (metrics.failedModerationReports > 0) {
    warnings.push(`AIモデレーション失敗の報告が ${metrics.failedModerationReports} 件あります`)
  }
  if (metrics.failedContactDeliveries24h > 0) {
    warnings.push(`直近24時間のお問い合わせ転送失敗が ${metrics.failedContactDeliveries24h} 件あります`)
  }
  if (metrics.newAbuseReports24h > 0) {
    warnings.push(`直近24時間に不適切投稿の通報が ${metrics.newAbuseReports24h} 件届いています`)
  }
  if (metrics.failedApiCalls24h > 0) {
    warnings.push(`直近24時間の外部APIエラーが ${metrics.failedApiCalls24h} 件あります`)
  }
  if (metrics.backup.stale) {
    warnings.push('D1 日次バックアップが26時間以上更新されていません')
  }
  for (const p of budgetAlertProviders) {
    warnings.push(
      `APIコスト予算超過警告 (${p.provider}): $${p.totalCostUsd.toFixed(2)} / $${p.monthlyBudgetUsd.toFixed(2)} (${p.usagePercent?.toFixed(1)}%, しきい値 ${p.alertThresholdPercent}%)`,
    )
  }

  const hasWarnings = warnings.length > 0
  const subject = hasWarnings
    ? `【PathGuardian 日次レポート・要確認(${warnings.length}件)】${jstDate}`
    : `【PathGuardian 日次レポート】${jstDate}（異常なし）`

  const backupLine = metrics.backup.latestKey
    ? `${metrics.backup.latestKey} (${((metrics.backup.sizeBytes ?? 0) / 1024).toFixed(1)} KiB, ${metrics.backup.uploadedAt ?? '不明'})${metrics.backup.stale ? ' [遅延警告]' : ''}`
    : 'バックアップが見つかりません [警告]'

  const providerLines = metrics.providers.map((p) => {
    const budgetPart =
      p.monthlyBudgetUsd > 0
        ? ` / 予算 $${p.monthlyBudgetUsd.toFixed(2)} (${p.usagePercent?.toFixed(1)}%)`
        : ' / 予算未設定'
    const flag = p.alert ? ' [しきい値超過]' : ''
    return `- ${p.provider}: $${p.totalCostUsd.toFixed(4)} (${p.requestCount} req)${budgetPart}${flag}`
  })

  const lines = [
    `PathGuardian 日次運営レポート (${jstDate} JST)`,
    `集計時刻(UTC): ${metrics.generatedAt}`,
    '',
    ...(hasWarnings ? ['=== 要確認事項 ===', ...warnings.map((w) => `! ${w}`), ''] : []),
    '=== 直近24時間のアクティビティ ===',
    `- 新規危険報告: ${metrics.newDangerReports24h} 件`,
    `- 公開承認・モデレーション待ち合計: ${metrics.pendingModerationReports} 件`,
    `- AIモデレーション失敗中: ${metrics.failedModerationReports} 件`,
    `- 不適切投稿の通報: ${metrics.newAbuseReports24h} 件`,
    `- お問い合わせ受信: ${metrics.newContactMessages24h} 件（転送失敗: ${metrics.failedContactDeliveries24h} 件）`,
    `- 地域安全アラート取得: ${metrics.newLocalSafetyAlerts24h} 件`,
    `- 外部APIエラー: ${metrics.failedApiCalls24h} 件`,
    '',
    `=== 当月APIコスト (${metrics.yearMonth}) ===`,
    `- 合計: $${metrics.totalMonthlyCostUsd.toFixed(4)}`,
    ...providerLines,
    '',
    '=== D1 バックアップ状態 ===',
    `- 最新: ${backupLine}`,
    '',
    '管理画面: https://path-guardian.com/admin',
  ]

  return {
    subject,
    text: lines.join('\n'),
    hasWarnings,
    budgetAlertProviders,
  }
}
