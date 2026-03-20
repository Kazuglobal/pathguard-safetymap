import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef, useImperativeHandle, type ReactNode } from 'react'

import { RouteManager } from '@/components/map/route-manager'
import { shareFamilyShareCard } from '@/lib/report-generation/family-share-card'
import { mockRoutes, mockPrimaryRoute } from '../fixtures/routes'

const toastMock = vi.fn()

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    toBlob: (callback: (blob: Blob | null) => void) =>
      callback(new Blob(['family-share-card'], { type: 'image/png' })),
  })),
}))

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

  it('shares a family share card image when navigator.share can accept files', async () => {
    const cardElement = document.createElement('div')
    cardElement.textContent = '家族共有カード'
    document.body.appendChild(cardElement)

    const canShare = vi.fn(() => true)
    Object.defineProperty(window.navigator, 'canShare', {
      configurable: true,
      value: canShare,
    })

    await shareFamilyShareCard({
      cardElement,
      card: {
        title: '見通しの悪い交差点',
        summary: '小学生の目線では車が急に見える',
        action: '白線の内側を歩く',
        mapLabel: '東京・千代田区',
        imageUrl: '/hazard.png',
      },
    })

    expect(canShare).toHaveBeenCalled()
    expect(window.navigator.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '見通しの悪い交差点',
        files: expect.any(Array),
      }),
    )
  })

  it('downloads and copies share text when navigator.share is unavailable', async () => {
    const cardElement = document.createElement('div')
    cardElement.textContent = '家族共有カード'
    document.body.appendChild(cardElement)

    const originalCreateElement = document.createElement.bind(document)
    const anchor = originalCreateElement('a')
    const clickMock = vi.spyOn(anchor, 'click').mockImplementation(() => {})
    const removeMock = vi.spyOn(anchor, 'remove').mockImplementation(() => {})
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation(((tagName: string) => {
        if (tagName === 'a') {
          return anchor
        }
        return originalCreateElement(tagName)
      }) as typeof document.createElement)

    Object.defineProperty(window.navigator, 'share', {
      configurable: true,
      value: undefined,
    })
    Object.defineProperty(window, 'URL', {
      configurable: true,
      value: {
        createObjectURL: vi.fn(() => 'blob:test'),
        revokeObjectURL: vi.fn(),
      },
    })

    await shareFamilyShareCard({
      cardElement,
      card: {
        title: '見通しの悪い交差点',
        summary: '小学生の目線では車が急に見える',
        action: '白線の内側を歩く',
        mapLabel: '東京・千代田区',
        imageUrl: '/hazard.png',
      },
    })

    expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('見通しの悪い交差点'),
    )
    expect(clickMock).toHaveBeenCalledTimes(1)
    expect(removeMock).toHaveBeenCalledTimes(1)

    createElementSpy.mockRestore()
  })
})
