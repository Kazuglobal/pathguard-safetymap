import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  hotspots: {
    hotspots: [],
    truncated: false,
    isLoading: false,
    error: null,
    fetchForViewport: () => {},
    clear: () => {},
  },
}))

vi.mock('mapbox-gl', () => ({ default: { Popup: vi.fn() } }))
vi.mock('@/hooks/use-accident-hotspots', () => ({ useAccidentHotspots: () => mocks.hotspots }))

import { AccidentHotspotLayer } from '@/components/map/accident-hotspot-layer'

type Handler = () => void

/** Mapbox の地図のうち、このレイヤーが使う部分だけを記録する偽物。 */
function createFakeMap(initialZoom: number) {
  let zoom = initialZoom
  const handlers = new Map<string, Handler[]>()
  const layers = new Map<string, Record<string, unknown>>()
  const sources = new Map<string, unknown>()
  const filters = new Map<string, unknown>()
  const map = {
    getZoom: () => zoom,
    setZoom: (next: number) => { zoom = next },
    on: (event: string, layerOrHandler: string | Handler, maybeHandler?: Handler) => {
      const key = maybeHandler ? `${event}:${layerOrHandler as string}` : event
      handlers.set(key, [...(handlers.get(key) ?? []), (maybeHandler ?? layerOrHandler) as Handler])
    },
    off: (event: string, layerOrHandler: string | Handler, maybeHandler?: Handler) => {
      const key = maybeHandler ? `${event}:${layerOrHandler as string}` : event
      const target = maybeHandler ?? layerOrHandler
      handlers.set(key, (handlers.get(key) ?? []).filter((handler) => handler !== target))
    },
    fire: (event: string) => { for (const handler of handlers.get(event) ?? []) handler() },
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sources.has(id) ? { setData: () => {} } : undefined,
    addSource: (id: string, source: unknown) => { sources.set(id, source) },
    addLayer: (layer: Record<string, unknown>) => {
      layers.set(layer.id as string, layer)
      filters.set(layer.id as string, layer.filter)
    },
    setFilter: (id: string, filter: unknown) => { filters.set(id, filter) },
    removeLayer: (id: string) => { layers.delete(id) },
    removeSource: (id: string) => { sources.delete(id) },
    getBounds: () => ({ getWest: () => 139.9, getSouth: () => 35.8, getEast: () => 140.0, getNorth: () => 35.9 }),
    getCanvas: () => ({ style: {} }),
    layers,
    filters,
  }
  return map
}

describe('AccidentHotspotLayer zoom-based visibility', () => {
  it('shows only busy hotspots with counts when zoomed out, and every hotspot once zoomed in', () => {
    const map = createFakeMap(10.5)
    render(<AccidentHotspotLayer map={map as never} isVisible={true} />)

    expect(map.filters.get('accident-hotspot-circle')).toEqual(['>=', ['get', 'accidentCount'], 20])
    expect(map.filters.get('accident-hotspot-label')).toEqual(['>=', ['get', 'accidentCount'], 20])
    expect(map.layers.get('accident-hotspot-label')?.minzoom).toBe(10)
    expect(screen.getByRole('status')).toHaveTextContent('件数の多い地点（20件以上）だけ表示しています')

    act(() => {
      map.setZoom(11.5)
      map.fire('zoom')
    })
    expect(map.filters.get('accident-hotspot-circle')).toEqual(['>=', ['get', 'accidentCount'], 10])
    expect(screen.getByRole('status')).toHaveTextContent('10件以上')

    act(() => {
      map.setZoom(12.5)
      map.fire('zoom')
    })
    expect(map.filters.get('accident-hotspot-circle')).toEqual(['>=', ['get', 'accidentCount'], 5])
    expect(map.filters.get('accident-hotspot-label')).toEqual(['>=', ['get', 'accidentCount'], 5])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('stops listening to zoom and removes its layers when hidden', () => {
    const map = createFakeMap(12.5)
    const { rerender } = render(<AccidentHotspotLayer map={map as never} isVisible={true} />)

    rerender(<AccidentHotspotLayer map={map as never} isVisible={false} />)
    act(() => {
      map.setZoom(10.5)
      map.fire('zoom')
    })

    expect(map.layers.size).toBe(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
