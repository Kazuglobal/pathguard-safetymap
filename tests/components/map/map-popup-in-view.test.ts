import { describe, expect, it, vi } from 'vitest'

vi.mock('mapbox-gl', () => ({ default: { Popup: vi.fn() } }))

import { hitsMapDataPoint } from '@/components/map/map-popup-in-view'

function fakeMap(existingLayers: string[], featuresAtPoint: number) {
  return {
    getLayer: (id: string) => (existingLayers.includes(id) ? { id } : undefined),
    queryRenderedFeatures: vi.fn((_point: unknown, options: { layers: string[] }) =>
      options.layers.length > 0 ? new Array(featuresAtPoint).fill({}) : []),
  }
}

describe('hitsMapDataPoint', () => {
  const point = { x: 10, y: 20 }

  it('is true when a hotspot or accident circle is under the tap', () => {
    const map = fakeMap(['accident-hotspot-circle'], 1)
    expect(hitsMapDataPoint(map as never, point as never)).toBe(true)
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith(point, { layers: ['accident-hotspot-circle'] })
  })

  it('is false on an empty spot so the normal map click still opens the accident stats', () => {
    expect(hitsMapDataPoint(fakeMap(['accident-hotspot-circle', 'accident-circle-layer'], 0) as never, point as never)).toBe(false)
  })

  it('does not query layers that are not on the map (querying a missing layer throws in Mapbox)', () => {
    const map = fakeMap([], 1)
    expect(hitsMapDataPoint(map as never, point as never)).toBe(false)
    expect(map.queryRenderedFeatures).not.toHaveBeenCalled()
  })
})
