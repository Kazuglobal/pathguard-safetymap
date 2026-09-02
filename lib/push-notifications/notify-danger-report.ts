import { getServiceActor } from '@/lib/auth/service-actor'
import {
  claimDangerReport,
  listNotificationRoutes,
  releaseDangerReportClaim,
} from '@/lib/db/repos/push.repo'
import { findDangersNearRoute } from '@/lib/geo/route-danger-finder'
import { buildDangerReportPushPayload } from '@/lib/notifications/builders'
import { sendPushToUser } from '@/lib/web-push'

const NOTIFICATION_RADIUS_METERS = 300

export interface DangerReportLocation {
  id: string
  title: string
  latitude: number
  longitude: number
}

export type DangerReportNotificationClaimResult =
  | { status: 'claimed'; report: DangerReportLocation; claimedAt: string }
  | { status: 'not_found' }
  | { status: 'already_claimed' }

export async function claimDangerReportForNotification(params: {
  reportId: string
  userId?: string
}): Promise<DangerReportNotificationClaimResult> {
  return claimDangerReport(getServiceActor(), params.reportId, params.userId)
}

export async function releaseDangerReportNotificationClaim(params: {
  reportId: string
  claimedAt: string
}): Promise<void> {
  await releaseDangerReportClaim(getServiceActor(), params.reportId, params.claimedAt)
}

function asLineString(value: Record<string, unknown> | null): GeoJSON.LineString | null {
  if (!value || value.type !== 'LineString' || !Array.isArray(value.coordinates)) return null
  return value as unknown as GeoJSON.LineString
}

export async function notifyUsersNearReport(report: DangerReportLocation): Promise<number> {
  const routes = await listNotificationRoutes(getServiceActor())
  const notifiedUserIds = new Set<string>()
  for (const route of routes) {
    const geometry = asLineString(route.routeGeometry)
    if (!geometry) continue
    try {
      const nearby = findDangersNearRoute(
        geometry,
        [report as unknown as Parameters<typeof findDangersNearRoute>[1][number]],
        NOTIFICATION_RADIUS_METERS,
      )
      if (nearby.length > 0) notifiedUserIds.add(route.userId)
    } catch {
      // Invalid historical geometry is skipped; other routes still receive notifications.
    }
  }
  const payload = buildDangerReportPushPayload({ reportId: report.id, reportTitle: report.title })
  const counts = await Promise.all(
    [...notifiedUserIds].map((userId) => sendPushToUser(userId, payload, 'danger_reports')),
  )
  return counts.reduce((sum, count) => sum + count, 0)
}
