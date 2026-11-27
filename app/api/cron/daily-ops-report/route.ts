import { getCloudflareContext } from '@opennextjs/cloudflare'
import { and, count, eq, gte, lt } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'

import { verifyCronSecret } from '@/lib/cron-auth'
import { getDb } from '@/lib/db/client'
import {
  apiBudgetSettings,
  apiUsageLogs,
  contactMessages,
  dangerReports,
  localSafetyAlerts,
  reportFlags,
} from '@/lib/db/schema'
import {
  buildDailyOpsReportMail,
  type BackupStatusSummary,
  type DailyOpsMetrics,
  type ProviderBudgetSummary,
} from '@/lib/email/daily-ops-report'
import { sendOperatorAlert, sendOperatorEmail } from '@/lib/email/operator-mail'

export const runtime = 'nodejs'
export const maxDuration = 60

const TRACKED_PROVIDERS = ['gemini', 'openai', 'mapbox', 'anthropic'] as const
const BACKUP_STALE_HOURS = 26

async function readLatestBackupStatus(now: Date): Promise<BackupStatusSummary> {
  try {
    const context = getCloudflareContext()
    const env = context.env as unknown as {
      BACKUPS?: {
        list(options?: { prefix?: string; limit?: number }): Promise<{
          objects: Array<{ key: string; size: number; uploaded: Date }>
        }>
      }
    }
    if (!env?.BACKUPS) {
      return { latestKey: null, sizeBytes: null, uploadedAt: null, stale: true }
    }
    const listed = await env.BACKUPS.list({ prefix: 'd1/', limit: 100 })
    const latest = listed.objects
      .slice()
      .sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime())[0]
    if (!latest) {
      return { latestKey: null, sizeBytes: null, uploadedAt: null, stale: true }
    }
    const ageMs = now.getTime() - latest.uploaded.getTime()
    return {
      latestKey: latest.key,
      sizeBytes: latest.size,
      uploadedAt: latest.uploaded.toISOString(),
      stale: ageMs > BACKUP_STALE_HOURS * 60 * 60 * 1000,
    }
  } catch (error) {
    console.error('[cron/daily-ops-report] failed to inspect BACKUPS bucket:', error)
    return { latestKey: null, sizeBytes: null, uploadedAt: null, stale: true }
  }
}

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req)
  if (authError) return authError

  const now = new Date()
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const yearMonth = now.toISOString().slice(0, 7)
  const [year, month] = yearMonth.split('-').map(Number)
  const monthStart = `${yearMonth}-01T00:00:00.000Z`
  const monthEndExclusive = new Date(Date.UTC(year, month, 1)).toISOString()

  const db = getDb()

  const [
    [newReportsRow],
    [pendingReportsRow],
    [failedModerationRow],
    [newAbuseRow],
    [newContactsRow],
    [failedContactsRow],
    [newAlertsRow],
    [failedApiCallsRow],
    monthlyUsageRows,
    budgetRows,
    backup,
  ] = await Promise.all([
    db.select({ value: count() }).from(dangerReports).where(gte(dangerReports.createdAt, since24h)),
    db.select({ value: count() }).from(dangerReports).where(eq(dangerReports.status, 'pending')),
    db.select({ value: count() }).from(dangerReports).where(eq(dangerReports.aiModerationStatus, 'failed')),
    db.select({ value: count() }).from(reportFlags).where(gte(reportFlags.createdAt, since24h)),
    db.select({ value: count() }).from(contactMessages).where(gte(contactMessages.createdAt, since24h)),
    db
      .select({ value: count() })
      .from(contactMessages)
      .where(and(gte(contactMessages.createdAt, since24h), eq(contactMessages.deliveryStatus, 'failed'))),
    db.select({ value: count() }).from(localSafetyAlerts).where(gte(localSafetyAlerts.createdAt, since24h)),
    db
      .select({ value: count() })
      .from(apiUsageLogs)
      .where(and(gte(apiUsageLogs.createdAt, since24h), eq(apiUsageLogs.success, false))),
    db
      .select({
        apiProvider: apiUsageLogs.apiProvider,
        estimatedCostUsd: apiUsageLogs.estimatedCostUsd,
        requestCount: apiUsageLogs.requestCount,
      })
      .from(apiUsageLogs)
      .where(and(gte(apiUsageLogs.createdAt, monthStart), lt(apiUsageLogs.createdAt, monthEndExclusive))),
    db.select().from(apiBudgetSettings).limit(100),
    readLatestBackupStatus(now),
  ])

  const providerTotals = new Map<string, { cost: number; requests: number }>()
  for (const row of monthlyUsageRows) {
    const current = providerTotals.get(row.apiProvider) ?? { cost: 0, requests: 0 }
    current.cost += row.estimatedCostUsd ?? 0
    current.requests += row.requestCount
    providerTotals.set(row.apiProvider, current)
  }

  const providers: ProviderBudgetSummary[] = TRACKED_PROVIDERS.map((provider) => {
    const totals = providerTotals.get(provider) ?? { cost: 0, requests: 0 }
    const budget = budgetRows.find((b) => b.apiProvider === provider)
    const monthlyBudgetUsd = budget?.monthlyBudgetUsd ?? 0
    const alertThresholdPercent = budget?.alertThresholdPercent ?? 80
    const usagePercent = monthlyBudgetUsd > 0 ? (totals.cost / monthlyBudgetUsd) * 100 : null
    const alert = usagePercent !== null && usagePercent >= alertThresholdPercent
    return {
      provider,
      totalCostUsd: totals.cost,
      requestCount: totals.requests,
      monthlyBudgetUsd,
      alertThresholdPercent,
      usagePercent,
      alert,
    }
  })

  const metrics: DailyOpsMetrics = {
    generatedAt: now.toISOString(),
    yearMonth,
    newDangerReports24h: newReportsRow?.value ?? 0,
    pendingModerationReports: pendingReportsRow?.value ?? 0,
    failedModerationReports: failedModerationRow?.value ?? 0,
    newAbuseReports24h: newAbuseRow?.value ?? 0,
    newContactMessages24h: newContactsRow?.value ?? 0,
    failedContactDeliveries24h: failedContactsRow?.value ?? 0,
    newLocalSafetyAlerts24h: newAlertsRow?.value ?? 0,
    failedApiCalls24h: failedApiCallsRow?.value ?? 0,
    providers,
    totalMonthlyCostUsd: providers.reduce((sum, p) => sum + p.totalCostUsd, 0),
    backup,
  }

  const reportMail = buildDailyOpsReportMail(metrics)
  const reportResult = await sendOperatorEmail({
    subject: reportMail.subject,
    text: reportMail.text,
  })

  let budgetAlertResult = null
  if (reportMail.budgetAlertProviders.length > 0) {
    budgetAlertResult = await sendOperatorAlert({
      category: 'api-budget',
      title: `APIコストが予算しきい値を超過しました (${reportMail.budgetAlertProviders.map((p) => p.provider).join(', ')})`,
      severity: 'warning',
      details: Object.fromEntries(
        reportMail.budgetAlertProviders.map((p) => [
          p.provider,
          `$${p.totalCostUsd.toFixed(2)} / $${p.monthlyBudgetUsd.toFixed(2)} (${p.usagePercent?.toFixed(1)}%, しきい値 ${p.alertThresholdPercent}%)`,
        ]),
      ),
    })
  }

  // The scheduled runner only checks response.ok, so a report or budget warning
  // that never reached the operator must surface as a non-2xx response.
  const reportDelivered = reportResult.status === 'sent'
  const budgetAlertDelivered = budgetAlertResult === null || budgetAlertResult.status === 'sent'
  const ok = reportDelivered && budgetAlertDelivered

  return NextResponse.json(
    {
      ok,
      reportDelivery: reportResult,
      budgetAlertDelivery: budgetAlertResult,
      hasWarnings: reportMail.hasWarnings,
      metrics,
    },
    { status: ok ? 200 : 502 },
  )
}
