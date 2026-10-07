import { describe, expect, it } from 'vitest'

import { HOTSPOT_MIN_COUNT } from '@/lib/traffic-accident/hotspot-config'
import {
  HOTSPOT_LABEL_MIN_ZOOM,
  hotspotMinCountForZoom,
  hotspotVisibilityFilter,
} from '@/lib/traffic-accident/hotspot-zoom'

describe('hotspotMinCountForZoom', () => {
  it('shows only the busiest spots when zoomed out and all spots when zoomed in', () => {
    expect(hotspotMinCountForZoom(10)).toBe(20)
    expect(hotspotMinCountForZoom(10.99)).toBe(20)
    expect(hotspotMinCountForZoom(11)).toBe(10)
    expect(hotspotMinCountForZoom(11.99)).toBe(10)
    expect(hotspotMinCountForZoom(12)).toBe(HOTSPOT_MIN_COUNT)
    expect(hotspotMinCountForZoom(16)).toBe(HOTSPOT_MIN_COUNT)
  })

  it('never hides spots below the dataset threshold and treats bad input as fully zoomed in', () => {
    expect(hotspotMinCountForZoom(Number.NaN)).toBe(HOTSPOT_MIN_COUNT)
    expect(hotspotMinCountForZoom(3)).toBe(20)
  })
})

describe('hotspotVisibilityFilter', () => {
  it('builds a Mapbox filter on the accident count', () => {
    expect(hotspotVisibilityFilter(10)).toEqual(['>=', ['get', 'accidentCount'], 10])
  })
})

describe('HOTSPOT_LABEL_MIN_ZOOM', () => {
  it('shows counts inside circles as soon as hotspots are fetched (zoom 10), not only at zoom 13', () => {
    expect(HOTSPOT_LABEL_MIN_ZOOM).toBe(10)
  })
})
