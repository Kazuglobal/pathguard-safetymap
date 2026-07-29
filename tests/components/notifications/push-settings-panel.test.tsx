import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/hooks/use-push-subscription', () => ({
  usePushSubscription: vi.fn(),
}))

vi.mock('@/lib/pwa-install', () => ({
  shouldShowIosInstallGuide: vi.fn(),
}))

import { usePushSubscription } from '@/hooks/use-push-subscription'
import { shouldShowIosInstallGuide } from '@/lib/pwa-install'
import { PushSettingsPanel } from '@/components/notifications/push-settings-panel'

const defaultPrefs = { danger_reports: true, news: true, magazine: true, local_alerts: true }

describe('PushSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(shouldShowIosInstallGuide).mockReturnValue(false)
  })

  it('loading状態でスケルトンを表示する', () => {
    vi.mocked(usePushSubscription).mockReturnValue({
      state: 'loading',
      preferences: defaultPrefs,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
    })

    const { container } = render(<PushSettingsPanel />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('unsupported状態で非対応メッセージを表示する', () => {
    vi.mocked(usePushSubscription).mockReturnValue({
      state: 'unsupported',
      preferences: defaultPrefs,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
    })

    render(<PushSettingsPanel />)
    expect(screen.getByText(/対応していません/)).toBeInTheDocument()
  })

  it('unsupported状態でもiOSブラウザ閲覧なら「ホーム画面に追加」の案内を表示する', () => {
    vi.mocked(shouldShowIosInstallGuide).mockReturnValue(true)
    vi.mocked(usePushSubscription).mockReturnValue({
      state: 'unsupported',
      preferences: defaultPrefs,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
    })

    render(<PushSettingsPanel />)
    expect(screen.getByText(/ホーム画面に追加/)).toBeInTheDocument()
    expect(screen.queryByText(/対応していません/)).not.toBeInTheDocument()
  })

  it('denied状態でブロックメッセージを表示する', () => {
    vi.mocked(usePushSubscription).mockReturnValue({
      state: 'denied',
      preferences: defaultPrefs,
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
    })

    render(<PushSettingsPanel />)
    expect(screen.getByText(/ブロック/)).toBeInTheDocument()
  })

  it('unsubscribed状態で許可ボタンを表示する', () => {
    const mockSubscribe = vi.fn()
    vi.mocked(usePushSubscription).mockReturnValue({
      state: 'unsubscribed',
      preferences: defaultPrefs,
      subscribe: mockSubscribe,
      unsubscribe: vi.fn(),
      updatePreferences: vi.fn(),
    })

    render(<PushSettingsPanel />)
    const btn = screen.getByText('通知を許可する')
    fireEvent.click(btn)
    expect(mockSubscribe).toHaveBeenCalled()
  })

  it('subscribed状態でトグルスイッチと解除ボタンを表示する', () => {
    const mockUnsubscribe = vi.fn()
    vi.mocked(usePushSubscription).mockReturnValue({
      state: 'subscribed',
      preferences: defaultPrefs,
      subscribe: vi.fn(),
      unsubscribe: mockUnsubscribe,
      updatePreferences: vi.fn(),
    })

    render(<PushSettingsPanel />)
    expect(screen.getByText('危険レポートアラート')).toBeInTheDocument()
    expect(screen.getByText('通学路ニュース')).toBeInTheDocument()
    expect(screen.getByText('安全マガジン')).toBeInTheDocument()

    fireEvent.click(screen.getByText('通知を解除する'))
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
