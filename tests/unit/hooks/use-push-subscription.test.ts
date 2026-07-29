import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// グローバルモック
const mockGetSubscription = vi.fn()
const mockSubscribe = vi.fn()
const mockUnsubscribe = vi.fn()
const mockRequestPermission = vi.fn()
const mockRegister = vi.fn()
const mockGetRegistration = vi.fn()
// 実ブラウザの仕様どおり「SWが有効化されるまで永久に解決しないPromise」として振る舞わせる。
// 解決済みPromiseにすると、readyを無条件に await する旧実装(loading固定バグ)でも
// テストが通ってしまい、回帰を検出できない
const mockReady = new Promise<never>(() => {})

Object.defineProperty(global, 'Notification', {
  value: {
    permission: 'default',
    requestPermission: mockRequestPermission,
  },
  writable: true,
})

Object.defineProperty(global.navigator, 'serviceWorker', {
  value: {
    register: mockRegister,
    getRegistration: mockGetRegistration,
    ready: mockReady,
  },
  writable: true,
})

Object.defineProperty(global, 'PushManager', {
  value: class PushManager {},
  writable: true,
})

global.fetch = vi.fn()

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-vapid-public-key'
    mockGetRegistration.mockResolvedValue(null)
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } as any)
  })

  it('SW未登録(getRegistrationがnull)でも unsubscribed になる — ready待ちでloading固定にならない回帰テスト', async () => {
    // beforeEach で mockGetRegistration は null を返す =
    // 一度も購読していない新規ユーザーの状態。
    // 旧実装は navigator.serviceWorker.ready を await していたため
    // この状態で永久に 'loading' のままになり、通知許可UIが表示されなかった
    const { usePushSubscription } = await import('@/hooks/use-push-subscription')
    const { result } = renderHook(() => usePushSubscription())

    // 初期は loading
    expect(result.current.state).toBe('loading')

    // 非同期処理待ち
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(result.current.state).toBe('unsubscribed')
  })

  it('既存サブスクリプションがあれば subscribed になる', async () => {
    const mockSub = {
      endpoint: 'https://example.com/push',
      toJSON: () => ({ keys: { p256dh: 'key', auth: 'secret' } }),
    }
    mockGetRegistration.mockResolvedValueOnce({
      pushManager: {
        getSubscription: mockGetSubscription,
        subscribe: mockSubscribe,
      },
    })
    mockGetSubscription.mockResolvedValueOnce(mockSub)
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        subscribed: true,
        preferences: {
          danger_reports: false,
          news: true,
          magazine: false,
        },
      }),
    } as any)

    const { usePushSubscription } = await import('@/hooks/use-push-subscription')
    const { result } = renderHook(() => usePushSubscription())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(result.current.state).toBe('subscribed')
    // 保存済みの値を反映しつつ、後から追加されたキーはデフォルト(true)で補完される
    expect(result.current.preferences).toEqual({
      danger_reports: false,
      news: true,
      magazine: false,
      local_alerts: true,
      daily_digest: true,
    })
  })

  it('通知設定更新 API が失敗した場合は optimistic update をロールバックする', async () => {
    const mockSub = {
      endpoint: 'https://example.com/push',
      toJSON: () => ({ keys: { p256dh: 'key', auth: 'secret' } }),
    }
    mockGetRegistration.mockResolvedValueOnce({
      pushManager: {
        getSubscription: mockGetSubscription,
        subscribe: mockSubscribe,
      },
    })
    mockGetSubscription.mockResolvedValueOnce(mockSub)
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          subscribed: true,
          preferences: {
            danger_reports: true,
            news: true,
            magazine: true,
          },
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as any)

    const { usePushSubscription } = await import('@/hooks/use-push-subscription')
    const { result } = renderHook(() => usePushSubscription())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    await act(async () => {
      await result.current.updatePreferences({ news: false })
    })

    expect(result.current.preferences).toEqual({
      danger_reports: true,
      news: true,
      magazine: true,
      local_alerts: true,
      daily_digest: true,
    })
  })

  it('SWが有効化されない場合でも subscribe はタイムアウトして返る(ボタンが無限ハングしない)', async () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mockRequestPermission.mockResolvedValue('granted')
      mockRegister.mockResolvedValue({})
      // navigator.serviceWorker.ready は永久pending(モック定義どおり)

      const { usePushSubscription } = await import('@/hooks/use-push-subscription')
      const { result } = renderHook(() => usePushSubscription())

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20)
      })
      expect(result.current.state).toBe('unsubscribed')

      let settled = false
      let subscribePromise: Promise<void> = Promise.resolve()
      act(() => {
        subscribePromise = result.current.subscribe().then(() => {
          settled = true
        })
      })

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })
      await act(async () => {
        await subscribePromise
      })

      expect(settled).toBe(true)
      expect(result.current.state).toBe('unsubscribed')
      expect(errorSpy).toHaveBeenCalledWith('[push] subscribe error', expect.any(Error))
    } finally {
      errorSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it('地域変更時に既存push subscriptionのprefectureを同期する', async () => {
    const mockSub = {
      endpoint: 'https://example.com/push',
      toJSON: () => ({ keys: { p256dh: 'key', auth: 'secret' } }),
    }
    mockGetRegistration.mockResolvedValueOnce({
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(mockSub),
      },
    })
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          subscribed: true,
          preferences: {
            danger_reports: false,
            news: true,
            magazine: true,
            local_alerts: true,
            daily_digest: false,
          },
        }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ updated: true }),
      } as any)

    const { syncPushSubscriptionRegion } = await import('@/hooks/use-push-subscription')
    await syncPushSubscriptionRegion('東京都')

    expect(mockGetRegistration).toHaveBeenCalledWith()
    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      `/api/push/subscribe?endpoint=${encodeURIComponent(mockSub.endpoint)}`
    )
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/push/subscribe',
      expect.objectContaining({ method: 'PATCH' })
    )

    const body = JSON.parse((vi.mocked(global.fetch).mock.calls[1][1] as RequestInit).body as string)
    expect(body).toEqual({
      endpoint: mockSub.endpoint,
      prefecture: '東京都',
      preferences: {
        danger_reports: false,
        news: true,
        magazine: true,
        local_alerts: true,
        daily_digest: false,
      },
    })
  })
})
