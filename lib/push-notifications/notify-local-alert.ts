/**
 * 地域安全アラートのプッシュ通知ロジック
 *
 * suspicious / voice_call カテゴリの新規アラートを
 * 購読ユーザー全員にブロードキャストする。
 * notify-danger-report.ts と同じ楽観的ロックパターンを採用。
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin'
// local_safety_alerts は database.types.ts に追加済みだが
// push_subscriptions が未反映のため any キャストを維持
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any

import { sendPushNotification } from '@/lib/web-push'
import {
  buildLocalAlertPushPayload,
  type LocalAlertCategory,
} from '@/lib/notifications/builders'
import type { PushSubscriptionRow } from '@/lib/web-push'

/** プッシュ通知を送る対象カテゴリ */
const PUSH_TARGET_CATEGORIES: LocalAlertCategory[] = ['suspicious', 'voice_call']

/** ページネーションサイズ */
const PAGE_SIZE = 200

export interface LocalAlertForNotification {
  id: string
  prefecture: string
  city: string | null
  category: LocalAlertCategory
  description: string
}

/**
 * カテゴリがプッシュ通知対象かどうかを判定する。
 */
export function shouldNotifyAlert(category: string): boolean {
  return PUSH_TARGET_CATEGORIES.includes(category as LocalAlertCategory)
}

export type LocalAlertClaimResult =
  | { status: 'claimed'; alert: LocalAlertForNotification; claimedAt: string }
  | { status: 'not_found' }
  | { status: 'already_claimed' }
  | { status: 'skip' }

/**
 * アラートを push_notified_at でアトミックにクレーム取得する。
 * 既に通知済みまたは通知不要カテゴリの場合はスキップを返す。
 */
export async function claimLocalAlertForNotification(
  alertId: string
): Promise<LocalAlertClaimResult> {
  const { data: existing } = await db()
    .from('local_safety_alerts')
    .select('id, prefecture, city, category, description, push_notified_at')
    .eq('id', alertId)
    .maybeSingle()

  if (!existing) return { status: 'not_found' }
  if (existing.push_notified_at) return { status: 'already_claimed' }
  if (!shouldNotifyAlert(existing.category)) return { status: 'skip' }

  const claimedAt = new Date().toISOString()

  const { data: claimed } = await db()
    .from('local_safety_alerts')
    .update({ push_notified_at: claimedAt })
    .eq('id', alertId)
    .is('push_notified_at', null)
    .select('id, prefecture, city, category, description')
    .maybeSingle()

  if (!claimed) return { status: 'already_claimed' }

  return {
    status: 'claimed',
    alert: claimed as LocalAlertForNotification,
    claimedAt,
  }
}

/**
 * 購読ユーザー全員にアラートのプッシュ通知を送信する。
 * local_alerts プリファレンスが false のサブスクリプションはスキップする。
 * 返り値は送信成功件数。
 */
export async function notifyUsersForLocalAlert(
  alert: LocalAlertForNotification
): Promise<number> {
  const payload = buildLocalAlertPushPayload({
    alertId: alert.id,
    category: alert.category,
    prefecture: alert.prefecture,
    city: alert.city,
    description: alert.description,
  })

  let offset = 0
  let totalNotified = 0

  while (true) {
    const { data: subs, error } = await db()
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth, notification_preferences, last_notified_at')
      .range(offset, offset + PAGE_SIZE - 1)

    if (error || !subs || subs.length === 0) break

    const results = await Promise.all(
      subs.map(async (sub: PushSubscriptionRow) => {
        const prefs = sub.notification_preferences ?? {}
        if (prefs['local_alerts'] === false) return 0
        const result = await sendPushNotification(sub, payload)
        return result.success ? 1 : 0
      })
    )

    totalNotified += results.reduce((a: number, b: number) => a + b, 0)
    if (subs.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return totalNotified
}
