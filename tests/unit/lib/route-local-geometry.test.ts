import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearAllLocalRouteGeometry,
  clearOtherUsersLocalRouteGeometry,
  mergeLocalRouteGeometry,
  removeLocalRouteGeometry,
  saveLocalRouteGeometry,
  type LocalRouteGeometry,
} from '@/lib/route-local-geometry'
import type { UserRoute } from '@/lib/types'

const FULL: LocalRouteGeometry = {
  start_lat: 35.689634, start_lng: 139.691706, end_lat: 35.681236, end_lng: 139.767125,
  start_address: '東京都新宿区西新宿2丁目8-1', end_address: '東京都千代田区丸の内1丁目9-1',
  route_geometry: { type: 'LineString', coordinates: [[139.691706, 35.689634], [139.767125, 35.681236]] },
}

function serverRoute(id: string): UserRoute {
  return {
    id, user_id: 'user-1', name: '登校', description: null, child_id: null, child_name: null,
    start_lat: 35.69, start_lng: 139.69, end_lat: 35.68, end_lng: 139.77,
    start_address: '東京都新宿区', end_address: '東京都千代田区',
    route_geometry: { type: 'LineString', coordinates: [[139.7, 35.69], [139.75, 35.68]] },
    distance_meters: 7_000, estimated_time_minutes: 90, is_favorite: false,
    created_at: '2026-10-29T00:00:00.000Z', updated_at: '2026-10-29T00:00:00.000Z',
  }
}

describe('通学路の元の線は作成した端末にだけ残す', () => {
  beforeEach(() => localStorage.clear())

  it('この端末で作った通学路には元の線・起点・終点・住所を重ねる(ほかの項目はサーバーのまま)', () => {
    saveLocalRouteGeometry('user-1', 'r1', FULL)

    const [merged, untouched] = mergeLocalRouteGeometry('user-1', [serverRoute('r1'), serverRoute('r2')])

    expect(merged).toMatchObject({ ...FULL, name: '登校', distance_meters: 7_000 })
    expect(untouched).toEqual(serverRoute('r2'))
  })

  it('別のユーザーの元の線は使わない', () => {
    saveLocalRouteGeometry('user-1', 'r1', FULL)
    expect(mergeLocalRouteGeometry('user-2', [serverRoute('r1')])[0]).toEqual(serverRoute('r1'))
  })

  it('ほかの端末で消された通学路の分は手元からも消し、削除したら消す', () => {
    saveLocalRouteGeometry('user-1', 'gone', FULL)
    saveLocalRouteGeometry('user-1', 'r1', FULL)

    mergeLocalRouteGeometry('user-1', [serverRoute('r1')])
    expect(Object.keys(JSON.parse(localStorage.getItem('pathguardian:route-full-geometry:v1:user-1')!))).toEqual(['r1'])

    removeLocalRouteGeometry('user-1', 'r1')
    expect(localStorage.getItem('pathguardian:route-full-geometry:v1:user-1')).toBeNull()
  })

  it('ログアウトでこの端末のすべての元の線を消す(ほかの保存は残す)', () => {
    saveLocalRouteGeometry('user-1', 'r1', FULL)
    saveLocalRouteGeometry('user-2', 'r9', FULL)
    localStorage.setItem('pathguardian:other', 'keep')

    clearAllLocalRouteGeometry()

    expect(localStorage.getItem('pathguardian:route-full-geometry:v1:user-1')).toBeNull()
    expect(localStorage.getItem('pathguardian:route-full-geometry:v1:user-2')).toBeNull()
    expect(localStorage.getItem('pathguardian:other')).toBe('keep')
  })

  it('別のアカウントでログインしたら、ほかのアカウントの元の線を消す(ログインした人の分とほかの保存は残す)', () => {
    saveLocalRouteGeometry('user-1', 'r1', FULL)
    saveLocalRouteGeometry('user-2', 'r9', FULL)
    localStorage.setItem('pathguardian:other', 'keep')

    clearOtherUsersLocalRouteGeometry('user-2')

    expect(localStorage.getItem('pathguardian:route-full-geometry:v1:user-1')).toBeNull()
    expect(localStorage.getItem('pathguardian:route-full-geometry:v1:user-2')).not.toBeNull()
    expect(localStorage.getItem('pathguardian:other')).toBe('keep')
  })

  it('壊れた保存内容は使わない', () => {
    localStorage.setItem('pathguardian:route-full-geometry:v1:user-1', JSON.stringify({ r1: { start_lat: 'x' }, r2: FULL }))
    const [first, second] = mergeLocalRouteGeometry('user-1', [serverRoute('r1'), serverRoute('r2')])
    expect(first).toEqual(serverRoute('r1'))
    expect(second).toMatchObject(FULL)

    localStorage.setItem('pathguardian:route-full-geometry:v1:user-1', '{not json')
    expect(mergeLocalRouteGeometry('user-1', [serverRoute('r1')])[0]).toEqual(serverRoute('r1'))
  })

  it('保存できない環境でも通学路の表示を止めない', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(() => saveLocalRouteGeometry('user-1', 'r1', FULL)).not.toThrow()
    setItem.mockRestore()
    expect(mergeLocalRouteGeometry('user-1', [serverRoute('r1')])[0]).toEqual(serverRoute('r1'))
  })
})
