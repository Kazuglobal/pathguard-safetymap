/**
 * Web Push 送信ユーティリティ
 *
 * VAPID認証済みプッシュ通知の送信と、期限切れサブスクリプションの自動削除を行う。
 * サーバー側 (Route Handler / Cron) からのみ利用可能。
 */

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
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
}

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role credentials not configured')
  }
  return createClient(supabaseUrl, serviceRoleKey)
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
        const admin = getAdminClient()
        await admin
          .from('push_subscriptions')
          .delete()
          .eq('id', sub.id)
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
  const admin = getAdminClient()
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (error || !subs) return 0

  let count = 0
  await Promise.all(
    subs.map(async (sub: PushSubscriptionRow) => {
      const prefs = sub.notification_preferences ?? {}
      if (prefs[preferenceKey] === false) return
      const result = await sendPushNotification(sub, payload)
      if (result.success) count++
    })
  )
  return count
}

/**
 * 全ユーザーの全サブスクリプションにプッシュ通知を一斉送信する。
 * preferenceKey が false のサブスクリプションはスキップする。
 */
export async function broadcastPush(
  payload: PushPayload,
  preferenceKey: keyof NotificationPreferences
): Promise<number> {
  const admin = getAdminClient()

  // ページネーションで全件取得
  const PAGE_SIZE = 200
  let offset = 0
  let totalNotified = 0

  while (true) {
    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1)

    if (error || !subs || subs.length === 0) break

    const results = await Promise.all(
      subs.map(async (sub: PushSubscriptionRow) => {
        const prefs = sub.notification_preferences ?? {}
        if (prefs[preferenceKey] === false) return 0
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
