// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assessAlertLocation, readAlertSource } from '@/lib/local-alert-location'

vi.mock('@/lib/mapbox-config', () => ({ getMapboxToken: () => 'pk.test' }))
vi.mock('@/lib/gemini-util', () => ({ getSanitizedGeminiApiKey: () => 'test-key' }))
const address = '新宿区高田馬場1-25-21'
const evidence = `${address}で声かけ事案が発生しました。`
const alert = { prefecture: '東京都', city: '新宿区', category: 'voice_call' as const, description: '通学中の児童への声かけが発生しました', source_url: 'https://www.city.shinjuku.lg.jp/alert', occurred_at: '2026-10-10T00:00:00.000Z' }
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
function sourceAndGeocoder(confidence: string, accuracy = 'rooftop', sourceEvidence = evidence) {
  return vi.fn(async (url: string) => {
    if (url.startsWith('https://www.city.shinjuku.lg.jp')) return new Response(`<html>${sourceEvidence}</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    if (url.startsWith('https://generativelanguage.googleapis.com')) return json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ address, evidence }) }] } }] })
    return json({ features: [{ properties: { feature_type: 'address', full_address: `東京都${address}`, coordinates: { longitude: 139.71, latitude: 35.71, accuracy }, match_code: { confidence } } }] })
  })
}
afterEach(() => vi.unstubAllGlobals())
describe('precise source-backed geocoding', () => {
  it('stores only exact precise address matches and requests permanent geocodes', async () => {
    const fetchMock = sourceAndGeocoder('exact'); vi.stubGlobal('fetch', fetchMock)
    expect(await assessAlertLocation(alert)).toMatchObject({ status: 'verified', longitude: 139.71, latitude: 35.71, address, evidence })
    const url = new URL(fetchMock.mock.calls[2][0])
    expect(url.searchParams.get('permanent')).toBe('true')
    expect(url.searchParams.get('q')).toBe(`東京都${address}`)
  })
  it('rejects corrected streets even within the same municipality', async () => {
    vi.stubGlobal('fetch', sourceAndGeocoder('high'))
    expect(await assessAlertLocation(alert)).toMatchObject({ status: 'imprecise_location', longitude: null, latitude: null })
  })
  it('does not use approximate municipality or interpolated street positions', async () => {
    vi.stubGlobal('fetch', sourceAndGeocoder('exact', 'interpolated'))
    expect(await assessAlertLocation(alert)).toMatchObject({ status: 'imprecise_location', longitude: null })
  })
  it('does not geocode hallucinated source excerpts', async () => {
    const fetchMock = sourceAndGeocoder('exact', 'rooftop', '事件の住所は掲載されていません')
    vi.stubGlobal('fetch', fetchMock)
    expect(await assessAlertLocation(alert)).toMatchObject({ status: 'unverified_evidence', longitude: null })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('does not fetch arbitrary source URLs and disables redirects for trusted sources', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('redirect', { status: 302 }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await readAlertSource('https://127.0.0.1/internal')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await readAlertSource(alert.source_url)).toBeNull()
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error' })
  })
})
