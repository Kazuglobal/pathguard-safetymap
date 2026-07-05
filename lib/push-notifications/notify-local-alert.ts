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

import { broadcastPush } from '@/lib/web-push'
import {
  buildLocalAlertBatchPushPayload,
  buildLocalAlertPushPayload,
  type LocalAlertCategory,
} from '@/lib/notifications/builders'

/** プッシュ通知を送る対象カテゴリ */
const PUSH_TARGET_CATEGORIES: LocalAlertCategory[] = ['suspicious', 'voice_call']

const JST_OFFSET_MS = 9 * 60 * 60 * 1000

/**
 * 静音時間帯（JST 22:00〜翌7:30）かどうかを判定する。
 * この時間帯の個別Pushは行わず、翌朝のダイジェスト通知に集約する。
 */
export function isWithinQuietHoursJst(now: Date = new Date()): boolean {
  const jst = new Date(now.getTime() + JST_OFFSET_MS)
  const hour = jst.getUTCHours()
  const minute = jst.getUTCMinutes()
  if (hour >= 22 || hour < 7) return true
  return hour === 7 && minute < 30
}

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
  const { data: existing, error: lookupError } = await db()
    .from('local_safety_alerts')
    .select('id, prefecture, city, category, description, push_notified_at')
    .eq('id', alertId)
    .maybeSingle()

  if (lookupError) throw lookupError
  if (!existing) return { status: 'not_found' }
  if (existing.push_notified_at) return { status: 'already_claimed' }
  if (!shouldNotifyAlert(existing.category)) return { status: 'skip' }

  const claimedAt = new Date().toISOString()

  const { data: claimed, error: claimError } = await db()
    .from('local_safety_alerts')
    .update({ push_notified_at: claimedAt })
    .eq('id', alertId)
    .is('push_notified_at', null)
    .select('id, prefecture, city, category, description')
    .maybeSingle()

  if (claimError) throw claimError
  if (!claimed) return { status: 'already_claimed' }

  return {
    status: 'claimed',
    alert: claimed as LocalAlertForNotification,
    claimedAt,
  }
}

/**
 * クレーム取得したアラートを未通知状態に戻す。
 * 通知処理が例外で失敗した際に Cron ルートから呼び出す。
 */
export async function releaseLocalAlertNotificationClaim(params: {
  alertId: string
  claimedAt: string
}): Promise<void> {
  await db()
    .from('local_safety_alerts')
    .update({ push_notified_at: null })
    .eq('id', params.alertId)
    .eq('push_notified_at', params.claimedAt)
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

  return broadcastPush(payload, 'local_alerts')
}

/**
 * 同一都道府県でアラートが集中した際のまとめ通知（バースト抑制）。
 * 返り値は送信成功件数。
 */
export async function notifyUsersForLocalAlertBatch(params: {
  prefecture: string
  count: number
  latestAlertId: string
}): Promise<number> {
  const payload = buildLocalAlertBatchPushPayload(params)
  return broadcastPush(payload, 'local_alerts')
}
