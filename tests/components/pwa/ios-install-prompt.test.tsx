import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/pwa-install', () => ({
  shouldShowIosInstallGuide: vi.fn(),
}))

import { shouldShowIosInstallGuide } from '@/lib/pwa-install'
import { IosInstallPrompt } from '@/components/pwa/ios-install-prompt'

const DISMISSED_KEY = 'ios_install_prompt_dismissed'

describe('IosInstallPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('iOSブラウザ閲覧(非standalone)では案内を表示する', () => {
    vi.mocked(shouldShowIosInstallGuide).mockReturnValue(true)

    render(<IosInstallPrompt />)

    expect(
      screen.getByText('ホーム画面に追加すると通知が受け取れます')
    ).toBeInTheDocument()
    expect(screen.getByText(/「ホーム画面に追加」を選択/)).toBeInTheDocument()
  })

  it('iOS以外・standalone起動では何も表示しない', () => {
    vi.mocked(shouldShowIosInstallGuide).mockReturnValue(false)

    const { container } = render(<IosInstallPrompt />)

    expect(container).toBeEmptyDOMElement()
  })

  it('閉じると非表示になり、dismiss状態が保存される', () => {
    vi.mocked(shouldShowIosInstallGuide).mockReturnValue(true)

    const { container } = render(<IosInstallPrompt />)
    fireEvent.click(screen.getByLabelText('閉じる'))

    expect(container).toBeEmptyDOMElement()
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1')
  })

  it('一度dismissしていたら表示しない', () => {
    vi.mocked(shouldShowIosInstallGuide).mockReturnValue(true)
    localStorage.setItem(DISMISSED_KEY, '1')

    const { container } = render(<IosInstallPrompt />)

    expect(container).toBeEmptyDOMElement()
  })
})
