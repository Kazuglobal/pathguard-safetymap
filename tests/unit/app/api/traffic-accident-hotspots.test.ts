import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  hotspotsInBbox: vi.fn(),
  hotspotsAlongRoute: vi.fn(),
  getRouteById: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/repos/accident-hotspots.repo', () => ({
  hotspotsInBbox: mocks.hotspotsInBbox,
  hotspotsAlongRoute: mocks.hotspotsAlongRoute,
}))
vi.mock('@/lib/db/repos/routes.repo', () => ({ getRouteById: mocks.getRouteById }))

import { GET as getHotspots } from '@/app/api/traffic-accidents/hotspots/route'
import { GET as getRouteHotspots } from '@/app/api/traffic-accidents/hotspots/route-risks/route'

const user = { kind: 'user' as const, id: 'user-1', email: 'user@example.com', isAdmin: false }

describe('accident hotspot routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActor.mockResolvedValue(user)
  })

  it('forwards the bbox to the repository', async () => {
    mocks.hotspotsInBbox.mockResolvedValue({ hotspots: [], truncated: false })
    const response = await getHotspots(new NextRequest(
      'http://localhost/api/traffic-accidents/hotspots?minLng=138&minLat=34&maxLng=140&maxLat=36&limit=500',
    ))
    expect(response.status).toBe(200)
    expect(mocks.hotspotsInBbox).toHaveBeenCalledWith(user, { minLng: 138, minLat: 34, maxLng: 140, maxLat: 36, limit: 500 })
  })

  it('returns 400 for a malformed bbox and 401 for anonymous users', async () => {
    const bad = await getHotspots(new NextRequest('http://localhost/api/traffic-accidents/hotspots?minLng=x'))
    expect(bad.status).toBe(400)
    expect(mocks.hotspotsInBbox).not.toHaveBeenCalled()

    mocks.getActor.mockResolvedValue({ kind: 'anon' })
    const anon = await getHotspots(new NextRequest('http://localhost/api/traffic-accidents/hotspots?minLng=1'))
    expect(anon.status).toBe(401)
  })

  it('looks up hotspots along the signed-in user\'s own route', async () => {
    const coordinates = [[139, 35], [139.01, 35.01]]
    mocks.getRouteById.mockResolvedValue({ id: 'r1', routeGeometry: { type: 'LineString', coordinates } })
    mocks.hotspotsAlongRoute.mockResolvedValue({ hotspots: [{ id: 1 }], truncated: false })

    const response = await getRouteHotspots(new NextRequest('http://localhost/api/traffic-accidents/hotspots/route-risks?routeId=r1'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ hotspots: [{ id: 1 }], truncated: false })
    expect(mocks.getRouteById).toHaveBeenCalledWith(user, 'r1')
    expect(mocks.hotspotsAlongRoute).toHaveBeenCalledWith(user, coordinates)
  })

  it('returns 404 for a route that is missing or not owned, and an empty list without geometry', async () => {
    mocks.getRouteById.mockResolvedValue(null)
    const missing = await getRouteHotspots(new NextRequest('http://localhost/api/traffic-accidents/hotspots/route-risks?routeId=r2'))
    expect(missing.status).toBe(404)

    mocks.getRouteById.mockResolvedValue({ id: 'r3', routeGeometry: null })
    const empty = await getRouteHotspots(new NextRequest('http://localhost/api/traffic-accidents/hotspots/route-risks?routeId=r3'))
    expect(await empty.json()).toEqual({ hotspots: [], truncated: false })
    expect(mocks.hotspotsAlongRoute).not.toHaveBeenCalled()
  })

  it('requires a routeId', async () => {
    const response = await getRouteHotspots(new NextRequest('http://localhost/api/traffic-accidents/hotspots/route-risks'))
    expect(response.status).toBe(400)
  })
})
