/**
 * Cron: 地域安全アラートのプッシュ通知配信
 *
 * vercel.json で 0 *\/2 * * * (2時間毎) に設定。
 * local-alert-fetcher エージェントが local_safety_alerts へ INSERT した
 * 未通知レコードを処理してプッシュ通知を送信する。
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any

import { verifyCronSecret } from '@/lib/cron-auth'
import {
  claimLocalAlertForNotification,
  notifyUsersForLocalAlert,
  releaseLocalAlertNotificationClaim,
} from '@/lib/push-notifications/notify-local-alert'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req)
  if (authError) return authError

  // 過去2時間10分の未通知アラートを取得（10分バッファで取り漏らし防止）
  const since = new Date(Date.now() - 130 * 60 * 1000).toISOString()

  const { data: alerts, error } = await db()
    .from('local_safety_alerts')
    .select('id')
    .gte('created_at', since)
    .is('push_notified_at', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[cron/local-safety-alerts] fetch error', error)
    return NextResponse.json({ error: 'アラート取得に失敗しました' }, { status: 500 })
  }

  if (!alerts || alerts.length === 0) {
    return NextResponse.json({ processed: 0, notified: 0, failed: 0, skipped: 0 })
  }

  const results = await Promise.allSettled(
    alerts.map(async (alert: { id: string }) => {
      const claimed = await claimLocalAlertForNotification(alert.id)

      if (
        claimed.status === 'skip' ||
        claimed.status === 'already_claimed' ||
        claimed.status === 'not_found'
      ) {
        return { notified: 0, skipped: 1 }
      }

      try {
        const notified = await notifyUsersForLocalAlert(claimed.alert)
        return { notified, skipped: 0 }
      } catch (err) {
        // 通知失敗時はクレームを解放して次回 Cron で再試行できるようにする
        await releaseLocalAlertNotificationClaim({
          alertId: claimed.alert.id,
          claimedAt: claimed.claimedAt,
        })
        throw err
      }
    })
  )

  const totalNotified = results.reduce(
    (sum, r) => sum + (r.status === 'fulfilled' ? r.value.notified : 0),
    0
  )
  const skipped = results.reduce(
    (sum, r) => sum + (r.status === 'fulfilled' ? r.value.skipped : 0),
    0
  )
  const failed = results.filter((r) => r.status === 'rejected').length

  if (failed > 0) {
    console.error(`[cron/local-safety-alerts] ${failed} alerts failed to notify`)
  }

  return NextResponse.json({
    processed: alerts.length,
    notified: totalNotified,
    failed,
    skipped,
  })
}
