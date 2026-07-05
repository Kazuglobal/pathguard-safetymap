import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn(),
}))

vi.mock('@/lib/push-notifications/notify-danger-report', () => ({
  claimDangerReportForNotification: vi.fn(),
  releaseDangerReportNotificationClaim: vi.fn(),
  notifyUsersNearReport: vi.fn(),
}))

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import {
  claimDangerReportForNotification,
  releaseDangerReportNotificationClaim,
  notifyUsersNearReport,
} from '@/lib/push-notifications/notify-danger-report'

function makeRequest(secret = 'test-secret') {
  return new NextRequest('http://localhost/api/cron/push-danger-reports', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  })
}

describe('GET /api/cron/push-danger-reports', () => {
  const originalVercel = process.env.VERCEL

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    // verifyCronSecret は Vercel 環境外では認証をスキップするため、
    // 認証ロジックを検証するテストでは VERCEL を立てて本番相当の分岐を通す。
    process.env.VERCEL = '1'
  })

  afterEach(() => {
    if (originalVercel === undefined) {
      delete process.env.VERCEL
    } else {
      process.env.VERCEL = originalVercel
    }
  })

  it('CRON_SECRET 認証が通らない場合は401を返す', async () => {
    const { GET } = await import('@/app/api/cron/push-danger-reports/route')
    const res = await GET(makeRequest('wrong-secret'))
    expect(res.status).toBe(401)
  })

  it('未通知レポートのみ処理し、claim できないレポートは skip する', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        { id: 'report-1' },
        { id: 'report-2' },
      ],
      error: null,
    })
    const is = vi.fn().mockReturnValue({ order })
    const gte = vi.fn().mockReturnValue({ is })
    const select = vi.fn().mockReturnValue({ gte })
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    } as any)

    vi.mocked(claimDangerReportForNotification)
      .mockResolvedValueOnce({
        status: 'claimed',
        claimedAt: '2026-03-21T12:34:56.000Z',
        report: {
          id: 'report-1',
          title: '初回通知',
          latitude: 35.6812,
          longitude: 139.7671,
        },
      })
      .mockResolvedValueOnce({
        status: 'already_claimed',
      })
    vi.mocked(notifyUsersNearReport).mockResolvedValue(2)

    const { GET } = await import('@/app/api/cron/push-danger-reports/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      processed: 2,
      notified: 2,
      failed: 0,
      skipped: 1,
    })
    expect(is).toHaveBeenCalledWith('push_notified_at', null)
  })

  it('送信中の例外では claim を解放し failed を加算する', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'report-1' }],
      error: null,
    })
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({ order }),
          }),
        }),
      }),
    } as any)

    vi.mocked(claimDangerReportForNotification).mockResolvedValue({
      status: 'claimed',
      claimedAt: '2026-03-21T12:34:56.000Z',
      report: {
        id: 'report-1',
        title: '失敗通知',
        latitude: 35.6812,
        longitude: 139.7671,
      },
    })
    vi.mocked(notifyUsersNearReport).mockRejectedValue(new Error('boom'))

    const { GET } = await import('@/app/api/cron/push-danger-reports/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      processed: 1,
      notified: 0,
      failed: 1,
      skipped: 0,
    })
    expect(releaseDangerReportNotificationClaim).toHaveBeenCalledWith({
      reportId: 'report-1',
      claimedAt: '2026-03-21T12:34:56.000Z',
    })
  })

  it('claim 取得エラーは failed として扱う', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'report-1' }],
      error: null,
    })
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({ order }),
          }),
        }),
      }),
    } as any)

    vi.mocked(claimDangerReportForNotification).mockRejectedValue(new Error('db down'))

    const { GET } = await import('@/app/api/cron/push-danger-reports/route')
    const res = await GET(makeRequest())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      processed: 1,
      notified: 0,
      failed: 1,
      skipped: 0,
    })
  })
})
