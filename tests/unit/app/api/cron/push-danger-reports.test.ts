import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  listPending: vi.fn(), claim: vi.fn(), release: vi.fn(), notify: vi.fn(),
}))
vi.mock('@/lib/db/repos/push.repo', () => ({ listPendingDangerReportIds: mocks.listPending }))
vi.mock('@/lib/push-notifications/notify-danger-report', () => ({
  claimDangerReportForNotification: mocks.claim,
  releaseDangerReportNotificationClaim: mocks.release,
  notifyUsersNearReport: mocks.notify,
}))

import { GET } from '@/app/api/cron/push-danger-reports/route'

const request = (secret = 'secret') => new NextRequest('http://localhost/api/cron/push-danger-reports', {
  headers: { authorization: `Bearer ${secret}` },
})

describe('push-danger-reports cron on D1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'secret'
  })

  it('rejects an invalid cron secret', async () => {
    expect((await GET(request('wrong'))).status).toBe(401)
  })

  it('claims pending rows and skips rows already claimed', async () => {
    mocks.listPending.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }])
    mocks.claim
      .mockResolvedValueOnce({ status: 'claimed', claimedAt: 'now', report: { id: 'r1', title: '危険', latitude: 35, longitude: 139 } })
      .mockResolvedValueOnce({ status: 'already_claimed' })
    mocks.notify.mockResolvedValue(2)
    const response = await GET(request())
    expect(await response.json()).toEqual({ processed: 2, notified: 2, failed: 0, skipped: 1 })
    expect(mocks.listPending).toHaveBeenCalledWith({ kind: 'service' }, expect.any(String))
  })

  it('releases a claim when notification delivery fails', async () => {
    mocks.listPending.mockResolvedValue([{ id: 'r1' }])
    mocks.claim.mockResolvedValue({ status: 'claimed', claimedAt: 'claim-time', report: { id: 'r1', title: '危険', latitude: 35, longitude: 139 } })
    mocks.notify.mockRejectedValue(new Error('push down'))
    const response = await GET(request())
    expect(await response.json()).toEqual({ processed: 1, notified: 0, failed: 1, skipped: 0 })
    expect(mocks.release).toHaveBeenCalledWith({ reportId: 'r1', claimedAt: 'claim-time' })
  })
})
