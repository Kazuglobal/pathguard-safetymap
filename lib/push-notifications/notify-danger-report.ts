import { getCloudflareContext } from '@opennextjs/cloudflare'

import { getServiceActor } from '@/lib/auth/service-actor'
import {
  claimDangerReport,
  completeDangerReportClaim,
  confirmDangerReportClaim,
  listDistrictBoundariesAround,
  listDistrictNotificationUsers,
  listNotificationRoutes,
  releaseDangerReportClaim,
} from '@/lib/db/repos/push.repo'
import { findDangersNearRoute } from '@/lib/geo/route-danger-finder'
import { buildDangerReportPushPayload } from '@/lib/notifications/builders'
import { isWithinOrNearSchoolDistrict } from '@/lib/school-districts'
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

interface Recipients {
  /** 通学路の 300m 以内に報告がある人 */
  readonly nearRoute: readonly string[]
  /**
   * 報告の地点の小学校区にお子さまを登録していて、道すじで判定できない人(学区の名前つき):
   * 「粗く保存」の人と、通学路が短くて道すじを保存していない人
   */
  readonly byDistrict: ReadonlyArray<{ userId: string; districtName: string }>
}

/** 報告の地点を含む小学校区に、お子さまを登録している人のうち、道すじで判定できない人(学区の名前つき) */
async function listUsersInReportDistrict(report: DangerReportLocation): Promise<Array<{ userId: string; districtName: string }>> {
  const service = getServiceActor()
  const boundaries = await listDistrictBoundariesAround(service, report)
  const districts = new Map<string, { name: string; geometries: Array<(typeof boundaries)[number]['geometry']> }>()
  for (const row of boundaries) {
    const current = districts.get(row.districtId) ?? { name: row.name, geometries: [] }
    districts.set(row.districtId, { name: current.name, geometries: [...current.geometries, row.geometry] })
  }
  // 学区の境界の道の上の報告は、両側の学区に知らせる(境界から 50m 以内なら、その学区にも入れる)
  const matched = [...districts].filter(([, district]) => isWithinOrNearSchoolDistrict(report.longitude, report.latitude, district.geometries))
  if (matched.length === 0) return []
  const names = new Map(matched.map(([id, district]) => [id, district.name]))
  const byUser = new Map<string, string>()
  for (const row of await listDistrictNotificationUsers(service, [...names.keys()])) {
    if (!byUser.has(row.userId)) byUser.set(row.userId, names.get(row.districtId) ?? '')
  }
  return [...byUser].map(([userId, districtName]) => ({ userId, districtName }))
}

async function listRecipients(report: DangerReportLocation): Promise<Recipients> {
  const nearRoute = await listUsersNearReport(report)
  const near = new Set(nearRoute)
  const byDistrict = (await listUsersInReportDistrict(report)).filter((recipient) => !near.has(recipient.userId))
  return { nearRoute, byDistrict }
}

async function notifyUsers(report: DangerReportLocation, recipients: Recipients): Promise<number> {
  const routePayload = buildDangerReportPushPayload({
    reportId: report.id,
    dangerType: report.dangerType,
    prefecture: report.prefecture,
  })
  const counts = await Promise.all([
    ...recipients.nearRoute.map((userId) => sendPushToUser(userId, routePayload, 'danger_reports')),
    ...recipients.byDistrict.map((recipient) => sendPushToUser(recipient.userId, buildDangerReportPushPayload({
      reportId: report.id,
      dangerType: report.dangerType,
      prefecture: report.prefecture,
      areaLabel: recipient.districtName || null,
    }), 'danger_reports')),
  ])
  return counts.reduce((sum, count) => sum + count, 0)
}

export async function notifyUsersNearReport(report: DangerReportLocation): Promise<number> {
  return notifyUsers(report, await listRecipients(report))
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
    const recipients = await listRecipients(claimed.report)
    const confirmed = await confirmDangerReportNotificationClaim({
      reportId: claimed.report.id,
      claimedAt: claimed.claimedAt,
    })
    if (!confirmed) return null
    const notified = await notifyUsers(claimed.report, recipients)
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
