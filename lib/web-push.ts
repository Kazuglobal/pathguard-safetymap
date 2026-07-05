/**
 * Web Push 送信ユーティリティ
 *
 * VAPID認証済みプッシュ通知の送信と、期限切れサブスクリプションの自動削除を行う。
 * サーバー側 (Route Handler / Cron) からのみ利用可能。
 */

import webpush from 'web-push'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { NotificationPreferences, PushPayload } from '@/lib/notifications/builders'

// VAPID設定
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@pathguardian.jp'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  notification_preferences: NotificationPreferences
  last_notified_at: string | null
  /** 通知の地域出し分け用（47都道府県の正式名称）。null/未設定は全国文面 */
  prefecture?: string | null
}

// push_subscriptions テーブルは生成型未反映のため any キャスト
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any

/**
 * 単一サブスクリプションにプッシュ通知を送信する。
 * 410/404レスポンス (期限切れ) の場合はDBから自動削除する。
 */
export async function sendPushNotification(
  sub: PushSubscriptionRow,
  payload: PushPayload
): Promise<{ success: boolean; removed?: boolean }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[web-push] VAPID keys not configured, skipping push')
    return { success: false }
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      JSON.stringify(payload)
    )
    return { success: true }
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode
    if (status === 410 || status === 404) {
      // サブスクリプション期限切れ → 削除
      try {
        await db().from('push_subscriptions').delete().eq('id', sub.id)
      } catch (deleteErr) {
        console.error('[web-push] Failed to delete expired subscription', deleteErr)
      }
      return { success: false, removed: true }
    }
    console.error('[web-push] sendNotification error', err)
    return { success: false }
  }
}

/**
 * 指定ユーザーの全サブスクリプションにプッシュ通知を送信する。
 * preferenceKey が false のサブスクリプションはスキップする。
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  preferenceKey: keyof NotificationPreferences
): Promise<number> {
  const { data: subs, error } = await db()
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (error || !subs) return 0

  const results = await Promise.all(
    subs.map(async (sub: PushSubscriptionRow) => {
      const prefs = sub.notification_preferences ?? {}
      if (prefs[preferenceKey] === false) return 0
      const result = await sendPushNotification(sub, payload)
      return result.success ? 1 : 0
    })
  )
  return results.reduce((a: number, b: number) => a + b, 0)
}

/**
 * 全サブスクリプションをページネーションで取得する。
 * 都道府県別のグループ送信など、送信前に全体を分類したい場合に使う。
 */
export async function fetchAllPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  const PAGE_SIZE = 200
  let offset = 0
  const all: PushSubscriptionRow[] = []

  while (true) {
    const { data: subs, error } = await db()
      .from('push_subscriptions')
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      console.error('[web-push] Failed to fetch push subscriptions', error)
      throw error
    }
    if (!subs || subs.length === 0) break

    all.push(...(subs as PushSubscriptionRow[]))

    if (subs.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}

/**
 * 指定したサブスクリプション群にプッシュ通知を送信する。
 * preferenceKey が false のサブスクリプションはスキップする。
 * 返り値は送信成功件数。
 */
export async function sendPushToSubscriptions(
  subs: readonly PushSubscriptionRow[],
  payload: PushPayload,
  preferenceKey: keyof NotificationPreferences
): Promise<number> {
  const results = await Promise.all(
    subs.map(async (sub) => {
      const prefs = sub.notification_preferences ?? {}
      if (prefs[preferenceKey] === false) return 0
      const result = await sendPushNotification(sub, payload)
      return result.success ? 1 : 0
    })
  )
  return results.reduce((a, b) => a + b, 0)
}

/**
 * 全ユーザーの全サブスクリプションにプッシュ通知を一斉送信する。
 * preferenceKey が false のサブスクリプションはスキップする。
 */
export async function broadcastPush(
  payload: PushPayload,
  preferenceKey: keyof NotificationPreferences
): Promise<number> {
  const subs = await fetchAllPushSubscriptions()
  return sendPushToSubscriptions(subs, payload, preferenceKey)
}
