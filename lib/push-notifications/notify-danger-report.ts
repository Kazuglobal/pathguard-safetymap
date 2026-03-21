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

type RouteWithGeometry = Pick<UserRoute, 'id' | 'user_id' | 'name'> & {
  route_geometry: GeoJSON.LineString
}

/**
 * 指定レポート周辺の通学路を持つユーザーにプッシュ通知を送信する。
 * 返り値は通知を送信したユーザー数。
 */
export async function notifyUsersNearReport(report: DangerReportLocation): Promise<number> {
  if (!report.latitude || !report.longitude) return 0

  // route_geometry を持つ全ルートを取得
  const { data: routes, error } = await db()
    .from('user_routes')
    .select('id, user_id, name, route_geometry')
    .not('route_geometry', 'is', null)

  if (error || !routes || routes.length === 0) return 0

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
