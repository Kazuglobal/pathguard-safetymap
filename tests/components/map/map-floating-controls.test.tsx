import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import MapFloatingControls from '@/components/map/map-floating-controls'
import { SHORT_MAP_SCREEN_QUERY } from '@/lib/map/empty-area-notice'

vi.mock('@/hooks/use-gamification', () => ({
  useGamification: () => ({ points: 120, level: 3 }),
}))

vi.mock('@/components/map/map-3d-toggle', () => ({
  default: () => <button type="button">3D</button>,
}))

function renderControls(overrides: Partial<ComponentProps<typeof MapFloatingControls>> = {}) {
  const baseProps: ComponentProps<typeof MapFloatingControls> = {
    onAddReport: vi.fn(),
    isReportFormOpen: false,
    isSelectingLocation: false,
    onToggleSidebar: vi.fn(),
    isMobile: true,
    onReportAtCurrentLocation: vi.fn(),
    isAcquiringGPS: false,
  }

  return render(<MapFloatingControls {...baseProps} {...overrides} />)
}

describe('MapFloatingControls mobile layout', () => {
  // 地図の見た目と重ねる情報は、上の「くわしい表示」の中に移した(UIUX改装 項目9・10)
  it('no longer shows the lower-right display dock (it moved into 「くわしい表示」)', () => {
    for (const isMobile of [true, false]) {
      const { unmount } = renderControls({ isMobile })
      expect(screen.queryByTestId('map-display-dock')).not.toBeInTheDocument()
      expect(screen.queryByTestId('map-style-selector')).not.toBeInTheDocument()
      unmount()
    }
  })

  it('shows bottom-right mobile action dock in normal state', () => {
    renderControls()

    expect(screen.getByTestId('mobile-action-dock')).toHaveStyle({
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)',
    })
    expect(screen.getByRole('button', { name: '危険地点一覧を開く' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '危険を報告する' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '現在地で報告' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '危険を報告する' })).toHaveTextContent('報告')
  })

  it('shows a focused dock while the report form is open', () => {
    // 地点選択中は下部確認バー（ポータル）が案内するため、フォーカスドックは
    // 報告フォーム表示中（isReportFormOpen）にのみ描画される仕様へ変更された。
    renderControls({ isReportFormOpen: true })

    expect(screen.getByTestId('mobile-focused-dock')).toBeInTheDocument()
    expect(screen.getByText('報告内容を入力中')).toBeInTheDocument()
    expect(screen.getByText('内容を確認して送信してね')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '危険を報告する' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '危険地点一覧を開く' })).not.toBeInTheDocument()
  })


  it('does not render the bottom legend on mobile', () => {
    renderControls()

    expect(screen.queryByTestId('map-legend-compact')).not.toBeInTheDocument()
  })

  it('offers the legend behind a button on mobile', () => {
    renderControls()

    expect(screen.getByRole('button', { name: 'ピンの見方を表示' })).toBeInTheDocument()
  })

  // 報告の入口は、どこから入っても「危険を報告する」(UIUX改装 項目5)
  it('names the desktop report button 「危険を報告する」, like every other entry', () => {
    renderControls({ isMobile: false })

    expect(screen.getByRole('button', { name: '危険を報告する' })).toHaveTextContent('危険を報告する')
  })

  it('shows the always-visible legend on desktop instead of the button', () => {
    renderControls({ isMobile: false })

    expect(screen.getByTestId('map-legend-compact')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ピンの見方を表示' })).not.toBeInTheDocument()
  })
})

// 右上のポイント表示と「ピンの見方」が、上の列(検索・通学路チェック・くわしい表示)と重ならないように
describe('MapFloatingControls corner badges', () => {
  const FOLDED = [
    'top-[calc(env(safe-area-inset-top,0px)+8.5rem)]',
    'md:top-[calc(env(safe-area-inset-top,0px)+12.5rem)]',
    'lg:top-[calc(env(safe-area-inset-top,0px)+7.75rem)]',
  ]
  const UNFOLDED = [
    'top-[calc(env(safe-area-inset-top,0px)+12.5rem)]',
    'md:top-[calc(env(safe-area-inset-top,0px)+16.5rem)]',
    'lg:top-[calc(env(safe-area-inset-top,0px)+7.75rem)]',
  ]

  it('sits just below the top rows, and moves below 「くわしい表示」 while that row is out', () => {
    const { unmount } = renderControls()
    expect(screen.getByTestId('map-utilities')).toHaveClass(...FOLDED)
    unmount()

    renderControls({ isTopDetailsOpen: true })
    const badges = screen.getByTestId('map-utilities')
    expect(badges).toHaveClass(...UNFOLDED)
    expect(badges).not.toHaveClass(FOLDED[0], FOLDED[1])
    expect(within(badges).getByRole('button', { name: 'ピンの見方を表示' })).toBeInTheDocument()
  })

  it('steps aside on phones while the empty-area notice is up, keeping the bottom dock', () => {
    renderControls({ isEmptyAreaNoticeVisible: true })

    expect(screen.queryByTestId('map-utilities')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ピンの見方を表示' })).not.toBeInTheDocument()
    expect(screen.getByTestId('mobile-action-dock')).toBeInTheDocument()
  })

  it('stays on wider screens, where the notice sits in the middle away from the corner', () => {
    renderControls({ isMobile: false, isEmptyAreaNoticeVisible: true })

    expect(screen.getByTestId('map-utilities')).toHaveTextContent('120')
  })

  // 横向きのスマホなど、低い画面では2つを横に並べて、下の操作の列にかからないようにする
  it('lines the two badges up side by side on short screens, at the same height as the empty-area notice rule', () => {
    renderControls({ isTopDetailsOpen: true })

    expect(screen.getByTestId('map-utilities')).toHaveClass(
      '[@media(max-height:499px)]:flex-row',
      '[@media(max-height:499px)]:items-center',
    )
    expect(SHORT_MAP_SCREEN_QUERY).toBe('(max-height: 499px)')
  })
})

describe('MapFloatingControls mobile menu (bottom tab bar is hidden on the map)', () => {
  it('opens a menu with the other screens from the action dock', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()
    renderControls()

    await user.click(screen.getByRole('button', { name: 'メニューを開く' }))

    const screens = await screen.findByRole('navigation', { name: 'ほかの画面' })
    const links = within(screens).getAllByRole('link')
    expect(links.map((link) => [link.getAttribute('aria-label'), link.getAttribute('href')])).toEqual([
      ['ホーム', '/landing'],
      ['きけんハンター', '/safety-quest/hunter'],
      ['通学路', '/routes'],
      ['マイページ', '/mypage'],
      ['報告一覧', '/report'],
    ])
    // 全画面の地図には共通のフッターが無いので、規約などのリンクをメニューに出す(UIUX改装 項目32)
    const siteInfo = screen.getByRole('navigation', { name: 'サイトの情報' })
    expect(within(siteInfo).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/terms',
      '/privacy',
      '/contact',
      'https://www.instagram.com/kiken_hunter_jp/',
    ])
  })

  it('does not show the menu button on desktop, where the top navigation stays', () => {
    renderControls({ isMobile: false })
    expect(screen.queryByRole('button', { name: 'メニューを開く' })).not.toBeInTheDocument()
  })
})
