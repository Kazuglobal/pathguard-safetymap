import { describe, expect, it } from 'vitest'
import { arAccidentBounds, compassLabel, groundScreenYPercent, locateARAccidents, projectARAccidents, relativeDirectionLabel,
  shouldRefreshARPoint, summarizeOffscreen, verticalFovFromHorizontal } from '@/lib/ar-risk-data'
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

describe('AR accident locating (outside the camera view too)', () => {
  const here = { lat: 35, lon: 139 }
  it('keeps records behind and beside the camera, marking only the FOV ones as in view', () => {
    const points = [feature(1, 35.001), feature(2, 34.9995), feature(3, 35, 139.001), feature(4, 35.01)]
    const result = locateARAccidents(points, here, 0, 500, true, 60)
    expect(result.map(x => x.feature.properties.id)).toEqual([2, 3, 1])
    expect(result.find(x => x.feature.properties.id === 1)?.inView).toBe(true)
    expect(result.find(x => x.feature.properties.id === 2)?.inView).toBe(false)
    const off = summarizeOffscreen(result)
    expect(off.back.map(x => x.feature.properties.id)).toEqual([2])
    expect(off.right.map(x => x.feature.properties.id)).toEqual([3])
    expect(off.left).toHaveLength(0)
  })
  it('treats nothing as in view without a compass', () => {
    const result = locateARAccidents([feature(1, 35.001)], here, 0, 500, false)
    expect(result[0].inView).toBe(false)
  })
  it('labels directions in words', () => {
    expect(relativeDirectionLabel(0)).toBe('正面')
    expect(relativeDirectionLabel(40)).toBe('右前')
    expect(relativeDirectionLabel(-90)).toBe('左')
    expect(relativeDirectionLabel(150)).toBe('右後ろ')
    expect(relativeDirectionLabel(-179)).toBe('後ろ')
    expect(compassLabel(0)).toBe('北')
    expect(compassLabel(200)).toBe('南南西')
    expect(compassLabel(-90)).toBe('西')
  })
  it('places nearer accidents lower on the screen, and follows the camera tilt', () => {
    const vfov = verticalFovFromHorizontal(60, 16 / 9)
    expect(vfov).toBeGreaterThan(60)
    const near = groundScreenYPercent(5, -10, vfov)
    const far = groundScreenYPercent(400, -10, vfov)
    expect(near).toBeGreaterThan(far)
    // 端末を下に向けると、同じ地点は画面の上側へ動く。
    expect(groundScreenYPercent(30, -20, vfov)).toBeLessThan(groundScreenYPercent(30, 0, vfov))
    // 水平に構えると遠い地点はほぼ画面の中央の高さ。
    expect(groundScreenYPercent(442, 0, vfov)).toBeCloseTo(50, 0)
    // UIに隠れない範囲に収める。
    expect(groundScreenYPercent(2, 30, vfov)).toBe(50)
    expect(groundScreenYPercent(400, -60, vfov)).toBe(38)
  })
})
