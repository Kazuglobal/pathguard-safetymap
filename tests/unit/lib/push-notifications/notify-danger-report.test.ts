import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  claim: vi.fn(), release: vi.fn(), listRoutes: vi.fn(), send: vi.fn(),
}))
vi.mock('@/lib/db/repos/push.repo', () => ({
  claimDangerReport: mocks.claim,
  releaseDangerReportClaim: mocks.release,
  listNotificationRoutes: mocks.listRoutes,
}))
vi.mock('@/lib/web-push', () => ({ sendPushToUser: mocks.send }))

import { claimDangerReportForNotification, notifyUsersNearReport, releaseDangerReportNotificationClaim } from '@/lib/push-notifications/notify-danger-report'

describe('danger report push notification repository flow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('notifies each unique user whose route is within 300m', async () => {
    mocks.listRoutes.mockResolvedValue([
      { userId: 'u1', routeGeometry: { type: 'LineString', coordinates: [[139, 35], [139.001, 35]] } },
      { userId: 'u1', routeGeometry: { type: 'LineString', coordinates: [[139, 35], [139.002, 35]] } },
      { userId: 'u2', routeGeometry: { type: 'LineString', coordinates: [[140, 36], [140.001, 36]] } },
    ])
    mocks.send.mockResolvedValue(1)
    await expect(notifyUsersNearReport({ id: 'r1', title: '危険', latitude: 35, longitude: 139.0005 })).resolves.toBe(1)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send).toHaveBeenCalledWith('u1', expect.any(Object), 'danger_reports')
  })

  it('delegates claim and release to the D1 repository as service actor', async () => {
    mocks.claim.mockResolvedValue({ status: 'already_claimed' })
    await expect(claimDangerReportForNotification({ reportId: 'r1' })).resolves.toEqual({ status: 'already_claimed' })
    expect(mocks.claim).toHaveBeenCalledWith({ kind: 'service' }, 'r1', undefined)
    await releaseDangerReportNotificationClaim({ reportId: 'r1', claimedAt: 'now' })
    expect(mocks.release).toHaveBeenCalledWith({ kind: 'service' }, 'r1', 'now')
  })
})
