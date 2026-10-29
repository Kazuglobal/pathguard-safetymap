import { describe, expect, it } from 'vitest'
import { arAccidentBounds, projectARAccidents, shouldRefreshARPoint } from '@/lib/ar-risk-data'
import { hazardDepthLabel } from '@/lib/hazard-point'
import { streetViewLocationInfo } from '@/lib/street-view'
import type { AccidentFeature } from '@/lib/traffic-accident-heatmap'

const feature = (id: number, lat: number, lon = 139): AccidentFeature => ({
  type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { id, year: 2024, severity: 2, fatalities: 0, injuries: 1 },
} as AccidentFeature)

describe('AR actual risk projection', () => {
  it('uses display distance plus enough margin for the refresh threshold', () => {
    const bounds = arAccidentBounds({ lat: 35, lon: 139 }, 500)
    expect((bounds.maxLat - 35) * 111000).toBeCloseTo(800)
    expect(shouldRefreshARPoint({ lat: 35, lon: 139 }, { lat: 35.0001, lon: 139 }, 300)).toBe(false)
    expect(shouldRefreshARPoint({ lat: 35, lon: 139 }, { lat: 35.003, lon: 139 }, 300)).toBe(true)
  })
  it('sorts by distance, filters the view and never invents coordinates', () => {
    const points = [feature(2, 35.002), feature(1, 35.001), feature(3, 34.999), feature(4, 100)]
    expect(projectARAccidents(points, { lat: 35, lon: 139 }, 0, 500, true).map(x => x.feature.properties.id)).toEqual([1, 2])
    expect(projectARAccidents(points, { lat: 35, lon: 139 }, 0, 500, false)).toHaveLength(3)
  })
  it('limits to twenty records after ordering', () => {
    const points = Array.from({ length: 30 }, (_, i) => feature(i, 35 + (30 - i) * .00001))
    const result = projectARAccidents(points, { lat: 35, lon: 139 }, 0, 500, true)
    expect(result).toHaveLength(20)
    expect(result[0].feature.properties.id).toBe(29)
  })
  it('preserves unknown and open ended depths', () => {
    expect(hazardDepthLabel({ depthMinMeters: 20, depthMaxMeters: null })).toBe('20.0m以上')
    expect(hazardDepthLabel({ depthMinMeters: null, depthMaxMeters: null })).toBe('深さ情報なし')
  })
  it('faces from the panorama toward the actual accident', () => {
    const info = streetViewLocationInfo([139, 35.0001], { lat: 35, lng: 139 })
    expect(info.distance).toBeCloseTo(11.12, 1)
    expect(info.heading).toBeCloseTo(0)
  })
})
