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

import { createClient } from '@supabase/supabase-js'
import { findDangersNearRoute } from '@/lib/geo/route-danger-finder'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { sendPushToUser } from '@/lib/web-push'
import { notifyUsersNearReport, type DangerReportLocation } from '@/lib/push-notifications/notify-danger-report'

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
