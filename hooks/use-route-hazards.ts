"use client"

import { useCallback, useEffect, useState } from "react"
import { getRouteHazardRequestState } from "@/lib/route-hazard-request-state"
import {
  buildHazardExplanation,
  getHazardAreaLabel,
  getHazardEvacuationPoints,
} from "@/lib/hazard-scenarios"
import type { HazardType, RouteHazardMarker, UserRoute } from "@/lib/types"

interface UseRouteHazardsParams {
  selectedUserRoute: UserRoute | null
  hazardLayerVisibility: Record<HazardType, boolean>
}

/**
 * 選択中の通学路に対する洪水・津波の危険箇所マーカーを API から取得する。
 * map-container.tsx から挙動をそのまま抽出。
 * setRouteHazardError は Mapbox の overlay エラーを反映するために公開している。
 */
export function useRouteHazards({ selectedUserRoute, hazardLayerVisibility }: UseRouteHazardsParams) {
  const [routeHazards, setRouteHazards] = useState<RouteHazardMarker[]>([])
  const [isRouteHazardsLoading, setIsRouteHazardsLoading] = useState(false)
  const [routeHazardError, setRouteHazardError] = useState<string | null>(null)
  const [routeHazardsFetchedAt, setRouteHazardsFetchedAt] = useState<string | null>(null)

  useEffect(() => {
    const requestState = getRouteHazardRequestState(selectedUserRoute, hazardLayerVisibility)

    if (!selectedUserRoute?.route_geometry?.coordinates?.length) {
      setRouteHazards([])
      setRouteHazardError(null)
      setRouteHazardsFetchedAt(null)
      setIsRouteHazardsLoading(requestState.isLoading)
      return
    }

    if (!requestState.shouldFetch) {
      setRouteHazardError(null)
      setIsRouteHazardsLoading(requestState.isLoading)
      return
    }

    let cancelled = false
    setIsRouteHazardsLoading(requestState.isLoading)
    setRouteHazardError(null)

    fetch(`/api/hazard/route-risks?routeId=${encodeURIComponent(selectedUserRoute.id)}`)
      .then(async (response) => {
        const body = await response.json()
        if (!response.ok) {
          throw new Error(body.error || "危険箇所の取得に失敗しました")
        }
        return body
      })
      .then((body) => {
        if (cancelled) return
        const markers = Array.isArray(body.markers)
          ? body.markers.map((marker: RouteHazardMarker) => ({
              ...marker,
              area_label: marker.area_label ?? getHazardAreaLabel(marker.area_context),
              explanation:
                marker.explanation ??
                buildHazardExplanation({
                  hazardType: marker.hazard_type,
                  depthLabel: marker.depth_label,
                }),
              evacuation_points:
                marker.evacuation_points?.length
                  ? marker.evacuation_points
                  : getHazardEvacuationPoints(marker.hazard_type),
            }))
          : []
        setRouteHazards(markers)
        setRouteHazardsFetchedAt(new Date().toISOString())
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const message =
          error instanceof Error ? error.message : "危険箇所の取得に失敗しました"
        setRouteHazardError(message)
        setRouteHazards([])
        setRouteHazardsFetchedAt(null)
      })
      .finally(() => {
        if (!cancelled) {
          setIsRouteHazardsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [hazardLayerVisibility, selectedUserRoute])

  // 通学路の切り替え時などに取得結果を明示的にリセットする
  const resetRouteHazards = useCallback(() => {
    setRouteHazardError(null)
    setRouteHazards([])
    setRouteHazardsFetchedAt(null)
  }, [])

  return {
    routeHazards,
    isRouteHazardsLoading,
    routeHazardError,
    routeHazardsFetchedAt,
    setRouteHazardError,
    resetRouteHazards,
  }
}
