import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/hooks/use-push-subscription', () => ({
  usePushSubscription: vi.fn(),
}))

import { usePushSubscription } from '@/hooks/use-push-subscription'
import { PushPermissionPrompt } from '@/components/notifications/push-permission-prompt'

const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage, writable: true })

describe('PushPermissionPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
  })

  it('未購読状態で未却下なら表示される', () => {
    vi.mocked(usePushSubscription).mockReturnValue({
      state: 'unsubscribed',
      preferences: { danger_reports: true, news: true, magazine: true, local_alerts: true },
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
    })

    render(<PushPermissionPrompt />)
    expect(screen.getByText('通知を許可する')).toBeInTheDocument()
  })

  it('却下済みなら表示されない', () => {
    mockLocalStorage.setItem('push_prompt_dismissed', '1')
    vi.mocked(usePushSubscription).mockReturnValue({
      state: 'unsubscribed',
      preferences: { danger_reports: true, news: true, magazine: true, local_alerts: true },
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
    })

    render(<PushPermissionPrompt />)
    expect(screen.queryByText('通知を許可する')).not.toBeInTheDocument()
  })

  it('購読済みの場合は表示されない', () => {
    vi.mocked(usePushSubscription).mockReturnValue({
      state: 'subscribed',
      preferences: { danger_reports: true, news: true, magazine: true, local_alerts: true },
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
    })

    render(<PushPermissionPrompt />)
    expect(screen.queryByText('通知を許可する')).not.toBeInTheDocument()
  })

  it('閉じるボタンで非表示になり localStorage に保存される', () => {
    vi.mocked(usePushSubscription).mockReturnValue({
      state: 'unsubscribed',
      preferences: { danger_reports: true, news: true, magazine: true, local_alerts: true },
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
    })

    render(<PushPermissionPrompt />)
    fireEvent.click(screen.getByLabelText('閉じる'))

    expect(screen.queryByText('通知を許可する')).not.toBeInTheDocument()
    expect(mockLocalStorage.getItem('push_prompt_dismissed')).toBe('1')
  })
})
