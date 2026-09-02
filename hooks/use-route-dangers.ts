"use client"

import { useState, useEffect, useCallback } from "react"
import { PUBLIC_DANGER_REPORT_STATUSES } from "@/lib/danger-report-status"
import type { DangerReport, UserRoute } from "@/lib/types"
import {
  findDangersNearRoute,
  sortDangersByRoutePosition,
} from "@/lib/geo/route-danger-finder"

export interface UseRouteDangersResult {
  dangers: DangerReport[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook to fetch and filter danger reports near a specific route.
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

  const fetchDangers = useCallback(async () => {
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

      const params = new URLSearchParams({ limit: "2000" })
      PUBLIC_DANGER_REPORT_STATUSES.forEach((status) => params.append("status", status))
      const dangersResponse = await fetch(`/api/reports?${params}`, { credentials: "same-origin" })
      if (!dangersResponse.ok) {
        setError("危険箇所の取得に失敗しました")
        setDangers([])
        setIsLoading(false)
        return
      }
      const { reports: allDangers = [] } = await dangersResponse.json() as { reports?: DangerReport[] }

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
