import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/geo/route-danger-finder', () => ({
  findDangersNearRoute: vi.fn(),
}))

vi.mock('@/lib/web-push', () => ({
  sendPushToUser: vi.fn(),
}))

vi.mock('@/lib/notifications/builders', () => ({
  buildDangerReportPushPayload: vi.fn(() => ({
    title: 'テスト危険報告',
    body: 'テスト',
    icon: '/apple-touch-icon.png',
    badge: '/apple-touch-icon.png',
    tag: 'danger-report-1',
    data: { url: '/map?reportId=1', type: 'danger_reports' },
  })),
}))

import { findDangersNearRoute } from '@/lib/geo/route-danger-finder'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendPushToUser } from '@/lib/web-push'
import {
  claimDangerReportForNotification,
  notifyUsersNearReport,
  releaseDangerReportNotificationClaim,
  type DangerReportLocation,
} from '@/lib/push-notifications/notify-danger-report'

const mockReport: DangerReportLocation = {
  id: 'report-1',
  title: 'テスト危険報告',
  latitude: 35.6812,
  longitude: 139.7671,
}

const mockRoute = {
  id: 'route-1',
  user_id: 'user-b',
  name: 'テスト通学路',
  route_geometry: {
    type: 'LineString' as const,
    coordinates: [[139.76, 35.68], [139.77, 35.69]],
  },
}

describe('notifyUsersNearReport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })

  it('300m圏内のルートを持つユーザーに通知を送信する', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({ data: [mockRoute], error: null }),
      }),
    })
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from: mockFrom } as any)
    vi.mocked(findDangersNearRoute).mockReturnValue([mockReport])
    vi.mocked(sendPushToUser).mockResolvedValue(1)

    const count = await notifyUsersNearReport(mockReport)

    expect(sendPushToUser).toHaveBeenCalledWith('user-b', expect.any(Object), 'danger_reports')
    expect(count).toBe(1)
  })

  it('圏外のルートのみの場合は通知しない', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        not: vi.fn().mockResolvedValue({ data: [mockRoute], error: null }),
      }),
    })
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from: mockFrom } as any)
    vi.mocked(findDangersNearRoute).mockReturnValue([])

    const count = await notifyUsersNearReport(mockReport)

    expect(sendPushToUser).not.toHaveBeenCalled()
    expect(count).toBe(0)
  })

  it('latitude/longitudeがundefinedの場合は0を返す', async () => {
    const count = await notifyUsersNearReport({ ...mockReport, latitude: undefined as any, longitude: undefined as any })
    expect(count).toBe(0)
  })
})

describe('claimDangerReportForNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未送信レポートの claim に成功したとき claimed を返す', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { ...mockReport, user_id: 'user-a', push_notified_at: null },
      error: null,
    })
    const updateMaybeSingle = vi.fn().mockResolvedValue({
      data: mockReport,
      error: null,
    })
    const selectAfterClaim = vi.fn().mockReturnValue({ maybeSingle: updateMaybeSingle })
    const eqUserIdAfterClaim = vi.fn().mockReturnValue({ select: selectAfterClaim })
    const isPushNotifiedAtNull = vi.fn().mockReturnValue({ eq: eqUserIdAfterClaim })
    const eqReportIdAfterUpdate = vi.fn().mockReturnValue({ is: isPushNotifiedAtNull })
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi
        .fn()
        .mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ maybeSingle }),
            }),
          }),
        })
        .mockReturnValueOnce({
          update: vi.fn().mockReturnValue({
            eq: eqReportIdAfterUpdate,
          }),
        }),
    } as any)

    const result = await claimDangerReportForNotification({
      reportId: 'report-1',
      userId: 'user-a',
    })

    expect(result.status).toBe('claimed')
    if (result.status === 'claimed') {
      expect(result.report).toEqual(mockReport)
    }
  })

  it('既に claim 済みのレポートは already_claimed を返す', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        ...mockReport,
        user_id: 'user-a',
        push_notified_at: '2026-03-21T12:34:56.000Z',
      },
      error: null,
    })
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ maybeSingle }),
          }),
        }),
      }),
    } as any)

    const result = await claimDangerReportForNotification({
      reportId: 'report-1',
      userId: 'user-a',
    })

    expect(result).toEqual({ status: 'already_claimed' })
  })
})

describe('releaseDangerReportNotificationClaim', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('claim timestamp が一致した場合のみ解放する', async () => {
    const eqClaimedAt = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: eqClaimedAt,
          }),
        }),
      }),
    } as any)

    await releaseDangerReportNotificationClaim({
      reportId: 'report-1',
      claimedAt: '2026-03-21T12:34:56.000Z',
    })

    expect(eqClaimedAt).toHaveBeenCalledWith(
      'push_notified_at',
      '2026-03-21T12:34:56.000Z'
    )
  })
})
