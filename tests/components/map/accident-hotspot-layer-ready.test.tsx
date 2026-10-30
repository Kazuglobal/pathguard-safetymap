import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  hotspots: {
    hotspots: [{ id: 7, longitude: 139.95, latitude: 35.85, accidentCount: 12 }] as unknown[],
    truncated: false,
    isLoading: false,
    error: null,
    fetchForViewport: () => {},
    clear: () => {},
  },
  showPopupInView: vi.fn(() => ({ remove: () => {} })),
}))

vi.mock('mapbox-gl', () => ({ default: { Popup: vi.fn() } }))
vi.mock('@/hooks/use-accident-hotspots', () => ({ useAccidentHotspots: () => mocks.hotspots }))
vi.mock('@/components/map/map-popup-in-view', () => ({ showPopupInView: mocks.showPopupInView }))
vi.mock('@/lib/traffic-accident/hotspot-types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/traffic-accident/hotspot-types')>()
  return { ...actual, dominantAccidentClass: () => 'other' }
})

import { AccidentHotspotLayer } from '@/components/map/accident-hotspot-layer'

type Handler = (payload?: unknown) => void

/** スタイルの読み込みが終わるまで addSource が投げる、本物の Mapbox と同じふるまいの偽物 */
function createFakeMap({ styleLoaded }: { styleLoaded: boolean }) {
  let loaded = styleLoaded
  const handlers = new Map<string, Handler[]>()
  const layers = new Map<string, Record<string, unknown>>()
  const sources = new Map<string, unknown>()
  const checkLoaded = () => {
    if (!loaded) throw new Error('Style is not done loading')
  }
  return {
    finishStyleLoad: () => {
      loaded = true
      for (const handler of handlers.get('style.load') ?? []) handler()
    },
    fire: (event: string, payload?: unknown) => {
      for (const handler of handlers.get(event) ?? []) handler(payload)
    },
    getZoom: () => 12,
    on: (event: string, layerOrHandler: string | Handler, maybeHandler?: Handler) => {
      const key = maybeHandler ? `${event}:${layerOrHandler as string}` : event
      handlers.set(key, [...(handlers.get(key) ?? []), (maybeHandler ?? layerOrHandler) as Handler])
    },
    off: (event: string, layerOrHandler: string | Handler, maybeHandler?: Handler) => {
      const key = maybeHandler ? `${event}:${layerOrHandler as string}` : event
      const target = maybeHandler ?? layerOrHandler
      handlers.set(key, (handlers.get(key) ?? []).filter((handler) => handler !== target))
    },
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => (sources.has(id) ? { setData: () => {} } : undefined),
    addSource: (id: string, source: unknown) => {
      checkLoaded()
      sources.set(id, source)
    },
    addLayer: (layer: Record<string, unknown>) => {
      checkLoaded()
      layers.set(layer.id as string, layer)
    },
    setFilter: () => checkLoaded(),
    removeLayer: (id: string) => {
      layers.delete(id)
    },
    removeSource: (id: string) => {
      sources.delete(id)
    },
    getBounds: () => ({ getWest: () => 139.9, getSouth: () => 35.8, getEast: () => 140.0, getNorth: () => 35.9 }),
    getCanvas: () => ({ style: {} }),
    layers,
  }
}

// 事故多発地点は地図の初期表示で出すので、スタイルの読み込み前に渡されても落ちないこと(UIUX改装 項目9)
describe('AccidentHotspotLayer before the map style has loaded', () => {
  it('does not throw, and adds its layers once the style finishes loading', () => {
    const map = createFakeMap({ styleLoaded: false })

    expect(() => render(<AccidentHotspotLayer map={map as never} isVisible={true} />)).not.toThrow()
    expect(map.layers.has('accident-hotspot-circle')).toBe(false)

    act(() => map.finishStyleLoad())

    expect(map.layers.has('accident-hotspot-circle')).toBe(true)
  })
})

describe('AccidentHotspotLayer taps', () => {
  const tap = (map: ReturnType<typeof createFakeMap>) =>
    act(() =>
      map.fire('click:accident-hotspot-circle', {
        features: [{ properties: { id: 7 } }],
        target: map,
      }),
    )

  it('opens the hotspot popup on a normal tap', () => {
    mocks.showPopupInView.mockClear()
    const map = createFakeMap({ styleLoaded: true })
    render(<AccidentHotspotLayer map={map as never} isVisible={true} />)

    tap(map)

    expect(mocks.showPopupInView).toHaveBeenCalledTimes(1)
  })

  it('does not open the popup while a report location is being chosen', () => {
    mocks.showPopupInView.mockClear()
    const map = createFakeMap({ styleLoaded: true })
    render(<AccidentHotspotLayer map={map as never} isVisible={true} isInteractive={false} />)

    tap(map)

    expect(mocks.showPopupInView).not.toHaveBeenCalled()
  })
})
