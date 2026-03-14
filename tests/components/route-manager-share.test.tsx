import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef, useImperativeHandle, type ReactNode } from 'react'

import { RouteManager } from '@/components/map/route-manager'
import { mockRoutes, mockPrimaryRoute } from '../fixtures/routes'

const toastMock = vi.fn()

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
    toast: toastMock,
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

describe('RouteManager share flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: vi.fn().mockResolvedValue(undefined),
    })
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('uses the mobile share sheet when navigator.share is available', async () => {
    render(<RouteManager />)

    await userEvent.click(screen.getAllByTestId('share-route-button')[0])

    expect(window.navigator.share).toHaveBeenCalledTimes(1)
    expect(window.navigator.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: mockRoutes[0].name,
        text: expect.stringContaining('更新日時'),
      })
    )
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '共有シートを開きました',
      })
    )
  })

  it('copies the route summary when navigator.share is unavailable', async () => {
    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: undefined,
    })

    render(<RouteManager />)

    await userEvent.click(screen.getAllByTestId('share-route-button')[0])

    expect(window.navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining(mockRoutes[0].name)
    )
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '共有内容をコピーしました',
      })
    )
  })
})
