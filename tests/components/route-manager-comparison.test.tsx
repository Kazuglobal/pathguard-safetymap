import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef, useImperativeHandle, type ReactNode } from 'react'

import { RouteManager } from '@/components/map/route-manager'
import { mockRoutes, mockPrimaryRoute } from '../fixtures/routes'

vi.mock('@/hooks/use-user-routes', () => ({
  useUserRoutes: vi.fn(() => ({
    routes: mockRoutes,
    primaryRoute: mockPrimaryRoute,
    isLoading: false,
    error: null,
    addRoute: vi.fn(),
    updateRoute: vi.fn(),
    deleteRoute: vi.fn(),
    setPrimaryRoute: vi.fn(),
    refreshRoutes: vi.fn(),
  })),
}))

vi.mock('@/components/ui/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}))

vi.mock('react-map-gl/mapbox', () => ({
  default: forwardRef(function MockMap(
    { children }: { children?: ReactNode },
    ref
  ) {
    useImperativeHandle(ref, () => ({
      flyTo: vi.fn(),
      getMap: () => ({
        dragPan: {
          disable: vi.fn(),
          enable: vi.fn(),
        },
      }),
    }))

    return <div data-testid="mock-map">{children}</div>
  }),
  Layer: () => null,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

describe('RouteManager comparison', () => {
  it('shows a comparison section after selecting two routes', async () => {
    render(<RouteManager />)

    const compareButtons = screen.getAllByTestId('compare-route-button')
    await userEvent.click(compareButtons[0])
    await userEvent.click(compareButtons[1])

    const comparisonTable = screen.getByTestId('route-comparison-table')
    expect(comparisonTable).toBeInTheDocument()
    expect(within(comparisonTable).getByText('通学路A（主要ルート）')).toBeInTheDocument()
    expect(within(comparisonTable).getByText('通学路B（雨の日用）')).toBeInTheDocument()
    expect(within(comparisonTable).getByText('おすすめ')).toBeInTheDocument()
  }, 15000)
})
