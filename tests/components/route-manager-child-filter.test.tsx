import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef, useImperativeHandle, type ReactNode } from 'react'

import { RouteManager } from '@/components/map/route-manager'

const routesWithChildren = [
  {
    id: 'route-1',
    user_id: 'test-user-id',
    name: 'さくらの通学路',
    description: '交番前を通るルート',
    start_lat: 35.68,
    start_lng: 139.76,
    end_lat: 35.69,
    end_lng: 139.77,
    start_address: '自宅',
    end_address: '学校',
    route_geometry: null,
    distance_meters: 800,
    estimated_time_minutes: 10,
    is_favorite: true,
    child_id: 'child-sakura',
    child_name: 'さくら',
    created_at: '2026-03-14T00:00:00Z',
    updated_at: '2026-03-14T00:00:00Z',
  },
  {
    id: 'route-2',
    user_id: 'test-user-id',
    name: 'だいちの通学路',
    description: '大通りを避けるルート',
    start_lat: 35.68,
    start_lng: 139.76,
    end_lat: 35.69,
    end_lng: 139.77,
    start_address: '自宅',
    end_address: '学校',
    route_geometry: null,
    distance_meters: 900,
    estimated_time_minutes: 11,
    is_favorite: false,
    child_id: 'child-daichi',
    child_name: 'だいち',
    created_at: '2026-03-14T00:00:00Z',
    updated_at: '2026-03-14T00:00:00Z',
  },
  {
    id: 'route-3',
    user_id: 'test-user-id',
    name: '共通の予備ルート',
    description: null,
    start_lat: 35.68,
    start_lng: 139.76,
    end_lat: 35.69,
    end_lng: 139.77,
    start_address: '自宅',
    end_address: '学校',
    route_geometry: null,
    distance_meters: 950,
    estimated_time_minutes: 12,
    is_favorite: false,
    child_id: null,
    child_name: null,
    created_at: '2026-03-14T00:00:00Z',
    updated_at: '2026-03-14T00:00:00Z',
  },
]

vi.mock('@/hooks/use-user-routes', () => ({
  useUserRoutes: vi.fn(() => ({
    routes: routesWithChildren,
    childProfiles: [
      { id: 'all', label: 'すべて', routeCount: 3 },
      { id: 'child-sakura', label: 'さくら', routeCount: 1 },
      { id: 'child-daichi', label: 'だいち', routeCount: 1 },
      { id: 'shared', label: '共通', routeCount: 1 },
    ],
    primaryRoute: routesWithChildren[0],
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

describe('RouteManager child filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters route cards by selected child', async () => {
    render(<RouteManager />)

    expect(screen.getByTestId('child-selector')).toBeInTheDocument()
    expect(screen.getAllByTestId('route-card')).toHaveLength(3)

    await userEvent.click(screen.getByRole('button', { name: 'さくらを表示' }))

    expect(screen.getAllByTestId('route-card')).toHaveLength(1)
    expect(screen.getByText('さくらの通学路')).toBeInTheDocument()
    expect(screen.queryByText('だいちの通学路')).not.toBeInTheDocument()
    expect(screen.queryByText('共通の予備ルート')).not.toBeInTheDocument()
  })
})
