"use client"

import { useCallback, useEffect, useRef, useState } from 'react'

import type { AccidentHotspotList, AccidentHotspotSummary } from '@/lib/traffic-accident/hotspot-types'
import type { ViewportBounds } from '@/lib/traffic-accident-heatmap'

const FETCH_DEBOUNCE_MS = 300

/**
 * 事故多発地点は地図の初期表示で全員に出す(UIUX改装 項目9)。少し動かしただけで取り直さないよう、
 * 範囲をこの幅(約2km)の格子まで外へ広げてそろえ、同じ範囲の結果はしばらく使い回す
 */
const BOUNDS_GRID_DEG = 0.02
const RESULT_CACHE_SIZE = 24
const resultCache = new Map<string, AccidentHotspotList>()

export function snapBoundsToGrid(bounds: ViewportBounds): ViewportBounds {
  const round = (value: number) => Number(value.toFixed(4))
  const down = (value: number) => round(Math.floor(value / BOUNDS_GRID_DEG) * BOUNDS_GRID_DEG)
  const up = (value: number) => round(Math.ceil(value / BOUNDS_GRID_DEG) * BOUNDS_GRID_DEG)
  return {
    minLng: Math.max(-180, down(Math.min(bounds.minLng, bounds.maxLng))),
    minLat: Math.max(-90, down(Math.min(bounds.minLat, bounds.maxLat))),
    maxLng: Math.min(180, up(Math.max(bounds.minLng, bounds.maxLng))),
    maxLat: Math.min(90, up(Math.max(bounds.minLat, bounds.maxLat))),
  }
}

/** テスト用: 覚えておいた結果を消す */
export function clearHotspotResultCache(): void {
  resultCache.clear()
}

export async function fetchHotspotsInBounds(bounds: ViewportBounds, signal?: AbortSignal): Promise<AccidentHotspotList> {
  const snapped = snapBoundsToGrid(bounds)
  const query = new URLSearchParams({
    minLng: String(snapped.minLng),
    minLat: String(snapped.minLat),
    maxLng: String(snapped.maxLng),
    maxLat: String(snapped.maxLat),
  })
  const cacheKey = query.toString()
  const cached = resultCache.get(cacheKey)
  if (cached) return cached
  const response = await fetch(`/api/traffic-accidents/hotspots?${query.toString()}`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    signal,
  })
  const body = (await response.json().catch(() => null)) as (AccidentHotspotList & { error?: string }) | null
  if (!response.ok || !body || !Array.isArray(body.hotspots)) {
    throw new Error(body?.error ?? '事故多発地点の取得に失敗しました')
  }
  const result = { hotspots: body.hotspots, truncated: Boolean(body.truncated) }
  resultCache.set(cacheKey, result)
  // いちばん古いものから捨てる(Map は入れた順)
  if (resultCache.size > RESULT_CACHE_SIZE) resultCache.delete(resultCache.keys().next().value as string)
  return result
}

export interface UseAccidentHotspotsReturn {
  hotspots: AccidentHotspotSummary[]
  truncated: boolean
  isLoading: boolean
  error: string | null
  /** 表示範囲が変わったら呼ぶ（内部で間引き・最新の要求だけ反映）。 */
  fetchForViewport: (bounds: ViewportBounds) => void
  /** 進行中の取得をやめ、表示データを消す（非表示にしたとき）。 */
  clear: () => void
}

/** 地図の表示範囲の事故多発地点を取得する。use-accident-heatmap と同じ「間引き＋最新の要求だけ反映」。 */
export function useAccidentHotspots(): UseAccidentHotspotsReturn {
  const [list, setList] = useState<AccidentHotspotList>({ hotspots: [], truncated: false })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const requestIdRef = useRef(0)

  const cancel = useCallback(() => {
    requestIdRef.current += 1
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const fetchForViewport = useCallback((bounds: ViewportBounds) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      timerRef.current = null
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setIsLoading(true)
      setError(null)
      try {
        const result = await fetchHotspotsInBounds(bounds, controller.signal)
        if (requestIdRef.current === requestId) setList(result)
      } catch (caught) {
        if (requestIdRef.current !== requestId || controller.signal.aborted) return
        setError(caught instanceof Error ? caught.message : '事故多発地点の取得に失敗しました')
      } finally {
        if (requestIdRef.current === requestId) setIsLoading(false)
        if (abortRef.current === controller) abortRef.current = null
      }
    }, FETCH_DEBOUNCE_MS)
  }, [])

  const clear = useCallback(() => {
    cancel()
    setIsLoading(false)
    setError(null)
    setList({ hotspots: [], truncated: false })
  }, [cancel])

  useEffect(() => cancel, [cancel])

  return { hotspots: list.hotspots, truncated: list.truncated, isLoading, error, fetchForViewport, clear }
}
