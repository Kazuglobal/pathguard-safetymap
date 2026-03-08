import { describe, it, expect } from 'vitest'
import {
  toPopupDisplayData,
  buildAccidentPopupContent,
} from '@/components/map/accident-heatmap-layer'

describe('AccidentHeatmapLayer popup helpers', () => {
  it('normalizes mixed property types from mapbox feature payloads', () => {
    const parsed = toPopupDisplayData({
      severity: '1',
      year: '2023',
      fatalities: '2',
      injuries: '4',
      hasChild: 'true',
      hasYoung: '1',
      hasPedestrian: 1,
      type: '交差点',
      weather: '晴れ',
    })

    expect(parsed.severity).toBe(1)
    expect(parsed.severityLabel).toBe('死亡事故')
    expect(parsed.year).toBe(2023)
    expect(parsed.fatalities).toBe(2)
    expect(parsed.injuries).toBe(4)
    expect(parsed.hasChild).toBe(true)
    expect(parsed.hasPedestrian).toBe(true)
  })

  it('builds popup content without injecting untrusted HTML', () => {
    const content = buildAccidentPopupContent({
      severity: 2,
      type: '<img src=x onerror=alert(1)>',
      weather: '<script>alert(1)</script>',
      fatalities: 0,
      injuries: 1,
    })

    expect(content.querySelector('img')).toBeNull()
    expect(content.textContent).toContain('<img src=x onerror=alert(1)>')
    expect(content.textContent).toContain('<script>alert(1)</script>')
  })

  it('shows the current child and pedestrian labels', () => {
    const content = buildAccidentPopupContent({
      severity: 2,
      fatalities: 0,
      injuries: 2,
      hasChild: true,
      hasPedestrian: true,
    })

    expect(content.textContent).toContain('24歳以下関与（年齢区分）')
    expect(content.textContent).toContain('歩行者関与')
  })

  it('shows only the child label when only child involvement is present', () => {
    const content = buildAccidentPopupContent({
      severity: 2,
      fatalities: 0,
      injuries: 1,
      hasChild: true,
      hasYoung: false,
    })

    expect(content.textContent).toContain('子ども関与（補充票確認分）')
    expect(content.textContent).not.toContain('若年者関与（24歳以下コード）')
  })

  it('shows only the young label when only young involvement is present', () => {
    const content = buildAccidentPopupContent({
      severity: 2,
      fatalities: 0,
      injuries: 1,
      hasChild: false,
      hasYoung: true,
    })

    expect(content.textContent).not.toContain('子ども関与（補充票確認分）')
    expect(content.textContent).toContain('若年者関与（24歳以下コード）')
  })
})
