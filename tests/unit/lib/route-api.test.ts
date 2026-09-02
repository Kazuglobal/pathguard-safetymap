import { describe, expect, it } from 'vitest'

import { parseRouteWriteInput } from '@/lib/route-api'

describe('parseRouteWriteInput', () => {
  it('maps the public snake_case route payload to the repository input', () => {
    expect(parseRouteWriteInput({
      name: '登校ルート',
      description: null,
      child_id: 'child-1',
      child_name: 'あおい',
      start_lat: '35.68',
      start_lng: 139.76,
      end_lat: 35.69,
      end_lng: '139.77',
      route_geometry: { type: 'LineString', coordinates: [] },
      distance_meters: '1200',
      estimated_time_minutes: 18,
      is_favorite: true,
    })).toEqual({
      name: '登校ルート',
      description: null,
      childId: 'child-1',
      childName: 'あおい',
      startLat: 35.68,
      startLng: 139.76,
      endLat: 35.69,
      endLng: 139.77,
      startAddress: undefined,
      endAddress: undefined,
      routeGeometry: { type: 'LineString', coordinates: [] },
      distanceMeters: 1200,
      estimatedTimeMinutes: 18,
      isFavorite: true,
    })
  })

  it.each([null, [], 'route'])('rejects non-object payloads (%j)', (payload) => {
    expect(() => parseRouteWriteInput(payload)).toThrow(RangeError)
  })
})
