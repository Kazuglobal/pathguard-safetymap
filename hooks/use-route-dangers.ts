"use client"

import { useState, useEffect, useCallback } from "react"
import { useSupabase } from "@/components/providers/supabase-provider"
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

  const { supabase } = useSupabase()

  const fetchDangers = useCallback(async () => {
    if (!routeId) {
      setDangers([])
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      // Fetch the route
      const { data: route, error: routeError } = await supabase
        .from("user_routes")
        .select("*")
        .eq("id", routeId)
        .single()

      if (routeError) {
        setError(routeError.message)
        setDangers([])
        setIsLoading(false)
        return
      }

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

      // Fetch all danger reports
      const { data: allDangers, error: dangersError } = await supabase
        .from("danger_reports")
        .select("*")
        .order("created_at", { ascending: false })

      if (dangersError) {
        setError(dangersError.message)
        setDangers([])
        setIsLoading(false)
        return
      }

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
  }, [routeId, bufferMeters, supabase])

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
