import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  mode: vi.fn(() => 'live'),
  list: vi.fn(),
  fallbackCount: vi.fn(),
  markFailed: vi.fn(),
  moderate: vi.fn(),
  queueNotification: vi.fn(),
}))

vi.mock('@/lib/danger-report-moderation-d1', () => ({
  MAX_DANGER_MODERATION_FALLBACKS: 3,
  getDangerModerationMode: mocks.mode,
  listReportsForModerationSweep: mocks.list,
  getDangerModerationFallbackCount: mocks.fallbackCount,
  markDangerReportModerationFailed: mocks.markFailed,
  moderateDangerReportRecord: mocks.moderate,
}))
vi.mock('@/lib/push-notifications/notify-danger-report', () => ({
  queueDangerReportNotification: mocks.queueNotification,
}))

import { GET } from '@/app/api/cron/moderation-sweep/route'
import { hasModerationSweepTimeRemaining } from '@/lib/danger-report-moderation-sweep'

function request(token = 'test-cron-secret') {
  return new NextRequest('http://localhost/api/cron/moderation-sweep', {
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/cron/moderation-sweep (D1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('CRON_SECRET', 'test-cron-secret')
    mocks.mode.mockReturnValue('live')
    mocks.list.mockResolvedValue([])
    mocks.fallbackCount.mockResolvedValue(0)
    mocks.markFailed.mockResolvedValue({ id: 'exhausted-report' })
    mocks.moderate.mockImplementation(async (report: { id: string }) => ({
      outcome: 'updated',
      report: { ...report, status: 'approved', aiModerationStatus: 'approved' },
    }))
  })
  afterEach(() => vi.unstubAllEnvs())

  it('rejects an invalid cron secret before querying D1', async () => {
    const response = await GET(request('wrong'))
    expect(response.status).toBe(401)
    expect(mocks.list).not.toHaveBeenCalled()
  })

  it('reserves execution time for the current report', () => {
    expect(hasModerationSweepTimeRemaining(1_000, 220_999)).toBe(true)
    expect(hasModerationSweepTimeRemaining(1_000, 221_000)).toBe(false)
  })

  it('asks D1 for ten stale reports and processes them serially', async () => {
    mocks.list.mockResolvedValue([{ id: 'r-1' }, { id: 'r-2' }])
    const order: string[] = []
    mocks.moderate.mockImplementation(async (report: { id: string }) => {
      order.push(`start:${report.id}`)
      await Promise.resolve()
      order.push(`end:${report.id}`)
      return { outcome: 'updated', report: { ...report, status: 'approved', aiModerationStatus: 'approved' } }
    })
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(mocks.list).toHaveBeenCalledWith(expect.any(String), 'live', 10)
    expect(order).toEqual(['start:r-1', 'end:r-1', 'start:r-2', 'end:r-2'])
    expect(mocks.queueNotification).toHaveBeenCalledTimes(2)
  })

  it('moves a report to human review after three live fallbacks', async () => {
    mocks.list.mockResolvedValue([{ id: 'r-3' }])
    mocks.fallbackCount.mockResolvedValue(3)
    const response = await GET(request())
    const body = await response.json()
    expect(mocks.markFailed).toHaveBeenCalledWith('r-3', expect.any(Date))
    expect(mocks.moderate).not.toHaveBeenCalled()
    expect(body.exhausted).toBe(1)
  })

  it('does not count fallback attempts in shadow mode', async () => {
    mocks.mode.mockReturnValue('shadow')
    mocks.list.mockResolvedValue([{ id: 'shadow' }])
    mocks.moderate.mockResolvedValue({ outcome: 'shadow' })
    const response = await GET(request())
    expect((await response.json()).shadow).toBe(1)
    expect(mocks.fallbackCount).not.toHaveBeenCalled()
    expect(mocks.queueNotification).not.toHaveBeenCalled()
  })

  it('does not queue a persisted non-approved moderation result', async () => {
    mocks.list.mockResolvedValue([{ id: 'rejected' }])
    mocks.moderate.mockResolvedValue({
      outcome: 'updated',
      report: { id: 'rejected', status: 'rejected', aiModerationStatus: 'rejected' },
    })

    expect((await GET(request())).status).toBe(200)
    expect(mocks.queueNotification).not.toHaveBeenCalled()
  })
})
