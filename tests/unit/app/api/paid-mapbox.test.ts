import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  user: vi.fn(), rate: vi.fn(), call: vi.fn(), log: vi.fn(), local: vi.fn(),
}))
vi.mock('@/lib/supabase-server', () => ({ createServerClient: async () => ({ auth: { getUser: mocks.user } }) }))
vi.mock('@/lib/upstash-rate-limiter', async original => ({
  ...await original<typeof import('@/lib/upstash-rate-limiter')>(), checkPaidApiRateLimit: mocks.rate,
}))
vi.mock('@/lib/api-usage-logger', () => ({ logApiUsage: mocks.log }))
vi.mock('@/lib/geocoding/enhanced-geocoding', () => ({ enhancedGeocodingService: {
  geocode: mocks.call, autocomplete: mocks.call, reverseGeocode: mocks.call, smartSearch: mocks.call,
  batchGeocode: mocks.call, createSession: mocks.local, getSearchSuggestions: mocks.local, analyzeSearchPatterns: mocks.local,
} }))
vi.mock('@/lib/routing/isochrone', () => ({ isochroneService: {
  generateIsochrone: mocks.call, batchGenerateIsochrones: mocks.call, analyzeSchoolZone: mocks.call,
  analyzeEvacuationZone: mocks.call, analyzeAccessibility: mocks.call, compareReachability: mocks.call,
} }))
import { GET as geocodeGet, POST as geocodePost } from '@/app/api/mapbox/geocode/route'
import { GET as isoGet, POST as isoPost } from '@/app/api/mapbox/isochrone/route'

const request = (body: unknown) => new NextRequest('http://localhost/api/mapbox', {
  method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
})
const locations = (n: number) => Array.from({ length: n }, () => ({ coordinates: [139, 35], name: 'school' }))

describe('paid Mapbox boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mocks.rate.mockResolvedValue({ success: true })
    mocks.call.mockResolvedValue({ success: true, data: [] })
    mocks.local.mockReturnValue([])
  })
  it.each([
    [{ type: 'autocomplete', query: 'Tokyo' }, 1],
    [{ type: 'smartSearch', query: 'Tokyo' }, 1],
    [{ type: 'reverse', coordinates: [139, 35] }, 2],
    [{ type: 'batch', queries: Array(10).fill('Tokyo') }, 10],
  ])('charges geocode operation %#', async (body, cost) => {
    expect((await geocodePost(request(body))).status).toBe(200)
    expect(mocks.rate).toHaveBeenCalledWith('mapbox', 'user-1', cost)
  })
  it.each([[], Array(11).fill('a'), [''], ['a', null], ['a'.repeat(201)]])('rejects invalid batches %j', async queries => {
    expect((await geocodePost(request({ type: 'batch', queries }))).status).toBe(400)
    expect(mocks.rate).not.toHaveBeenCalled()
    expect(mocks.call).not.toHaveBeenCalled()
  })
  it.each(['createSession', 'getSearchSuggestions', 'analyzeSearchPatterns'])('does not charge local %s', async type => {
    expect((await geocodePost(request({ type, query: 'Tokyo' }))).status).toBe(200)
    expect(mocks.rate).not.toHaveBeenCalled()
  })
  it.each(['autocomplete', 'smartSearch'])('does not charge one-character %s', async type => {
    expect((await geocodePost(request({ type, query: '東' }))).status).toBe(200)
    expect(mocks.rate).not.toHaveBeenCalled()
  })
  it.each([
    [{ type: 'generateIsochrone', center: [139, 35], contours: [5, 10] }, 1],
    [{ type: 'batchGenerateIsochrones', locations: locations(10), contours: [10] }, 10],
    [{ type: 'compareReachability', locations: locations(10) }, 10],
    [{ type: 'analyzeAccessibility', location: [139, 35] }, 9],
    [{ type: 'analyzeAccessibility', location: [139, 35], serviceTypes: ['park'] }, 3],
    [{ type: 'analyzeSchoolZone', schoolLocation: [139, 35], schoolName: 'school' }, 1],
    [{ type: 'analyzeEvacuationZone', evacuationSite: { coordinates: [139, 35] } }, 1],
  ])('charges isochrone operation %#', async (body, cost) => {
    expect((await isoPost(request(body))).status).toBe(200)
    expect(mocks.rate).toHaveBeenCalledWith('mapbox', 'user-1', cost)
  })
  it.each([
    { type: 'compareReachability', locations: locations(11) },
    { type: 'batchGenerateIsochrones', locations: [], contours: [10] },
    { type: 'generateIsochrone', center: [181, 35], contours: [10] },
    { type: 'generateIsochrone', center: [139, 35, 0], contours: [10] },
    { type: 'generateIsochrone', center: [139, 35], contours: [10, 5] },
    { type: 'generateIsochrone', center: [139, 35], contours: [61] },
    { type: 'generateIsochrone', center: [139, 35], contours: [1, 2, 3, 4, 5] },
    { type: 'analyzeAccessibility', location: [139, 35], serviceTypes: ['park', 'park'] },
    { type: 'analyzeAccessibility', location: [139, 35], serviceTypes: ['unknown'] },
    { type: 'analyzeAccessibility', location: [139, 35], serviceTypes: null },
  ])('rejects invalid fanout %# without reserving quota', async body => {
    expect((await isoPost(request(body))).status).toBe(400)
    expect(mocks.rate).not.toHaveBeenCalled()
    expect(mocks.call).not.toHaveBeenCalled()
  })
  it('blocks both GET methods before external work', async () => {
    mocks.rate.mockResolvedValue({ success: false, reset: Date.now() + 60_000 })
    for (const [handler, url] of [[geocodeGet, 'http://localhost?query=Tokyo'], [isoGet, 'http://localhost?center=139,35&contours=10']] as const) {
      const res = await handler(new NextRequest(url))
      expect(res.status).toBe(429)
      expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0)
    }
    expect(mocks.call).not.toHaveBeenCalled()
  })
  it('authenticates before quota use', async () => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null })
    expect((await geocodePost(request({ type: 'autocomplete', query: 'Tokyo' }))).status).toBe(401)
    expect((await isoPost(request({ type: 'analyzeAccessibility', location: [139, 35] }))).status).toBe(401)
    expect(mocks.rate).not.toHaveBeenCalled()
  })
})
