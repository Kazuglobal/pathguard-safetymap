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
    expect(parsed.hasYoung).toBe(true)
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

  it('shows child and young labels independently', () => {
    const content = buildAccidentPopupContent({
      severity: 2,
      fatalities: 0,
      injuries: 2,
      hasChild: true,
      hasYoung: true,
    })

    expect(content.textContent).toContain('子ども関与（補充票確認分）')
    expect(content.textContent).toContain('若年者関与（24歳以下コード）')
  })
})
