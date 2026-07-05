/**
 * Cron: 朝のダイジェスト通知（毎朝7:30 JST・1日1通）
 *
 * vercel.json で 30 22 * * * (UTC 22:30 = JST 7:30) に設定。
 * 購読者を登録都道府県でグループ化し、「全国X件・{都道府県}でY件」の
 * 地域別文面を daily_digest プリファレンスの購読者へ配信する。
 * 地域未登録（prefecture が null）の購読者には全国文面を送る。
 * 0件の日も安心文面で送る（完了感・恐怖に頼らないリテンション設計）。
 *
 * 二重通知の防止: 送信後に、直近24時間の未通知 local_safety_alerts の
 * push_notified_at を埋める。夜間（静音時間帯）に発生したアラートは
 * このダイジェストがカバー済みとなり、直後のLayer 2 Cronが
 * 個別Pushを重ねて送る経路が構造的に消える。
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any

import { verifyCronSecret } from '@/lib/cron-auth'
import { fetchAllPushSubscriptions, sendPushToSubscriptions, type PushSubscriptionRow } from '@/lib/web-push'
import { buildDailyDigestPushPayload } from '@/lib/notifications/builders'
import { getTodaysDigest } from '@/lib/school-route-news'
import { isKnownRegion, NATIONWIDE } from '@/lib/user-region'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authError = verifyCronSecret(req)
  if (authError) return authError

  const now = new Date()
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  // 直近24時間の地域アラート（全体件数と都道府県別件数の両方に使う）
  const { data: alertRows, error: alertError } = await db()
    .from('local_safety_alerts')
    .select('prefecture')
    .gte('occurred_at', since)

  if (alertError) {
    console.error('[cron/daily-news-digest] alert fetch error', alertError)
    return NextResponse.json({ error: 'アラート集計に失敗しました' }, { status: 500 })
  }

  const alerts = (alertRows ?? []) as Array<{ prefecture: string | null }>
  const alertCount = alerts.length
  const alertCountByPrefecture = new Map<string, number>()
  for (const alert of alerts) {
    if (!alert.prefecture) continue
    alertCountByPrefecture.set(
      alert.prefecture,
      (alertCountByPrefecture.get(alert.prefecture) ?? 0) + 1
    )
  }

  // 購読者を登録都道府県でグループ化（未登録・不正値は全国グループ）
  const subs = await fetchAllPushSubscriptions()
  const subsByPrefecture = new Map<string, PushSubscriptionRow[]>()
  for (const sub of subs) {
    const prefecture =
      sub.prefecture && sub.prefecture !== NATIONWIDE && isKnownRegion(sub.prefecture)
        ? sub.prefecture
        : NATIONWIDE
    subsByPrefecture.set(prefecture, [...(subsByPrefecture.get(prefecture) ?? []), sub])
  }

  const digest = getTodaysDigest(NATIONWIDE, now)

  let notified = 0
  for (const [prefecture, group] of subsByPrefecture) {
    const payload = buildDailyDigestPushPayload({
      date: digest.date,
      newsCount: digest.nationalCount,
      alertCount,
      prefecture: prefecture === NATIONWIDE ? null : prefecture,
      localAlertCount:
        prefecture === NATIONWIDE ? undefined : (alertCountByPrefecture.get(prefecture) ?? 0),
    })
    notified += await sendPushToSubscriptions(group, payload, 'daily_digest')
  }

  // 送信「後」に夜間発生の未通知アラートをカバー済みにする（Layer 2との二重通知防止）。
  // 送信前に埋めると、送信失敗時にアラートが「通知済み扱いで未配信」のまま失われる。
  // 逆順なら最悪でも Layer 2 の24時間フォールバックが個別配信で拾う（重複はあり得るが欠落はない）
  const { data: covered, error: coverError } = await db()
    .from('local_safety_alerts')
    .update({ push_notified_at: now.toISOString() })
    .is('push_notified_at', null)
    .gte('created_at', since)
    .select('id')

  if (coverError) {
    console.error('[cron/daily-news-digest] cover overnight alerts error', coverError)
  }

  return NextResponse.json({
    notified,
    prefectureGroups: subsByPrefecture.size,
    newsCount: digest.nationalCount,
    alertCount,
    coveredAlerts: covered?.length ?? 0,
  })
}
