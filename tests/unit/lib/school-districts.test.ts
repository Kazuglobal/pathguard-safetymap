import { describe, expect, it } from 'vitest'
import type { Polygon, MultiPolygon } from 'geojson'
import { isInsideSchoolDistrict } from '@/lib/school-districts'
import { hasVerifiedLocationEvidence, isAllowedAlertSource } from '@/lib/local-alert-location'

const square: Polygon = { type: 'Polygon', coordinates: [[[139, 35], [139.02, 35], [139.02, 35.02], [139, 35.02], [139, 35]]] }

describe('school district spatial matching', () => {
  it('accepts only points safely inside the boundary', () => {
    expect(isInsideSchoolDistrict(139.01, 35.01, [square])).toBe(true)
    expect(isInsideSchoolDistrict(138.9, 35.01, [square])).toBe(false)
    expect(isInsideSchoolDistrict(139, 35.01, [square])).toBe(false)
    expect(isInsideSchoolDistrict(139.0001, 35.01, [square])).toBe(false)
    expect(isInsideSchoolDistrict(NaN, 35.01, [square])).toBe(false)
  })
  it('excludes holes and their margins', () => {
    const hole = [[139.008, 35.008], [139.012, 35.008], [139.012, 35.012], [139.008, 35.012], [139.008, 35.008]]
    const geometry: Polygon = { ...square, coordinates: [...square.coordinates, hole] }
    expect(isInsideSchoolDistrict(139.01, 35.01, [geometry])).toBe(false)
    expect(isInsideSchoolDistrict(139.0079, 35.01, [geometry])).toBe(false)
    expect(isInsideSchoolDistrict(139.004, 35.004, [geometry])).toBe(true)
  })
  it('supports disconnected islands and overlapping district matches', () => {
    const distant: Polygon = { type: 'Polygon', coordinates: [[[140, 36], [140.02, 36], [140.02, 36.02], [140, 36.02], [140, 36]]] }
    const multi: MultiPolygon = { type: 'MultiPolygon', coordinates: [square.coordinates, distant.coordinates] }
    expect(isInsideSchoolDistrict(140.01, 36.01, [multi])).toBe(true)
    expect([square, multi].filter(g => isInsideSchoolDistrict(139.01, 35.01, [g]))).toHaveLength(2)
  })
})

describe('source-backed location evidence', () => {
  it('requires a real source excerpt with the stated address', () => {
    const address = '新宿区高田馬場1-25-21'
    const excerpt = `${address}で声かけ事案が発生しました。`
    expect(hasVerifiedLocationEvidence(address, excerpt, `<p>${excerpt}</p>`)).toBe(true)
    expect(hasVerifiedLocationEvidence(address, excerpt, '別の事案です')).toBe(false)
    expect(hasVerifiedLocationEvidence('新宿区', '新宿区で発生', '新宿区で発生')).toBe(false)
  })
  it('rejects arbitrary, local, credentialed and non-HTTPS source URLs', () => {
    expect(isAllowedAlertSource('https://www.city.example.lg.jp/alert')).toBe(true)
    expect(isAllowedAlertSource('https://www.nhk.or.jp/news')).toBe(true)
    for (const url of ['http://www.city.example.lg.jp', 'https://localhost', 'https://127.0.0.1', 'https://lg.jp.evil.test', 'https://user:pass@www.city.example.lg.jp', 'https://www.city.example.lg.jp:8443']) expect(isAllowedAlertSource(url)).toBe(false)
  })
})
