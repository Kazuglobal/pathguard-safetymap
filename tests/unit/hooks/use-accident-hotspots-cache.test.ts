import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearHotspotResultCache, fetchHotspotsInBounds, snapBoundsToGrid } from '@/hooks/use-accident-hotspots'

// 事故多発地点は地図の初期表示で全員に出すので、少し動かしただけで取り直さない(UIUX改装 項目9)
describe('事故多発地点の取得の間引き', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    clearHotspotResultCache()
    fetchMock.mockReset()
    // Response の本文は1回しか読めないので、呼ばれるたびに作る
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ hotspots: [{ id: 1 }], truncated: false }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('範囲を約2kmの格子まで外へ広げてそろえる(見えている範囲は必ず含む)', () => {
    const snapped = snapBoundsToGrid({ minLng: 139.701, minLat: 35.661, maxLng: 139.739, maxLat: 35.699 })
    expect(snapped).toEqual({ minLng: 139.7, minLat: 35.66, maxLng: 139.74, maxLat: 35.7 })
  })

  it('同じ格子に収まる小さな動きでは、取り直さずに前の結果を使う', async () => {
    await fetchHotspotsInBounds({ minLng: 139.701, minLat: 35.661, maxLng: 139.739, maxLat: 35.699 })
    const again = await fetchHotspotsInBounds({ minLng: 139.705, minLat: 35.665, maxLng: 139.735, maxLat: 35.695 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(again.hotspots).toEqual([{ id: 1 }])
    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://localhost')
    expect(url.searchParams.get('minLng')).toBe('139.7')
    expect(url.searchParams.get('maxLat')).toBe('35.7')
  })

  it('格子をまたいで動いたら取り直す。失敗した結果は覚えない', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'x' }), { status: 500 }))
    await expect(fetchHotspotsInBounds({ minLng: 139.701, minLat: 35.661, maxLng: 139.739, maxLat: 35.699 })).rejects.toThrow()

    await fetchHotspotsInBounds({ minLng: 139.701, minLat: 35.661, maxLng: 139.739, maxLat: 35.699 })
    await fetchHotspotsInBounds({ minLng: 139.801, minLat: 35.661, maxLng: 139.839, maxLat: 35.699 })

    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
