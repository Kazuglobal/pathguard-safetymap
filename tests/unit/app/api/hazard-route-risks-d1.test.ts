import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  getRouteById: vi.fn(),
  routeIntersections: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/repos/routes.repo', () => ({ getRouteById: mocks.getRouteById }))
vi.mock('@/lib/db/repos/hazard.repo', () => ({ routeIntersections: mocks.routeIntersections }))

import { GET } from '@/app/api/hazard/route-risks/route'

describe('hazard route risks D1 handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActor.mockResolvedValue({
      kind: 'user', id: 'user-1', email: 'user@example.com', isAdmin: false,
    })
  })

  it('loads the owned route and maps D1 intersections to UI markers', async () => {
    const geometry = { type: 'LineString', coordinates: [[139, 35], [139.1, 35.1]] }
    mocks.getRouteById.mockResolvedValue({ id: 'route-1', name: 'School', routeGeometry: geometry })
    mocks.routeIntersections.mockResolvedValue({
      truncated: false,
      markers: [{
        id: 'zone-1',
        hazard_type: 'flood',
        source_layer: 'mlit',
        risk_level: 3,
        depth_min_m: 1,
        depth_max_m: 2,
        depth_label: '1.0m〜2.0m',
        area_context: 'riverside',
        area_label: '河川沿い',
        title: '洪水リスク レベル3',
        summary: 'summary',
        explanation: 'explanation',
        evacuation_points: [],
        longitude: 139.05,
        latitude: 35.05,
        scenario_key: 'standard-riverside',
      }],
    })

    const response = await GET(new NextRequest(
      'http://localhost/api/hazard/route-risks?routeId=route-1',
    ))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.getRouteById).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), 'route-1')
    expect(mocks.routeIntersections).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1' }), geometry)
    expect(body.markers[0]).toMatchObject({
      coordinates: [139.05, 35.05],
      scenario_key: 'standard-riverside',
    })
    expect(body.truncated).toBe(false)
  })
})
