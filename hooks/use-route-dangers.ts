"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { DangerReport, UserRoute } from "@/lib/types"
import {
  findDangersNearRoute,
  sortDangersByRoutePosition,
} from "@/lib/geo/route-danger-finder"
import {
  FetchJsonError,
  fetchPublicReports,
  type PublicReportsPayload,
} from "@/lib/reports-fetch-cache"

export interface UseRouteDangersResult {
  dangers: DangerReport[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook to fetch and filter danger reports near a specific route.
 *
 * The public reports request (/api/reports?limit=2000) goes through lib/reports-fetch-cache,
 * so it is shared with useRouteDangerCounts and other mounted callers instead of being
 * downloaded twice. refetch() skips that cache and always asks the server again.
 *
 * @param routeId - The ID of the route to find dangers for
 * @param bufferMeters - The buffer distance in meters (default: 100)
 * @returns Object containing dangers, loading state, error, and refetch function
 */
export function useRouteDangers(
  routeId: string,
  bufferMeters: number = 100
): UseRouteDangersResult {
  const [dangers, setDangers] = useState<DangerReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  // refetch() のときだけ、共有キャッシュを使わずに通報を取り直す
  const forceReloadRef = useRef(false)

  const fetchDangers = useCallback(async () => {
    const forceReload = forceReloadRef.current
    forceReloadRef.current = false

    if (!routeId) {
      setDangers([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      const routeResponse = await fetch(`/api/routes/${encodeURIComponent(routeId)}`, { credentials: "same-origin" })
      if (!routeResponse.ok) {
        setError(routeResponse.status === 404 ? "ルートが見つかりません" : "ルートの取得に失敗しました")
        setDangers([])
        setIsLoading(false)
        return
      }
      const { route } = await routeResponse.json() as { route?: UserRoute }

      if (!route) {
        setError("ルートが見つかりません")
        setDangers([])
        setIsLoading(false)
        return
      }

      const typedRoute = route as UserRoute

      if (!typedRoute.route_geometry) {
        setError("ルートジオメトリがありません")
        setDangers([])
        setIsLoading(false)
        return
      }

      let reportsPayload: PublicReportsPayload<DangerReport> | null
      try {
        reportsPayload = await fetchPublicReports<DangerReport>({ force: forceReload })
      } catch (reportsError) {
        if (reportsError instanceof FetchJsonError) {
          setError("危険箇所の取得に失敗しました")
          setDangers([])
          setIsLoading(false)
          return
        }
        throw reportsError
      }
      const allDangers = reportsPayload?.reports ?? []

      if (!allDangers || allDangers.length === 0) {
        setDangers([])
        setIsLoading(false)
        return
      }

      // Filter dangers near the route
      const nearbyDangers = findDangersNearRoute(
        typedRoute.route_geometry,
        allDangers as DangerReport[],
        bufferMeters
      )

      // Sort by position along route
      const sortedDangers = sortDangersByRoutePosition(
        typedRoute.route_geometry,
        nearbyDangers
      )

      setDangers(sortedDangers)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "危険箇所の取得に失敗しました"
      )
      setDangers([])
    } finally {
      setIsLoading(false)
    }
  }, [routeId, bufferMeters])

  const refetch = useCallback(() => {
    forceReloadRef.current = true
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    fetchDangers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId, bufferMeters, refreshKey])

  return {
    dangers,
    isLoading,
    error,
    refetch,
  }
}
