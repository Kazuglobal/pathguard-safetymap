"use client"

import { useEffect, useState } from 'react'

import type { AccidentHotspotList, AccidentHotspotSummary } from '@/lib/traffic-accident/hotspot-types'

interface RouteAccidentHotspotsState {
  hotspots: AccidentHotspotSummary[]
  isLoading: boolean
  error: string | null
}

const EMPTY: RouteAccidentHotspotsState = { hotspots: [], isLoading: false, error: null }

/**
 * 選択中の通学路の近く（50m以内）を通る事故多発地点。
 * ルートが変わったとき、同じルートの経路が編集されたとき（routeVersion = updated_at が変わる）に取り直す。
 */
export function useRouteAccidentHotspots(routeId: string | null, routeVersion?: string | null): RouteAccidentHotspotsState {
  const [state, setState] = useState<RouteAccidentHotspotsState>(EMPTY)

  useEffect(() => {
    if (!routeId) {
      setState(EMPTY)
      return
    }
    const controller = new AbortController()
    setState({ hotspots: [], isLoading: true, error: null })
    fetch(`/api/traffic-accidents/hotspots/route-risks?routeId=${encodeURIComponent(routeId)}`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as (AccidentHotspotList & { error?: string }) | null
        if (!response.ok || !body || !Array.isArray(body.hotspots)) {
          throw new Error(body?.error ?? '事故多発地点の取得に失敗しました')
        }
        setState({ hotspots: body.hotspots, isLoading: false, error: null })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          hotspots: [],
          isLoading: false,
          error: error instanceof Error ? error.message : '事故多発地点の取得に失敗しました',
        })
      })
    return () => controller.abort()
  }, [routeId, routeVersion])

  return state
}
