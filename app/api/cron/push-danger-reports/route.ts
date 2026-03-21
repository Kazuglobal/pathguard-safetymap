import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any
import {
  claimDangerReportForNotification,
  notifyUsersNearReport,
  releaseDangerReportNotificationClaim,
} from '@/lib/push-notifications/notify-danger-report'
import { verifyCronSecret } from '@/lib/cron-auth'

// Cron: 過去20分の新規レポートを処理してプッシュ通知を送信する安全網
// vercel.json で */15 * * * * (15分毎) に設定

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req)
  if (authError) return authError

  const since = new Date(Date.now() - 20 * 60 * 1000).toISOString()
  const { data: reports, error } = await db()
    .from('danger_reports')
    .select('id')
    .gte('created_at', since)
    .is('push_notified_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[cron/push-danger-reports] fetch error', error)
    return NextResponse.json({ error: 'レポート取得に失敗しました' }, { status: 500 })
  }

  if (!reports || reports.length === 0) {
    return NextResponse.json({ processed: 0, notified: 0, failed: 0, skipped: 0 })
  }

  const results = await Promise.allSettled(
    reports.map(async (report: { id: string }) => {
      const claimed = await claimDangerReportForNotification({ reportId: report.id })

      if (claimed.status !== 'claimed') {
        return { notified: 0, skipped: 1 }
      }

      try {
        const notified = await notifyUsersNearReport(claimed.report)
        return { notified, skipped: 0 }
      } catch (error) {
        await releaseDangerReportNotificationClaim({
          reportId: claimed.report.id,
          claimedAt: claimed.claimedAt,
        })
        console.error('[cron/push-danger-reports] notify error for report', claimed.report.id, error)
        throw error
      }
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
