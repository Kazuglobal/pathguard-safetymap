import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  listPending: vi.fn(), dispatch: vi.fn(),
}))
vi.mock('@/lib/db/repos/push.repo', () => ({ listPendingDangerReportIds: mocks.listPending }))
vi.mock('@/lib/push-notifications/notify-danger-report', () => ({
  dispatchDangerReportNotification: mocks.dispatch,
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

  it('dispatches repository-filtered rows and skips rows no longer eligible', async () => {
    mocks.listPending.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }])
    mocks.dispatch
      .mockResolvedValueOnce({ status: 'notified', notified: 2 })
      .mockResolvedValueOnce({ status: 'not_ready' })
    const response = await GET(request())
    expect(await response.json()).toEqual({ processed: 2, notified: 2, failed: 0, skipped: 1 })
    expect(mocks.listPending).toHaveBeenCalledWith({ kind: 'service' }, expect.any(String))
    expect(mocks.dispatch).toHaveBeenCalledWith({ reportId: 'r1' })
  })

  it('reports a failed dispatch without exposing it publicly', async () => {
    mocks.listPending.mockResolvedValue([{ id: 'r1' }])
    mocks.dispatch.mockRejectedValue(new Error('push down'))
    const response = await GET(request())
    expect(await response.json()).toEqual({ processed: 1, notified: 0, failed: 1, skipped: 0 })
  })
})
