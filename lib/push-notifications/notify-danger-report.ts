/**
 * 危険レポートアラート通知ロジック
 *
 * 新規危険レポートが投稿された際、登録通学路300m圏内のユーザーに
 * プッシュ通知を送信する。
 */

import { createClient } from '@supabase/supabase-js'
import { findDangersNearRoute } from '@/lib/geo/route-danger-finder'
import { sendPushToUser } from '@/lib/web-push'
import { buildDangerReportPushPayload } from '@/lib/notifications/builders'
import type { DangerReport, UserRoute } from '@/lib/types'

const NOTIFICATION_RADIUS_METERS = 300

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * 指定レポート周辺の通学路を持つユーザーにプッシュ通知を送信する。
 * 返り値は通知を送信したユーザー数。
 */
export async function notifyUsersNearReport(report: DangerReport): Promise<number> {
  if (!report.latitude || !report.longitude) return 0

  const admin = getAdminClient()

  // route_geometry を持つ全ルートを取得
  const { data: routes, error } = await admin
    .from('user_routes')
    .select('id, user_id, name, route_geometry')
    .not('route_geometry', 'is', null)

  if (error || !routes || routes.length === 0) return 0

  // 300m以内のルートを持つユニークなユーザーIDを集める
  const notifiedUserIds = new Set<string>()

  for (const route of routes as (Pick<UserRoute, 'id' | 'user_id' | 'name'> & { route_geometry: GeoJSON.LineString })[]) {
    if (!route.route_geometry) continue

    try {
      const nearby = findDangersNearRoute(
        route.route_geometry,
        [report],
        NOTIFICATION_RADIUS_METERS
      )
      if (nearby.length === 0) continue
    } catch {
      // 無効なgeometry等はスキップ
      continue
    }

    notifiedUserIds.add(route.user_id)
  }

  if (notifiedUserIds.size === 0) return 0

  // 各ユーザーにプッシュ通知を送信
  const payload = buildDangerReportPushPayload({
    reportId: report.id,
    reportTitle: report.title,
  })

  let totalNotified = 0
  await Promise.all(
    Array.from(notifiedUserIds).map(async (userId) => {
      const count = await sendPushToUser(userId, payload, 'danger_reports')
      totalNotified += count
    })
  )

  return totalNotified
}
