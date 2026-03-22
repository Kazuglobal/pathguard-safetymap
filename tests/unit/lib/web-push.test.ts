import { describe, it, expect, vi, beforeEach } from 'vitest'

// web-push モック
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(),
  },
}))

// Supabase adminモック
vi.mock('@/lib/supabase-admin', () => ({
  getSupabaseAdmin: vi.fn(),
}))

import webpush from 'web-push'
import { getSupabaseAdmin } from '@/lib/supabase-admin'
import type { PushSubscriptionRow } from '@/lib/web-push'
import type { PushPayload } from '@/lib/notifications/builders'

// テスト用にモジュールを動的インポートで読み込む（VAPID設定後）
const mockSub: PushSubscriptionRow = {
  id: 'sub-1',
  user_id: 'user-1',
  endpoint: 'https://example.com/push/123',
  p256dh: 'p256dh-key',
  auth: 'auth-secret',
  notification_preferences: {
    danger_reports: true,
    news: true,
    magazine: true,
  },
  last_notified_at: null,
}

const mockPayload: PushPayload = {
  title: 'テスト通知',
  body: 'テスト本文',
  icon: '/apple-touch-icon.png',
  badge: '/apple-touch-icon.png',
  tag: 'test-tag',
  data: { url: '/map', type: 'danger_reports' },
}

describe('sendPushNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key'
    process.env.VAPID_PRIVATE_KEY = 'test-private-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })

  it('成功時は { success: true } を返す', async () => {
    vi.mocked(webpush.sendNotification).mockResolvedValueOnce({} as any)

    const { sendPushNotification } = await import('@/lib/web-push')
    const result = await sendPushNotification(mockSub, mockPayload)

    expect(result).toEqual({ success: true })
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: mockSub.endpoint, keys: { p256dh: mockSub.p256dh, auth: mockSub.auth } },
      JSON.stringify(mockPayload)
    )
  })

  it('410エラー時はサブスクリプションを削除して { success: false, removed: true } を返す', async () => {
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({ delete: mockDelete }),
    } as any)

    const error = Object.assign(new Error('Gone'), { statusCode: 410 })
    vi.mocked(webpush.sendNotification).mockRejectedValueOnce(error)

    const { sendPushNotification } = await import('@/lib/web-push')
    const result = await sendPushNotification(mockSub, mockPayload)

    expect(result).toEqual({ success: false, removed: true })
  })

  it('VAPID鍵未設定時は sendNotification を呼ばずに { success: false } を返す', async () => {
    // モジュールは既にインポート済みで VAPID_PUBLIC_KEY チェックはランタイムに行われる
    // 一時的に環境変数を削除してテスト
    const origPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const origPriv = process.env.VAPID_PRIVATE_KEY
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY

    // モジュールを再インポートしてフレッシュな状態で確認
    vi.resetModules()
    const { sendPushNotification: freshFn } = await import('@/lib/web-push')
    const result = await freshFn(mockSub, mockPayload)

    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = origPub
    process.env.VAPID_PRIVATE_KEY = origPriv

    expect(result).toEqual({ success: false })
  })
})

describe('sendPushToUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-public-key'
    process.env.VAPID_PRIVATE_KEY = 'test-private-key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
  })

  it('preferenceがfalseのサブスクリプションをスキップする', async () => {
    const subsWithDisabledPref = [
      { ...mockSub, notification_preferences: { danger_reports: false, news: true, magazine: true } },
    ]
    const mockSelect = vi.fn().mockResolvedValue({ data: subsWithDisabledPref, error: null })
    const mockFrom = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockSelect }) })
    vi.mocked(getSupabaseAdmin).mockReturnValue({ from: mockFrom } as any)

    const { sendPushToUser } = await import('@/lib/web-push')
    const count = await sendPushToUser('user-1', mockPayload, 'danger_reports')

    expect(count).toBe(0)
    expect(webpush.sendNotification).not.toHaveBeenCalled()
  })
})
