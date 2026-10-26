import { describe, expect, it, vi } from 'vitest'

vi.mock('mapbox-gl', () => ({ default: { Popup: vi.fn() } }))

import { buildHotspotPopupContent, hotspotLayerMessage } from '@/components/map/accident-hotspot-layer'
import type { AccidentHotspotSummary } from '@/lib/traffic-accident/hotspot-types'

const SPOT: AccidentHotspotSummary = {
  id: 7,
  latitude: 35.67,
  longitude: 139.66,
  radiusMeters: 30,
  minYear: 2021,
  maxYear: 2025,
  accidentCount: 12,
  fatalCount: 0,
  pedestrianCount: 3,
  youngCount: 0,
  byYear: { '2021': 4, '2025': 8 },
  byClass: { 車両相互: 9, 人対車両: 3 },
  peakHour: 17,
  nationalRank: 42,
  distanceMeters: null,
}

describe('buildHotspotPopupContent', () => {
  it('shows rank, counts, main type, peak hour, yearly trend and the NPA attribution', () => {
    const text = buildHotspotPopupContent(SPOT).textContent ?? ''
    expect(text).toContain('事故多発地点（全国42位）')
    expect(text).toContain('2021〜2025年に半径30m以内で12件')
    expect(text).toContain('うち歩行者3件')
    expect(text).not.toContain('死亡')
    expect(text).toContain('多い事故: 車両相互')
    expect(text).toContain('多い時間帯: 17時台')
    expect(text).toContain('2022')
    expect(text).toContain('警察庁「交通事故統計情報のオープンデータ」を加工して作成')
  })

  it('describes the yearly trend for screen readers', () => {
    const chart = buildHotspotPopupContent(SPOT).querySelector('[aria-label^="年ごとの件数"]')
    expect(chart?.getAttribute('aria-label')).toBe('年ごとの件数: 2021年4件、2022年0件、2023年0件、2024年0件、2025年8件')
  })
})

describe('hotspotLayerMessage', () => {
  const base = { isVisible: true, error: null, isZoomedOut: false, truncated: false, count: 0 }

  it('asks to zoom in instead of fetching nationwide, and tells when results are cut off', () => {
    expect(hotspotLayerMessage({ ...base, isZoomedOut: true })).toBe('地図を拡大すると事故多発地点が表示されます')
    expect(hotspotLayerMessage({ ...base, truncated: true, count: 2000 })).toBe('件数の多い2000か所を表示しています。拡大するとすべて表示されます')
  })

  it('prefers errors and stays silent when hidden or nothing to say', () => {
    expect(hotspotLayerMessage({ ...base, error: '取得失敗', isZoomedOut: true })).toBe('取得失敗')
    expect(hotspotLayerMessage({ ...base, isVisible: false, error: '取得失敗' })).toBeNull()
    expect(hotspotLayerMessage(base)).toBeNull()
  })
})
