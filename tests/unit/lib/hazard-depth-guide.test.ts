import { describe, expect, it } from 'vitest'
import { DEPTH_GUIDE_MARKS, TSUNAMI_FACTS, depthGuideMarksWithin } from '@/lib/hazard-depth-guide'

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
  it('only offers marks inside the displayed range', () => {
    expect(depthGuideMarksWithin(3).map(mark => mark.depthMeters)).toEqual([0.5, 3])
    expect(depthGuideMarksWithin(0.4)).toEqual([])
    expect(depthGuideMarksWithin(null)).toEqual([])
  })
})
