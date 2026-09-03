import { type NextRequest, NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { toDangerReportJson } from '@/lib/danger-report-api'
import {
  MAX_DANGER_MODERATION_FALLBACKS,
  getDangerModerationFallbackCount,
  getDangerModerationMode,
  getModerationReport,
  markDangerReportModerationFailed,
  moderateDangerReportRecord,
  type DangerReportRow,
} from '@/lib/danger-report-moderation-d1'
import { AuthzError } from '@/lib/db/authz'
import { isDangerReportNotificationReady } from '@/lib/db/repos/push.repo'
import { queueDangerReportNotification } from '@/lib/push-notifications/notify-danger-report'
import { checkApiRateLimit, rateLimitedResponse } from '@/lib/upstash-rate-limiter'

interface HandlerOptions {
  requiredDangerType?: string
  rateLimitPrefix?: string
}

function reportForClient(report: DangerReportRow) {
  const {
    ai_moderation_reason: _reason,
    ai_moderation_score: _score,
    ai_moderation_checked_at: _checkedAt,
    ...safeReport
  } = toDangerReportJson(report)
  return safeReport
}

export async function handleDangerReportModeration(
  request: NextRequest,
  options: HandlerOptions = {},
) {
  const actor = await getActor()
  if (actor.kind !== 'user') {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const rate = await checkApiRateLimit(`${options.rateLimitPrefix ?? 'danger-moderate'}:${actor.id}`)
  if (!rate.success) return rateLimitedResponse(rate.reset)

  let body: { reportId?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 })
  }
  const reportId = typeof body.reportId === 'string' ? body.reportId : ''
  if (!reportId || reportId.length > 128) {
    return NextResponse.json({ error: 'reportId が必要です' }, { status: 400 })
  }

  const mode = getDangerModerationMode()
  if (mode === 'off') return NextResponse.json({ mode, skipped: true })

  try {
    const report = await getModerationReport(actor, reportId)
    if (!report) return NextResponse.json({ error: '審査対象が見つかりません' }, { status: 404 })
    if (options.requiredDangerType && report.dangerType !== options.requiredDangerType) {
      return NextResponse.json({ error: '対象の危険種別ではありません' }, { status: 400 })
    }
    if (report.userId !== actor.id && !actor.isAdmin) {
      return NextResponse.json({ error: 'この報告を審査できません' }, { status: 403 })
    }
    if (report.aiModerationStatus && report.aiModerationStatus !== 'pending') {
      return NextResponse.json({
        error: 'この報告はすでに審査済みです',
        report: reportForClient(report),
      }, { status: 409 })
    }

    if (mode === 'live') {
      const fallbackCount = await getDangerModerationFallbackCount(report.id)
      if (fallbackCount >= MAX_DANGER_MODERATION_FALLBACKS) {
        const failedReport = await markDangerReportModerationFailed(report.id, new Date())
        if (!failedReport) return NextResponse.json({ error: 'この報告はすでに処理済みです' }, { status: 409 })
        return NextResponse.json({ mode, pending: true, report: reportForClient(failedReport) }, { status: 202 })
      }
    }

    const result = await moderateDangerReportRecord(report, mode)
    if (result.outcome === 'conflict') {
      return NextResponse.json({ error: 'この報告はすでに処理済みです' }, { status: 409 })
    }
    if (result.outcome === 'retry') {
      return NextResponse.json({
        mode,
        pending: true,
        verdict: { status: result.verdict.status },
        report: reportForClient(result.report),
      }, { status: 202 })
    }
    if (result.outcome === 'updated' && isDangerReportNotificationReady(result.report)) {
      queueDangerReportNotification({ reportId: result.report.id })
    }
    return NextResponse.json({
      mode,
      verdict: { status: result.verdict.status },
      report: reportForClient(result.report),
    })
  } catch (error) {
    if (error instanceof AuthzError) return NextResponse.json({ error: 'この報告を審査できません' }, { status: 403 })
    console.error('[danger-report/moderate] failed:', error instanceof Error ? error.message : 'unknown')
    return NextResponse.json({ error: 'AI一次審査に失敗しました' }, { status: 500 })
  }
}
