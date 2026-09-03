import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase-server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/push-notifications/notify-danger-report', () => ({
  dispatchDangerReportNotification: vi.fn(),
}))

import { createServerClient } from '@/lib/supabase-server'
import { dispatchDangerReportNotification } from '@/lib/push-notifications/notify-danger-report'

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
    vi.mocked(dispatchDangerReportNotification).mockResolvedValue({ status: 'not_found' })
    const { POST } = await import('@/app/api/push/notify-danger-report/route')

    const res = await POST(makeRequest({ reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01' }))

    expect(res.status).toBe(404)
    expect(dispatchDangerReportNotification).toHaveBeenCalledWith({
      reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01',
      userId: mockUser.id,
    }, { background: true })
  })

  it.each(['already_claimed', 'not_ready'] as const)(
    '%s は送信対象数を漏らさない固定応答を返す', async (status) => {
    mockAuth(mockUser)
    vi.mocked(dispatchDangerReportNotification).mockResolvedValue({ status })
    const { POST } = await import('@/app/api/push/notify-danger-report/route')

    const res = await POST(makeRequest({ reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01' }))

    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({ notified: true })
  })

  it('accepted でも送信対象数を漏らさない固定応答を返す', async () => {
    mockAuth(mockUser)
    vi.mocked(dispatchDangerReportNotification).mockResolvedValue({ status: 'accepted' })
    const { POST } = await import('@/app/api/push/notify-danger-report/route')

    const res = await POST(makeRequest({ reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01' }))

    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({ notified: true })
  })

  it('dispatch 受付自体が失敗した場合は500を返す', async () => {
    mockAuth(mockUser)
    vi.mocked(dispatchDangerReportNotification).mockRejectedValue(new Error('db down'))
    const { POST } = await import('@/app/api/push/notify-danger-report/route')

    const res = await POST(makeRequest({ reportId: '6e981e3e-1b4d-4eb7-b0d5-4338406e6d01' }))

    expect(res.status).toBe(500)
  })
})
