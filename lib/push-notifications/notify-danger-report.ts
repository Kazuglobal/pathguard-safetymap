import { getCloudflareContext } from '@opennextjs/cloudflare'

import { getServiceActor } from '@/lib/auth/service-actor'
import {
  claimDangerReport,
  completeDangerReportClaim,
  confirmDangerReportClaim,
  listNotificationRoutes,
  releaseDangerReportClaim,
} from '@/lib/db/repos/push.repo'
import { findDangersNearRoute } from '@/lib/geo/route-danger-finder'
import { buildDangerReportPushPayload } from '@/lib/notifications/builders'
import { sendPushToUser } from '@/lib/web-push'

const NOTIFICATION_RADIUS_METERS = 300

export interface DangerReportLocation {
  id: string
  dangerType: string
  prefecture: string | null
  latitude: number
  longitude: number
}

export type DangerReportNotificationClaimResult =
  | { status: 'claimed'; report: DangerReportLocation; claimedAt: string }
  | { status: 'not_found' }
  | { status: 'already_claimed' }
  | { status: 'not_ready' }

export type DangerReportNotificationDispatchResult =
  | { status: 'not_found' | 'already_claimed' | 'not_ready' | 'accepted' }
  | { status: 'notified'; notified: number }

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

async function confirmDangerReportNotificationClaim(params: {
  reportId: string
  claimedAt: string
}): Promise<boolean> {
  return confirmDangerReportClaim(getServiceActor(), params.reportId, params.claimedAt)
}

async function completeDangerReportNotificationClaim(params: {
  reportId: string
  claimedAt: string
}): Promise<boolean> {
  return completeDangerReportClaim(getServiceActor(), params.reportId, params.claimedAt)
}

function asLineString(value: Record<string, unknown> | null): GeoJSON.LineString | null {
  if (!value || value.type !== 'LineString' || !Array.isArray(value.coordinates)) return null
  return value as unknown as GeoJSON.LineString
}

async function listUsersNearReport(report: DangerReportLocation): Promise<string[]> {
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
  return [...notifiedUserIds]
}

async function notifyUsers(report: DangerReportLocation, userIds: readonly string[]): Promise<number> {
  const payload = buildDangerReportPushPayload({
    reportId: report.id,
    dangerType: report.dangerType,
    prefecture: report.prefecture,
  })
  const counts = await Promise.all(
    userIds.map((userId) => sendPushToUser(userId, payload, 'danger_reports')),
  )
  return counts.reduce((sum, count) => sum + count, 0)
}

export async function notifyUsersNearReport(report: DangerReportLocation): Promise<number> {
  return notifyUsers(report, await listUsersNearReport(report))
}

function scheduleBackground(task: Promise<unknown>): void {
  const handled = task.catch((error) => {
    console.error('[push/notify-danger-report] background delivery failed', error instanceof Error ? error.message : 'unknown')
  })
  try {
    getCloudflareContext().ctx.waitUntil(handled)
  } catch {
    void handled
  }
}

export async function dispatchDangerReportNotification(
  params: { reportId: string; userId?: string },
  options: { background?: boolean } = {},
): Promise<DangerReportNotificationDispatchResult> {
  const claimed = await claimDangerReportForNotification(params)
  if (claimed.status !== 'claimed') return { status: claimed.status }

  const delivery = (async () => {
    const userIds = await listUsersNearReport(claimed.report)
    const confirmed = await confirmDangerReportNotificationClaim({
      reportId: claimed.report.id,
      claimedAt: claimed.claimedAt,
    })
    if (!confirmed) return null
    const notified = await notifyUsers(claimed.report, userIds)
    await completeDangerReportNotificationClaim({
      reportId: claimed.report.id,
      claimedAt: claimed.claimedAt,
    })
    return notified
  })().catch(async (error) => {
    await releaseDangerReportNotificationClaim({
      reportId: claimed.report.id,
      claimedAt: claimed.claimedAt,
    })
    throw error
  })

  if (options.background) {
    scheduleBackground(delivery)
    return { status: 'accepted' }
  }

  const notified = await delivery
  return notified === null ? { status: 'not_ready' } : { status: 'notified', notified }
}

export function queueDangerReportNotification(params: { reportId: string; userId?: string }): void {
  scheduleBackground(dispatchDangerReportNotification(params))
}
