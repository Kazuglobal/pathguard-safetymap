/**
 * Cron: 地域安全アラートのプッシュ通知配信
 *
 * vercel.json で 0 *\/2 * * * (2時間毎) に設定。
 * local-alert-fetcher エージェントが local_safety_alerts へ INSERT した
 * 未通知レコードを処理してプッシュ通知を送信する。
 *
 * v3の通知疲れ対策:
 * - 静音時間帯（JST 22:00〜翌7:30）は個別配信せず、翌朝のダイジェスト
 *   （/api/cron/daily-news-digest）に集約する
 * - 同一都道府県で1サイクル3件以上の新規アラートは1通のまとめ通知に束ねる
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any

import { verifyCronSecret } from '@/lib/cron-auth'
import {
  claimLocalAlertForNotification,
  isWithinQuietHoursJst,
  notifyUsersForLocalAlert,
  notifyUsersForLocalAlertBatch,
  releaseLocalAlertNotificationClaim,
  shouldNotifyAlert,
} from '@/lib/push-notifications/notify-local-alert'

export const runtime = 'nodejs'
export const maxDuration = 60

/** 同一都道府県でこの件数以上ならまとめ通知に切り替える */
const BURST_THRESHOLD = 3

interface AlertRow {
  id: string
  prefecture: string
  category: string
}

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req)
  if (authError) return authError

  // 静音時間帯は未通知のまま残し、翌朝のダイジェストCronがクレームする
  if (isWithinQuietHoursJst()) {
    return NextResponse.json({
      processed: 0,
      notified: 0,
      failed: 0,
      skipped: 0,
      quietHours: true,
    })
  }

  // 過去24時間10分の未通知アラートを取得。
  // 静音時間帯（22:00〜7:30）分は通常、朝のダイジェストCronが push_notified_at を
  // 埋めてカバーするが、ダイジェストの失敗・スキップ時にもここで拾えるよう
  // 2時間ではなく24時間さかのぼる（クレーム済みは除外されるので二重通知はない）
  const since = new Date(Date.now() - (24 * 60 + 10) * 60 * 1000).toISOString()

  const { data: alerts, error } = await db()
    .from('local_safety_alerts')
    .select('id, prefecture, category')
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

  // 通知対象カテゴリのみ都道府県ごとにグループ化（対象外は未処理のまま=従来どおり）
  const groups = new Map<string, AlertRow[]>()
  let skipped = 0
  for (const alert of alerts as AlertRow[]) {
    if (!shouldNotifyAlert(alert.category)) {
      skipped += 1
      continue
    }
    groups.set(alert.prefecture, [...(groups.get(alert.prefecture) ?? []), alert])
  }

  let totalNotified = 0
  let failed = 0

  for (const [prefecture, group] of groups) {
    if (group.length >= BURST_THRESHOLD) {
      // バースト: 全件をクレームして1通のまとめ通知に束ねる。
      // クレーム途中の例外でもクレーム済み分を必ず解放する（孤児クレーム防止）
      const claims: Array<{ alertId: string; claimedAt: string }> = []
      try {
        for (const alert of group) {
          const claimed = await claimLocalAlertForNotification(alert.id)
          if (claimed.status === 'claimed') {
            claims.push({ alertId: claimed.alert.id, claimedAt: claimed.claimedAt })
          } else {
            skipped += 1
          }
        }
        if (claims.length === 0) continue

        totalNotified += await notifyUsersForLocalAlertBatch({
          prefecture,
          count: claims.length,
          latestAlertId: claims[claims.length - 1].alertId,
        })
      } catch (err) {
        failed += 1
        console.error(`[cron/local-safety-alerts] batch notify failed (${prefecture})`, err)
        await Promise.allSettled(
          claims.map((claim) => releaseLocalAlertNotificationClaim(claim))
        )
      }
      continue
    }

    // 通常: 従来どおり個別に通知する
    const results = await Promise.allSettled(
      group.map(async (alert) => {
        const claimed = await claimLocalAlertForNotification(alert.id)

        if (claimed.status !== 'claimed') {
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

    for (const result of results) {
      if (result.status === 'fulfilled') {
        totalNotified += result.value.notified
        skipped += result.value.skipped
      } else {
        failed += 1
      }
    }
  }

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
