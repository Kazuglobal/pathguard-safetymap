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
  default: () => <div data-testid="map-style-selector" />,
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
    expect(screen.getByTestId('map-style-selector')).toBeInTheDocument()
  })

  it('shows bottom-right mobile action dock in normal state', () => {
    renderControls()

    expect(screen.getByTestId('mobile-action-dock')).toHaveStyle({
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5rem)',
    })
    expect(screen.getByRole('button', { name: '危険地点一覧を開く' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '危険箇所を報告する' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '現在地で報告' })).toBeInTheDocument()
  })

  it('hides mobile action dock while location selection is active', () => {
    renderControls({ isSelectingLocation: true })

    expect(screen.queryByRole('button', { name: '危険箇所を報告する' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '現在地で報告' })).not.toBeInTheDocument()
  })

  it('hides mobile action dock when heatmap is visible', () => {
    renderControls({ isHeatmapVisible: true })

    expect(screen.queryByRole('button', { name: '危険箇所を報告する' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '現在地で報告' })).not.toBeInTheDocument()
  })

  it('does not render the bottom legend on mobile', () => {
    renderControls()

    expect(screen.queryByTitle('交通危険')).not.toBeInTheDocument()
  })
})
