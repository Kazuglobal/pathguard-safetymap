// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ actor: vi.fn(), gate: vi.fn(), coverage: vi.fn(), rate: vi.fn() }))
vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.actor }))
vi.mock('@/lib/hazard-zone-gate', () => ({ queryHazardGateD1: mocks.gate }))
vi.mock('@/lib/db/repos/hazard.repo', () => ({ coverageAtPoint: mocks.coverage }))
vi.mock('@/lib/upstash-rate-limiter', () => ({ checkApiRateLimit: mocks.rate, rateLimitedResponse: () => new Response(null, { status: 429 }) }))
import { GET } from '@/app/api/hazard/point-risks/route'
const request = (query = 'latitude=35&longitude=139') => new NextRequest(`http://localhost/api/hazard/point-risks?${query}`)
describe('point hazard API', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.actor.mockResolvedValue({ kind: 'user', id: 'u1' }); mocks.rate.mockResolvedValue({ success: true }); mocks.coverage.mockResolvedValue([]) })
  it('requires authentication and validates coordinates before D1', async () => {
    mocks.actor.mockResolvedValueOnce({ kind: 'anon' })
    expect((await GET(request())).status).toBe(401)
    for (const query of ['', 'latitude=&longitude=139', 'latitude=91&longitude=139', 'latitude=NaN&longitude=139']) expect((await GET(request(query))).status).toBe(400)
    expect(mocks.gate).not.toHaveBeenCalled()
  })
  it('keeps outside, no coverage, and unavailable distinct with no tolerance', async () => {
    mocks.gate.mockResolvedValueOnce({ kind: 'outside' }).mockResolvedValueOnce({ kind: 'no_coverage' })
    const response = await GET(request())
    expect((await response.json()).hazards).toMatchObject({ flood: { kind: 'outside' }, tsunami: { kind: 'no_coverage' } })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.gate.mock.calls[0][3]).toEqual({ toleranceMeters: 0 })
    mocks.gate.mockResolvedValue({ kind: 'unavailable' })
    expect((await (await GET(request())).json()).hazards.flood.kind).toBe('unavailable')
  })
  it('enforces the per-actor limit', async () => {
    mocks.rate.mockResolvedValue({ success: false, reset: 1 })
    expect((await GET(request())).status).toBe(429)
    expect(mocks.gate).not.toHaveBeenCalled()
  })
})
