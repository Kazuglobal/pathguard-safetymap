/**
 * 危険レポートアラート通知ロジック
 *
 * 新規危険レポートが投稿された際、登録通学路300m圏内のユーザーに
 * プッシュ通知を送信する。
 */

import { getSupabaseAdmin } from '@/lib/supabase-admin'

// user_routes の route_geometry フィールドは生成型では Json のため any キャスト
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => getSupabaseAdmin() as any
import { findDangersNearRoute } from '@/lib/geo/route-danger-finder'
import { sendPushToUser } from '@/lib/web-push'
import { buildDangerReportPushPayload } from '@/lib/notifications/builders'
import type { UserRoute } from '@/lib/types'

const NOTIFICATION_RADIUS_METERS = 300

/** notifyUsersNearReport が必要とする最小フィールド */
export interface DangerReportLocation {
  id: string
  title: string
  latitude: number
  longitude: number
}

interface DangerReportNotificationRow extends DangerReportLocation {
  user_id: string
  push_notified_at: string | null
}

export type DangerReportNotificationClaimResult =
  | {
      status: 'claimed'
      report: DangerReportLocation
      claimedAt: string
    }
  | { status: 'not_found' }
  | { status: 'already_claimed' }

type RouteWithGeometry = Pick<UserRoute, 'id' | 'user_id' | 'name'> & {
  route_geometry: GeoJSON.LineString
}

export async function claimDangerReportForNotification(params: {
  reportId: string
  userId?: string
}): Promise<DangerReportNotificationClaimResult> {
  let lookupQuery = db()
    .from('danger_reports')
    .select('id, title, latitude, longitude, user_id, push_notified_at')
    .eq('id', params.reportId)

  if (params.userId) {
    lookupQuery = lookupQuery.eq('user_id', params.userId)
  }

  const { data: existing, error: lookupError } = await lookupQuery.maybeSingle()
  if (lookupError) {
    throw lookupError
  }

  if (!existing) {
    return { status: 'not_found' }
  }

  if ((existing as DangerReportNotificationRow).push_notified_at) {
    return { status: 'already_claimed' }
  }

  const claimedAt = new Date().toISOString()
  let claimQuery = db()
    .from('danger_reports')
    .update({ push_notified_at: claimedAt })
    .eq('id', params.reportId)
    .is('push_notified_at', null)

  if (params.userId) {
    claimQuery = claimQuery.eq('user_id', params.userId)
  }

  const { data: claimed, error: claimError } = await claimQuery
    .select('id, title, latitude, longitude')
    .maybeSingle()

  if (claimError) {
    throw claimError
  }

  if (!claimed) {
    return { status: 'already_claimed' }
  }

  return {
    status: 'claimed',
    claimedAt,
    report: claimed as DangerReportLocation,
  }
}

export async function releaseDangerReportNotificationClaim(params: {
  reportId: string
  claimedAt: string
}): Promise<void> {
  await db()
    .from('danger_reports')
    .update({ push_notified_at: null })
    .eq('id', params.reportId)
    .eq('push_notified_at', params.claimedAt)
}

/**
 * 指定レポート周辺の通学路を持つユーザーにプッシュ通知を送信する。
 * 返り値は通知を送信したユーザー数。
 */
export async function notifyUsersNearReport(report: DangerReportLocation): Promise<number> {
  if (report.latitude == null || report.longitude == null) return 0

  // route_geometry を持つ全ルートを取得
  const { data: routes, error } = await db()
    .from('user_routes')
    .select('id, user_id, name, route_geometry')
    .not('route_geometry', 'is', null)

  if (error) {
    throw error
  }

  if (!routes || routes.length === 0) return 0

  // 300m以内のルートを持つユニークなユーザーIDを集める
  const notifiedUserIds = new Set<string>()

  for (const route of routes as RouteWithGeometry[]) {
    try {
      // findDangersNearRoute は latitude/longitude のみ参照するため unknown キャストは安全
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nearby = findDangersNearRoute(
        route.route_geometry,
        [report as any],
        NOTIFICATION_RADIUS_METERS
      )
      if (nearby.length > 0) {
        notifiedUserIds.add(route.user_id)
      }
    } catch {
      // 無効な geometry 等はスキップ
    }
  }

  if (notifiedUserIds.size === 0) return 0

  // 各ユーザーにプッシュ通知を送信
  const payload = buildDangerReportPushPayload({
    reportId: report.id,
    reportTitle: report.title,
  })

  const counts = await Promise.all(
    Array.from(notifiedUserIds).map((userId) =>
      sendPushToUser(userId, payload, 'danger_reports')
    )
  )
  return counts.reduce((a, b) => a + b, 0)
}
