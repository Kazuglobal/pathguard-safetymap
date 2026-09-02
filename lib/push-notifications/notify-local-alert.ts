/**
 * 地域安全アラートのプッシュ通知ロジック
 *
 * suspicious / voice_call カテゴリの新規アラートを
 * 購読ユーザー全員にブロードキャストする。
 * notify-danger-report.ts と同じ楽観的ロックパターンを採用。
 */

import { getServiceActor } from '@/lib/auth/service-actor'
import { claimLocalAlert, releaseLocalAlertClaim } from '@/lib/db/repos/push.repo'

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
  const result = await claimLocalAlert(getServiceActor(), alertId)
  if (result.status !== 'claimed') return result
  return {
    status: 'claimed',
    claimedAt: result.claimedAt,
    alert: {
      id: result.alert.id,
      prefecture: result.alert.prefecture,
      city: result.alert.city,
      category: result.alert.category as LocalAlertCategory,
      description: result.alert.description,
    },
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
  await releaseLocalAlertClaim(getServiceActor(), params.alertId, params.claimedAt)
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
