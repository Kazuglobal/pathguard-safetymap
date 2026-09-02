import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  accidentsInBbox: vi.fn(),
  nearbyStats: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/repos/accidents.repo', () => ({
  accidentsInBbox: mocks.accidentsInBbox,
  nearbyStats: mocks.nearbyStats,
}))

import { GET as getBbox } from '@/app/api/traffic-accidents/bbox/route'
import { GET as getNearby } from '@/app/api/traffic-accidents/nearby/route'

const user = {
  kind: 'user' as const,
  id: 'user-1',
  email: 'user@example.com',
  isAdmin: false,
}

describe('traffic accident D1 routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActor.mockResolvedValue(user)
  })

  it('validates and forwards bbox filters to the repository', async () => {
    const result = { type: 'FeatureCollection', features: [] }
    mocks.accidentsInBbox.mockResolvedValue(result)
    const request = new NextRequest(
      'http://localhost/api/traffic-accidents/bbox?minLng=138&minLat=34&maxLng=140&maxLat=36&minYear=2020&maxYear=2026&severity=fatal&child=true&limit=5000',
    )

    const response = await getBbox(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(result)
    expect(mocks.accidentsInBbox).toHaveBeenCalledWith(user, {
      minLng: 138,
      minLat: 34,
      maxLng: 140,
      maxLat: 36,
      minYear: 2020,
      maxYear: 2026,
      severity: 'fatal',
      child: true,
      young: null,
      pedestrian: null,
      limit: 5000,
    })
  })

  it('rejects malformed nearby parameters before querying D1', async () => {
    const request = new NextRequest(
      'http://localhost/api/traffic-accidents/nearby?latitude=nope&longitude=139',
    )

    const response = await getNearby(request)

    expect(response.status).toBe(400)
    expect(mocks.nearbyStats).not.toHaveBeenCalled()
  })

  it('requires a Supabase-authenticated actor', async () => {
    mocks.getActor.mockResolvedValue({ kind: 'anon' })
    const request = new NextRequest(
      'http://localhost/api/traffic-accidents/nearby?latitude=35&longitude=139',
    )

    const response = await getNearby(request)

    expect(response.status).toBe(401)
    expect(mocks.nearbyStats).not.toHaveBeenCalled()
  })

  it('returns the repository nearby statistics', async () => {
    mocks.nearbyStats.mockResolvedValue({ total_accidents: 3 })
    const request = new NextRequest(
      'http://localhost/api/traffic-accidents/nearby?latitude=35&longitude=139&radiusMeters=300&years=7',
    )

    const response = await getNearby(request)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ total_accidents: 3 })
    expect(mocks.nearbyStats).toHaveBeenCalledWith(user, {
      latitude: 35,
      longitude: 139,
      radiusMeters: 300,
      years: 7,
    })
  })
})
