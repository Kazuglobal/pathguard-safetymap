import { describe, expect, it } from 'vitest'

import type { UserRouteWithChild } from '@/lib/db/repos/routes.repo'
import { parseRouteWriteInput, toUserRouteJson } from '@/lib/route-api'

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
      // 入力欄の呼び名。サーバーが children の行に置き換える(通学路には書かない)
      childNickname: 'あおい',
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

describe('toUserRouteJson の child_name(UIUX改装 項目56)', () => {
  const base = {
    id: 'route-1', userId: 'user-1', name: '登校ルート', description: null, childId: 'child-uuid', childName: null,
    startLat: 35.68, startLng: 139.76, endLat: 35.69, endLng: 139.77, startAddress: 'A', endAddress: 'B',
    routeGeometry: null, distanceMeters: null, estimatedTimeMinutes: null, isFavorite: false,
    createdAt: '2026-10-29T00:00:00.000Z', updatedAt: '2026-10-29T00:00:00.000Z', childNickname: null,
  } as UserRouteWithChild

  it('children 表の呼び名を返す', () => {
    expect(toUserRouteJson({ ...base, childNickname: 'さくちゃん' }).child_name).toBe('さくちゃん')
  })

  it('移行前の行だけ、残っている名前を本人に返す(呼び名があればそちらを優先)', () => {
    expect(toUserRouteJson({ ...base, childName: 'さくら' }).child_name).toBe('さくら')
    expect(toUserRouteJson({ ...base, childName: 'さくら', childNickname: 'さくちゃん' }).child_name).toBe('さくちゃん')
  })

  it('どちらも無ければ null', () => {
    expect(toUserRouteJson(base).child_name).toBeNull()
  })
})
