import { describe, expect, it } from 'vitest'
import { DEPTH_GUIDE_MARKS, TSUNAMI_FACTS, depthGuideMarksWithin, layoutDepthGuideMarks } from '@/lib/hazard-depth-guide'

describe('hazard depth guide', () => {
  it('requires a named source and url for every entry', () => {
    for (const entry of [...DEPTH_GUIDE_MARKS, ...TSUNAMI_FACTS]) {
      expect(entry.sourceName.length).toBeGreaterThan(0)
      expect(entry.sourceUrl).toMatch(/^https:\/\//)
    }
  })
  it('keeps tsunami facts explicit about height versus inundation depth', () => {
    expect(TSUNAMI_FACTS.some(fact => fact.text.includes('浸水深とは別'))).toBe(true)
  })
  it('uses the current JMA advisory and warning criteria instead of the old 0.5m threshold', () => {
    const fact = TSUNAMI_FACTS.find(entry => entry.text.includes('津波注意報'))!
    expect(fact.text).toContain('0.2m以上1m以下')
    expect(fact.text).toContain('災害のおそれがある場合')
    expect(fact.text).toContain('1mを超え3m以下')
    expect(fact.text).toContain('3mを超える場合')
    expect(fact.text).not.toContain('0.5m')
    expect(fact.sourceName).toContain('気象庁')
    expect(fact.sourceUrl).toBe('https://www.jma.go.jp/jma/kishou/know/jishin/joho/tsunamiinfo.html')
  })
  it('only offers marks inside the displayed range', () => {
    expect(depthGuideMarksWithin(3).map(mark => mark.depthMeters)).toEqual([0.5, 3])
    expect(depthGuideMarksWithin(0.4)).toEqual([])
    expect(depthGuideMarksWithin(null)).toEqual([])
  })
})

describe('depth guide layout', () => {
  it('keeps the marks that fit under the heading of the comparison figure', () => {
    const scale = 230 / 3
    const placed = layoutDepthGuideMarks(depthGuideMarksWithin(3), { scalePxPerMeter: scale, personHeightPx: 1.7 * scale })
    expect(placed.map(mark => mark.depthMeters)).toEqual([0.5, 3])
    // 比較図の上端(見出しの帯)に掛かる目盛りは出さない
    const limited = layoutDepthGuideMarks(depthGuideMarksWithin(3), { scalePxPerMeter: scale, personHeightPx: 1.7 * scale, availableHeightPx: 236 })
    expect(limited.map(mark => mark.depthMeters)).toEqual([0.5])
  })
  it('drops marks whose labels would collide with the person label', () => {
    const scale = 230 / 25 // 20m以上の区域（圧縮された縮尺）
    const placed = layoutDepthGuideMarks(depthGuideMarksWithin(20), { scalePxPerMeter: scale, personHeightPx: 1.7 * scale })
    expect(placed).toEqual([])
  })
  it('drops a mark that would collide with the mark below it', () => {
    const marks = [
      { depthMeters: 3, label: 'a', sourceName: 's', sourceUrl: 'https://example.test' },
      { depthMeters: 3.1, label: 'b', sourceName: 's', sourceUrl: 'https://example.test' },
    ]
    const placed = layoutDepthGuideMarks(marks, { scalePxPerMeter: 76, personHeightPx: 1000 })
    expect(placed.map(mark => mark.depthMeters)).toEqual([3])
  })
})
