import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import MapFloatingControls from '@/components/map/map-floating-controls'

vi.mock('@/hooks/use-gamification', () => ({
  useGamification: () => ({ points: 120, level: 3 }),
}))

vi.mock('@/components/map/help-dialog', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/map/map-style-selector', () => ({
  default: ({ buttonLabel = '地図スタイル' }: { buttonLabel?: string }) => (
    <button type="button" data-testid="map-style-selector">
      {buttonLabel}
    </button>
  ),
}))

vi.mock('@/components/map/map-3d-toggle', () => ({
  default: () => <button type="button">3D</button>,
}))

function renderControls(overrides: Partial<ComponentProps<typeof MapFloatingControls>> = {}) {
  const baseProps: ComponentProps<typeof MapFloatingControls> = {
    onAddReport: vi.fn(),
    isReportFormOpen: false,
    mapStyle: 'streets-v12',
    setMapStyle: vi.fn(),
    is3DEnabled: false,
    toggle3DMode: vi.fn(),
    isSelectingLocation: false,
    onToggleAR: vi.fn(),
    isARMode: false,
    onToggleSidebar: vi.fn(),
    isMobile: true,
    onReportAtCurrentLocation: vi.fn(),
    isAcquiringGPS: false,
    onToggleHeatmap: vi.fn(),
    isHeatmapVisible: false,
  }

  return render(<MapFloatingControls {...baseProps} {...overrides} />)
}

describe('MapFloatingControls mobile layout', () => {
  it('shows a lower-right display dock when not mobile', () => {
    renderControls({ isMobile: false })

    expect(screen.getByTestId('map-display-dock')).toBeInTheDocument()
    expect(screen.getByTestId('map-display-dock')).toHaveStyle({
      bottom: '5.75rem',
    })
    expect(screen.getByTestId('map-style-selector')).toBeInTheDocument()
  })

  it('keeps the map style selector available on mobile', () => {
    renderControls()

    expect(screen.getByTestId('map-display-dock')).toBeInTheDocument()
    expect(screen.getByTestId('map-display-dock')).toHaveStyle({
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 10.5rem)',
    })
    expect(screen.getByRole('button', { name: '表示' })).toBeInTheDocument()
  })

  it('shows bottom-right mobile action dock in normal state', () => {
    renderControls()

    expect(screen.getByTestId('mobile-action-dock')).toHaveStyle({
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
    })
    expect(screen.getByRole('button', { name: '危険地点一覧を開く' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '危険箇所を報告する' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '現在地で報告' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '危険箇所を報告する' })).toHaveTextContent('報告')
  })

  it('shows a focused dock while the report form is open', () => {
    // 地点選択中は下部確認バー（ポータル）が案内するため、フォーカスドックは
    // 報告フォーム表示中（isReportFormOpen）にのみ描画される仕様へ変更された。
    renderControls({ isReportFormOpen: true })

    expect(screen.getByTestId('mobile-focused-dock')).toBeInTheDocument()
    expect(screen.getByText('報告内容を入力中')).toBeInTheDocument()
    expect(screen.getByText('内容を確認して送信してね')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '危険箇所を報告する' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '危険地点一覧を開く' })).not.toBeInTheDocument()
  })

  it('keeps mobile actions available when heatmap is visible', () => {
    renderControls({ isHeatmapVisible: true })

    expect(screen.getByTestId('mobile-action-dock')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '危険箇所を報告する' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '現在地で報告' })).toBeInTheDocument()
  })

  it('does not render the bottom legend on mobile', () => {
    renderControls()

    expect(screen.queryByTitle('交通危険')).not.toBeInTheDocument()
  })
})
