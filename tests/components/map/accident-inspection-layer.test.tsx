import { render } from '@testing-library/react'
import type mapboxgl from 'mapbox-gl'
import { describe, expect, it, vi } from 'vitest'
import { AccidentInspectionLayer } from '@/components/map/accident-inspection-layer'

describe('AccidentInspectionLayer', () => {
  it('draws the radius even while the camera is moving with a ready style', () => {
    const sources = new Map()
    const layers = new Map()
    const map = {
      loaded: () => false, isStyleLoaded: () => true,
      getSource: (id: string) => sources.get(id), getLayer: (id: string) => layers.get(id),
      addSource: vi.fn((id: string, source: unknown) => sources.set(id, source)),
      addLayer: vi.fn((layer: { id: string }) => layers.set(layer.id, layer)),
      removeSource: vi.fn(), removeLayer: vi.fn(), on: vi.fn(), off: vi.fn(),
    }
    const { unmount } = render(<AccidentInspectionLayer map={map as unknown as mapboxgl.Map} center={[139, 35]} />)
    expect(map.addSource).toHaveBeenCalledTimes(1)
    expect(map.addLayer).toHaveBeenCalledTimes(3)
    unmount()
    expect(map.removeLayer).toHaveBeenCalledTimes(3)
    expect(map.removeSource).toHaveBeenCalledTimes(1)
  })

  it('retries when pending tiles finish without another style.load event', () => {
    const handlers = new Map<string, () => void>()
    let ready = false
    const map = {
      isStyleLoaded: () => ready, getSource: vi.fn(), getLayer: vi.fn(),
      addSource: vi.fn(), addLayer: vi.fn(), removeSource: vi.fn(), removeLayer: vi.fn(),
      on: (event: string, callback: () => void) => handlers.set(event, callback), off: vi.fn(),
    }
    render(<AccidentInspectionLayer map={map as unknown as mapboxgl.Map} center={[139, 35]} />)
    expect(map.addSource).not.toHaveBeenCalled()
    ready = true
    handlers.get('idle')!()
    expect(map.addSource).toHaveBeenCalledTimes(1)
    expect(map.addLayer).toHaveBeenCalledTimes(3)
  })
})
