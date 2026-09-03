import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  claim: vi.fn(), confirm: vi.fn(), complete: vi.fn(), release: vi.fn(), listRoutes: vi.fn(), send: vi.fn(),
}))
vi.mock('@/lib/db/repos/push.repo', () => ({
  claimDangerReport: mocks.claim,
  confirmDangerReportClaim: mocks.confirm,
  completeDangerReportClaim: mocks.complete,
  releaseDangerReportClaim: mocks.release,
  listNotificationRoutes: mocks.listRoutes,
}))
vi.mock('@/lib/web-push', () => ({ sendPushToUser: mocks.send }))

import {
  claimDangerReportForNotification,
  dispatchDangerReportNotification,
  notifyUsersNearReport,
  releaseDangerReportNotificationClaim,
} from '@/lib/push-notifications/notify-danger-report'

describe('danger report push notification repository flow', () => {
  beforeEach(() => vi.clearAllMocks())

  it('notifies each unique user whose route is within 300m', async () => {
    mocks.listRoutes.mockResolvedValue([
      { userId: 'u1', routeGeometry: { type: 'LineString', coordinates: [[139, 35], [139.001, 35]] } },
      { userId: 'u1', routeGeometry: { type: 'LineString', coordinates: [[139, 35], [139.002, 35]] } },
      { userId: 'u2', routeGeometry: { type: 'LineString', coordinates: [[140, 36], [140.001, 36]] } },
    ])
    mocks.send.mockResolvedValue(1)
    await expect(notifyUsersNearReport({
      id: 'r1', dangerType: '<script>攻撃文</script>', prefecture: '偽の県<script>',
      latitude: 35, longitude: 139.0005,
    })).resolves.toBe(1)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send).toHaveBeenCalledWith('u1', expect.any(Object), 'danger_reports')
    const payload = mocks.send.mock.calls[0][1]
    expect(`${payload.title}${payload.body}`).toBe('近隣の通学路に危険報告通学路の危険に関する新しい報告が公開されました。')
    expect(`${payload.title}${payload.body}`).not.toContain('攻撃文')
  })

  it('delegates claim and release to the D1 repository as service actor', async () => {
    mocks.claim.mockResolvedValue({ status: 'already_claimed' })
    await expect(claimDangerReportForNotification({ reportId: 'r1' })).resolves.toEqual({ status: 'already_claimed' })
    expect(mocks.claim).toHaveBeenCalledWith({ kind: 'service' }, 'r1', undefined)
    await releaseDangerReportNotificationClaim({ reportId: 'r1', claimedAt: 'now' })
    expect(mocks.release).toHaveBeenCalledWith({ kind: 'service' }, 'r1', 'now')
  })

  it('releases an atomic claim when delivery throws', async () => {
    mocks.claim.mockResolvedValue({
      status: 'claimed',
      claimedAt: 'claim-time',
      report: { id: 'r1', dangerType: 'traffic', prefecture: '東京都', latitude: 35, longitude: 139 },
    })
    mocks.listRoutes.mockResolvedValue([
      { userId: 'u1', routeGeometry: { type: 'LineString', coordinates: [[139, 35], [139.001, 35]] } },
    ])
    mocks.confirm.mockResolvedValue(true)
    mocks.send.mockRejectedValue(new Error('push down'))

    await expect(dispatchDangerReportNotification({ reportId: 'r1' })).rejects.toThrow('push down')
    expect(mocks.release).toHaveBeenCalledWith({ kind: 'service' }, 'r1', 'claim-time')
  })

  it('aborts fanout when the report is reopened after claim', async () => {
    mocks.claim.mockResolvedValue({
      status: 'claimed',
      claimedAt: 'claim-token',
      report: { id: 'r1', dangerType: 'traffic', prefecture: '東京都', latitude: 35, longitude: 139 },
    })
    mocks.listRoutes.mockResolvedValue([
      { userId: 'u1', routeGeometry: { type: 'LineString', coordinates: [[139, 35], [139.001, 35]] } },
    ])
    mocks.confirm.mockResolvedValue(false)

    await expect(dispatchDangerReportNotification({ reportId: 'r1' })).resolves.toEqual({ status: 'not_ready' })
    expect(mocks.send).not.toHaveBeenCalled()
    expect(mocks.complete).not.toHaveBeenCalled()
  })

  it('finalizes the claim after successful fanout', async () => {
    mocks.claim.mockResolvedValue({
      status: 'claimed',
      claimedAt: 'claim-token',
      report: { id: 'r1', dangerType: 'traffic', prefecture: null, latitude: 35, longitude: 139 },
    })
    mocks.listRoutes.mockResolvedValue([])
    mocks.confirm.mockResolvedValue(true)
    mocks.complete.mockResolvedValue(true)

    await expect(dispatchDangerReportNotification({ reportId: 'r1' })).resolves.toEqual({ status: 'notified', notified: 0 })
    expect(mocks.complete).toHaveBeenCalledWith({ kind: 'service' }, 'r1', 'claim-token')
  })
})
