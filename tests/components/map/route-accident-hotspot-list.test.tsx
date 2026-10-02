import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RouteAccidentHotspotList } from '@/components/map/route-accident-hotspot-list'
import { useRouteAccidentHotspots } from '@/hooks/use-route-accident-hotspots'
import type { AccidentHotspotSummary } from '@/lib/traffic-accident/hotspot-types'

const SPOT: AccidentHotspotSummary = {
  id: 3,
  latitude: 35,
  longitude: 139,
  radiusMeters: 30,
  minYear: 2021,
  maxYear: 2025,
  accidentCount: 9,
  fatalCount: 0,
  pedestrianCount: 2,
  youngCount: 0,
  byYear: {},
  byClass: { 人対車両: 5, 車両相互: 4 },
  peakHour: 7,
  nationalRank: 1200,
  distanceMeters: 12,
}

describe('RouteAccidentHotspotList', () => {
  it('lists hotspots near the route and reports the selection', () => {
    const onSelect = vi.fn()
    render(<RouteAccidentHotspotList hotspots={[SPOT]} isLoading={false} error={null} onSelect={onSelect} />)

    expect(screen.getByText('この通学路の近くの事故多発地点（1か所）')).toBeInTheDocument()
    expect(screen.getByText('全国1200位・2021〜2025年に半径30m以内で9件（主に人対車両）')).toBeInTheDocument()
    expect(screen.getByText('うち歩行者2件')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(SPOT)
  })

  it('renders nothing when there are no hotspots or while loading, and shows errors', () => {
    const { container, rerender } = render(<RouteAccidentHotspotList hotspots={[]} isLoading={false} error={null} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<RouteAccidentHotspotList hotspots={[SPOT]} isLoading={true} error={null} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<RouteAccidentHotspotList hotspots={[]} isLoading={false} error="取得失敗" />)
    expect(screen.getByRole('status')).toHaveTextContent('取得失敗')
  })
})

describe('useRouteAccidentHotspots', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('fetches hotspots for the selected route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ hotspots: [SPOT], truncated: false }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useRouteAccidentHotspots('route 1'))

    await waitFor(() => expect(result.current.hotspots).toEqual([SPOT]))
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/traffic-accidents/hotspots/route-risks?routeId=route%201')
    expect(result.current.isLoading).toBe(false)
  })

  it('does not fetch without a route and surfaces API errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'ルートが見つかりません' }), { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    const { result, rerender } = renderHook(({ id }) => useRouteAccidentHotspots(id), { initialProps: { id: null as string | null } })
    expect(fetchMock).not.toHaveBeenCalled()

    rerender({ id: 'r2' })
    await waitFor(() => expect(result.current.error).toBe('ルートが見つかりません'))
  })
})
