import { describe, expect, it } from 'vitest'

import {
  hotspotBreakdown,
  hotspotHeadline,
  hotspotOneLine,
  hotspotPromptLine,
  hotspotPeakHourLabel,
  hotspotsToGeoJSON,
  hotspotTier,
  hotspotYearSeries,
  HOTSPOT_TIER_COLORS,
} from '@/lib/traffic-accident/hotspot-presentation'
import { dominantAccidentClass, type AccidentHotspotSummary } from '@/lib/traffic-accident/hotspot-types'

const SPOT: AccidentHotspotSummary = {
  id: 7,
  latitude: 35.67252,
  longitude: 139.66047,
  radiusMeters: 30,
  minYear: 2021,
  maxYear: 2025,
  accidentCount: 12,
  fatalCount: 1,
  pedestrianCount: 3,
  youngCount: 0,
  byYear: { '2021': 4, '2023': 3, '2025': 5 },
  byClass: { 車両相互: 8, 人対車両: 3, 車両単独: 1 },
  peakHour: 8,
  nationalRank: 42,
  distanceMeters: null,
}

describe('hotspot presentation', () => {
  it('tiers by count', () => {
    expect(hotspotTier(5)).toBe('low')
    expect(hotspotTier(10)).toBe('medium')
    expect(hotspotTier(20)).toBe('high')
  })

  it('writes the headline and breakdown without inventing zero counts', () => {
    expect(hotspotHeadline(SPOT)).toBe('2021〜2025年に半径30m以内で12件')
    expect(hotspotBreakdown(SPOT)).toBe('うち死亡1件・歩行者3件')
    expect(hotspotBreakdown({ fatalCount: 0, pedestrianCount: 0, youngCount: 0 })).toBeNull()
    expect(hotspotBreakdown({ fatalCount: 0, pedestrianCount: 0, youngCount: 2 })).toBe('うち24歳以下が関わる2件')
  })

  it('labels the peak hour and fills missing years with zero', () => {
    expect(hotspotPeakHourLabel(8)).toBe('8時台')
    expect(hotspotPeakHourLabel(null)).toBeNull()
    expect(hotspotYearSeries(SPOT)).toEqual([
      { year: 2021, count: 4 }, { year: 2022, count: 0 }, { year: 2023, count: 3 },
      { year: 2024, count: 0 }, { year: 2025, count: 5 },
    ])
  })

  it('summarizes in one line with the dominant class', () => {
    expect(dominantAccidentClass(SPOT.byClass)).toBe('車両相互')
    expect(dominantAccidentClass({})).toBeNull()
    expect(hotspotOneLine(SPOT)).toBe('全国42位・2021〜2025年に半径30m以内で12件（主に車両相互）')
    expect(hotspotOneLine({ ...SPOT, byClass: {} })).toBe('全国42位・2021〜2025年に半径30m以内で12件')
  })

  it('converts to GeoJSON points with tier colors', () => {
    const collection = hotspotsToGeoJSON([SPOT])
    expect(collection.features[0]).toEqual({
      type: 'Feature',
      id: 7,
      geometry: { type: 'Point', coordinates: [139.66047, 35.67252] },
      properties: { id: 7, accidentCount: 12, tier: 'medium', color: HOTSPOT_TIER_COLORS.medium },
    })
  })

  it('writes the AI prompt line from data only', () => {
    expect(hotspotPromptLine([SPOT, { ...SPOT, id: 8, accidentCount: 30, distanceMeters: 120 }], 300))
      .toBe('半径300m以内に事故多発地点が2か所（最大: 半径30m以内で30件・主に車両相互・120m先）')
    expect(hotspotPromptLine([{ ...SPOT, byClass: {} }], undefined)).toBe('近くに事故多発地点が1か所（最大: 半径30m以内で12件）')
    expect(hotspotPromptLine([SPOT], 300, 7)).toBe('半径300m以内に事故多発地点が7か所（最大: 半径30m以内で12件・主に車両相互）')
    expect(hotspotPromptLine([SPOT], 300, 0)).toBe('半径300m以内に事故多発地点が1か所（最大: 半径30m以内で12件・主に車両相互）')
    expect(hotspotPromptLine([], 300)).toBeNull()
    expect(hotspotPromptLine(undefined, 300)).toBeNull()
  })
})
