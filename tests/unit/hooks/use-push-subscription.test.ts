import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// グローバルモック
const mockGetSubscription = vi.fn()
const mockSubscribe = vi.fn()
const mockUnsubscribe = vi.fn()
const mockRequestPermission = vi.fn()
const mockRegister = vi.fn()
const mockReady = Promise.resolve({
  pushManager: {
    getSubscription: mockGetSubscription,
    subscribe: mockSubscribe,
  },
})

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
    ready: mockReady,
  },
  writable: true,
})

Object.defineProperty(global, 'PushManager', {
  value: class PushManager {},
  writable: true,
})

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) })

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = 'test-vapid-public-key'
  })

  it('初期状態でサブスクリプションがなければ unsubscribed になる', async () => {
    mockGetSubscription.mockResolvedValueOnce(null)

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
    mockGetSubscription.mockResolvedValueOnce(mockSub)

    const { usePushSubscription } = await import('@/hooks/use-push-subscription')
    const { result } = renderHook(() => usePushSubscription())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })

    expect(result.current.state).toBe('subscribed')
  })
})
