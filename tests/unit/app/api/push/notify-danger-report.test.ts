import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/push-notifications/notify-danger-report', () => ({
  claimDangerReportForNotification: vi.fn(),
  releaseDangerReportNotificationClaim: vi.fn(),
  notifyUsersNearReport: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase-server'
import {
  claimDangerReportForNotification,
  releaseDangerReportNotificationClaim,
  notifyUsersNearReport,
} from '@/lib/push-notifications/notify-danger-report'

const mockUser = { id: 'user-1', email: 'test@example.com' }

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/push/notify-danger-report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockAuth(user: typeof mockUser | null) {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as any)
}

describe('POST /api/push/notify-danger-report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証の場合は401を返す', async () => {
    mockAuth(null)
    const { POST } = await import('@/app/api/push/notify-danger-report/route')

    const res = await POST(makeRequest({ reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01' }))

    expect(res.status).toBe(401)
  })

  it('本人所有でない、または存在しないレポートは404を返す', async () => {
    mockAuth(mockUser)
    vi.mocked(claimDangerReportForNotification).mockResolvedValue({ status: 'not_found' })
    const { POST } = await import('@/app/api/push/notify-danger-report/route')

    const res = await POST(makeRequest({ reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01' }))

    expect(res.status).toBe(404)
    expect(claimDangerReportForNotification).toHaveBeenCalledWith({
      reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01',
      userId: mockUser.id,
    })
  })

  it('既に通知確定済みのレポートは再送せず skip を返す', async () => {
    mockAuth(mockUser)
    vi.mocked(claimDangerReportForNotification).mockResolvedValue({
      status: 'already_claimed',
    })
    const { POST } = await import('@/app/api/push/notify-danger-report/route')

    const res = await POST(makeRequest({ reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ notified: 0, skipped: true })
    expect(notifyUsersNearReport).not.toHaveBeenCalled()
  })

  it('claim 済みレポートのみ通知送信する', async () => {
    mockAuth(mockUser)
    vi.mocked(claimDangerReportForNotification).mockResolvedValue({
      status: 'claimed',
      claimedAt: '2026-03-21T12:34:56.000Z',
      report: {
        id: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01',
        title: 'テスト',
        latitude: 35.6812,
        longitude: 139.7671,
      },
    })
    vi.mocked(notifyUsersNearReport).mockResolvedValue(3)
    const { POST } = await import('@/app/api/push/notify-danger-report/route')

    const res = await POST(makeRequest({ reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ notified: 3 })
  })

  it('送信失敗時は claim を解放して500を返す', async () => {
    mockAuth(mockUser)
    vi.mocked(claimDangerReportForNotification).mockResolvedValue({
      status: 'claimed',
      claimedAt: '2026-03-21T12:34:56.000Z',
      report: {
        id: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01',
        title: 'テスト',
        latitude: 35.6812,
        longitude: 139.7671,
      },
    })
    vi.mocked(notifyUsersNearReport).mockRejectedValue(new Error('boom'))
    const { POST } = await import('@/app/api/push/notify-danger-report/route')

    const res = await POST(makeRequest({ reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01' }))

    expect(res.status).toBe(500)
    expect(releaseDangerReportNotificationClaim).toHaveBeenCalledWith({
      reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01',
      claimedAt: '2026-03-21T12:34:56.000Z',
    })
  })

  it('claim 取得自体が失敗した場合は500を返す', async () => {
    mockAuth(mockUser)
    vi.mocked(claimDangerReportForNotification).mockRejectedValue(new Error('db down'))
    const { POST } = await import('@/app/api/push/notify-danger-report/route')

    const res = await POST(makeRequest({ reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01' }))

    expect(res.status).toBe(500)
  })
})
