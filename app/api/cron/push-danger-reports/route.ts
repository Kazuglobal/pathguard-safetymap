import { NextRequest, NextResponse } from 'next/server'
import { getServiceActor } from '@/lib/auth/service-actor'
import { listPendingDangerReportIds } from '@/lib/db/repos/push.repo'
import { dispatchDangerReportNotification } from '@/lib/push-notifications/notify-danger-report'
import { verifyCronSecret } from '@/lib/cron-auth'

// Cron: 過去20分の新規レポートを処理してプッシュ通知を送信する安全網
// wrangler.jsonc の Cron Trigger で */15 * * * * (15分毎) に設定

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req)
  if (authError) return authError

  const since = new Date(Date.now() - 20 * 60 * 1000).toISOString()
  const reports = await listPendingDangerReportIds(getServiceActor(), since)

  if (!reports || reports.length === 0) {
    return NextResponse.json({ processed: 0, notified: 0, failed: 0, skipped: 0 })
  }

  const results = await Promise.allSettled(
    reports.map(async (report) => {
      const dispatched = await dispatchDangerReportNotification({ reportId: report.id })
      if (dispatched.status !== 'notified') {
        return { notified: 0, skipped: 1 }
      }
      return { notified: dispatched.notified, skipped: 0 }
    })
  )

  const totalNotified = results.reduce((sum, result) => {
    return sum + (result.status === 'fulfilled' ? result.value.notified : 0)
  }, 0)
  const skipped = results.reduce((sum, result) => {
    return sum + (result.status === 'fulfilled' ? result.value.skipped : 0)
  }, 0)

  const failed = results.filter((r) => r.status === 'rejected').length
  if (failed > 0) {
    console.error(`[cron/push-danger-reports] ${failed} reports failed to notify`)
  }

  return NextResponse.json({
    processed: reports.length,
    notified: totalNotified,
    failed,
    skipped,
  })
}
