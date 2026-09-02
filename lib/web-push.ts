/**
 * Web Push 送信ユーティリティ
 *
 * VAPID認証済みプッシュ通知の送信と、期限切れサブスクリプションの自動削除を行う。
 * サーバー側 (Route Handler / Cron) からのみ利用可能。
 */

import webpush from 'web-push'
import { getServiceActor } from '@/lib/auth/service-actor'
import {
  deletePushSubscriptionById,
  listPushSubscriptions,
} from '@/lib/db/repos/push.repo'
import type { NotificationPreferences, PushPayload } from '@/lib/notifications/builders'

// VAPID設定
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@path-guardian.com'

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

const PUSH_SEND_CONCURRENCY = 50

async function sendInBatches(
  subs: readonly PushSubscriptionRow[],
  payload: PushPayload,
  preferenceKey: keyof NotificationPreferences,
): Promise<number> {
  let sent = 0
  for (let index = 0; index < subs.length; index += PUSH_SEND_CONCURRENCY) {
    const batch = subs.slice(index, index + PUSH_SEND_CONCURRENCY)
    const results = await Promise.all(batch.map(async (sub) => {
      const prefs = sub.notification_preferences ?? {}
      if (prefs[preferenceKey] === false) return 0
      const result = await sendPushNotification(sub, payload)
      return result.success ? 1 : 0
    }))
    sent += results.reduce((sum, value) => sum + value, 0)
  }
  return sent
}

function toPushSubscriptionRow(row: Awaited<ReturnType<typeof listPushSubscriptions>>[number]): PushSubscriptionRow {
  return {
    id: row.id,
    user_id: row.userId,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    notification_preferences: row.notificationPreferences as unknown as NotificationPreferences,
    last_notified_at: row.lastNotifiedAt,
    prefecture: row.prefecture,
  }
}

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
        await deletePushSubscriptionById(getServiceActor(), sub.id)
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
  const subs = (await listPushSubscriptions(getServiceActor(), { userId }))
    .map(toPushSubscriptionRow)

  return sendInBatches(subs, payload, preferenceKey)
}

/**
 * 全サブスクリプションをページネーションで取得する。
 * 都道府県別のグループ送信など、送信前に全体を分類したい場合に使う。
 */
export async function fetchAllPushSubscriptions(): Promise<PushSubscriptionRow[]> {
  return (await listPushSubscriptions(getServiceActor())).map(toPushSubscriptionRow)
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
  return sendInBatches(subs, payload, preferenceKey)
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
