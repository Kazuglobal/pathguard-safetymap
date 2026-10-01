import { describe, expect, it } from 'vitest'

import { computeHotspots, distanceMeters, type HotspotPoint } from '@/lib/traffic-accident/hotspots'

const ORIGIN = { lat: 35.681236, lng: 139.767125 } // 東京駅付近
const METERS_PER_DEGREE_LAT = 110_574

function northOf(meters: number) {
  return { lat: ORIGIN.lat + meters / METERS_PER_DEGREE_LAT, lng: ORIGIN.lng }
}

function accident(at: { lat: number; lng: number }, overrides: Partial<HotspotPoint> = {}): HotspotPoint {
  return {
    ...at, year: 2025, fatal: false, pedestrian: false, young: false,
    accidentClass: '車両相互', hour: 8, prefectureCode: 30, municipalityCode: '101', ...overrides,
  }
}

function times(count: number, at: { lat: number; lng: number }, overrides: Partial<HotspotPoint> = {}) {
  return Array.from({ length: count }, () => accident(at, overrides))
}

const OPTIONS = { radiusMeters: 30, minCount: 5 }

describe('distanceMeters', () => {
  it('is accurate to well under a meter at 30m', () => {
    expect(distanceMeters(ORIGIN, northOf(30))).toBeCloseTo(30, 0)
    const east = { lat: ORIGIN.lat, lng: ORIGIN.lng + 30 / (111_320 * Math.cos(ORIGIN.lat * Math.PI / 180)) }
    expect(distanceMeters(ORIGIN, east)).toBeCloseTo(30, 0)
  })
})

describe('computeHotspots', () => {
  it('counts accidents within the radius and drops spots under the threshold', () => {
    const points = [...times(4, ORIGIN), accident(northOf(25)), ...times(4, northOf(500))]
    const hotspots = computeHotspots(points, OPTIONS)
    expect(hotspots).toHaveLength(1)
    expect(hotspots[0].accidentCount).toBe(5)
    expect(hotspots[0]).toMatchObject({ lat: ORIGIN.lat, lng: ORIGIN.lng, nationalRank: 1 })
  })

  it('does not count accidents just outside the radius', () => {
    const points = [...times(4, ORIGIN), accident(northOf(31))]
    expect(computeHotspots(points, OPTIONS)).toEqual([])
  })

  it('keeps only the busiest center when circles overlap (NPA distance-group rule)', () => {
    // 0m に6件、20m に5件: 20m 側の中心は採用済みの中心から30m以内なので捨てる
    const points = [...times(6, ORIGIN), ...times(5, northOf(20))]
    const hotspots = computeHotspots(points, OPTIONS)
    expect(hotspots).toHaveLength(1)
    expect(hotspots[0].accidentCount).toBe(11)
    expect(hotspots[0].lat).toBe(ORIGIN.lat)
  })

  it('keeps separate hotspots that are farther apart than the radius', () => {
    const points = [...times(7, ORIGIN), ...times(5, northOf(45))]
    const hotspots = computeHotspots(points, OPTIONS)
    expect(hotspots.map((spot) => spot.accidentCount)).toEqual([7, 5])
    expect(hotspots.map((spot) => spot.nationalRank)).toEqual([1, 2])
  })

  it('gives tied counts the same rank and orders them deterministically', () => {
    const points = [...times(5, northOf(1000)), ...times(5, ORIGIN), ...times(6, northOf(-2000))]
    const hotspots = computeHotspots(points, OPTIONS)
    expect(hotspots.map((spot) => spot.nationalRank)).toEqual([1, 2, 2])
    expect(hotspots[1].lat).toBeLessThan(hotspots[2].lat)
  })

  it('summarizes severity, pedestrians, years, classes and the peak hour', () => {
    const points = [
      accident(ORIGIN, { fatal: true, year: 2021, hour: 17 }),
      accident(ORIGIN, { pedestrian: true, accidentClass: '人対車両', hour: 8 }),
      accident(ORIGIN, { pedestrian: true, young: true, accidentClass: '人対車両', hour: 8 }),
      accident(ORIGIN, { year: 2024, hour: null }),
      accident(ORIGIN, { accidentClass: null, hour: 17 }),
    ]
    const [hotspot] = computeHotspots(points, OPTIONS)
    expect(hotspot).toMatchObject({
      accidentCount: 5, fatalCount: 1, pedestrianCount: 2, youngCount: 1,
      byYear: { '2021': 1, '2024': 1, '2025': 3 },
      byClass: { 車両相互: 2, 人対車両: 2 },
      peakHour: 8, prefectureCode: 30, municipalityCode: '101',
    })
  })

  it('handles an empty input and rejects nonsense options', () => {
    expect(computeHotspots([], OPTIONS)).toEqual([])
    expect(() => computeHotspots([], { radiusMeters: 0, minCount: 5 })).toThrow()
  })

  it('stays fast for a dense city-sized input', () => {
    const points: HotspotPoint[] = []
    for (let i = 0; i < 50_000; i += 1) {
      points.push(accident({ lat: ORIGIN.lat + (i % 250) * 0.0002, lng: ORIGIN.lng + Math.floor(i / 250) * 0.0002 }))
    }
    const started = Date.now()
    computeHotspots(points, OPTIONS)
    expect(Date.now() - started).toBeLessThan(5_000)
  })
})
