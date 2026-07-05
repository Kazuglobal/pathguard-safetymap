"use client"

import { useCallback, useEffect, type MutableRefObject } from "react"
import mapboxgl from "mapbox-gl"
import {
  sourceExists,
  safeAddLayer,
  safeAddSource,
  safeRemoveLayer,
} from "@/lib/map/mapbox-layer-utils"
import type { UserRoute } from "@/lib/types"

interface UseSelectedRouteLayerParams {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  mapInitializedRef: MutableRefObject<boolean>
  selectedUserRoute: UserRoute | null
  mapStyleSyncToken: number
}

/**
 * 選択中の通学路をラインレイヤーとして描画し、選択時に経路全体へフィットする。
 * map-container.tsx から挙動をそのまま抽出。
 * mapStyleSyncToken はスタイル変更後にレイヤーを貼り直すための再実行トリガー。
 */
export function useSelectedRouteLayer({
  mapRef,
  mapInitializedRef,
  selectedUserRoute,
  mapStyleSyncToken,
}: UseSelectedRouteLayerParams) {
  const fitRouteBounds = useCallback((route: UserRoute) => {
    if (!mapRef.current || !route.route_geometry?.coordinates?.length) return

    const bounds = new mapboxgl.LngLatBounds()
    route.route_geometry.coordinates.forEach((coordinate) => {
      bounds.extend(coordinate as [number, number])
    })

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { padding: 80, duration: 800 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!mapRef.current || !mapInitializedRef.current) return

    const mapInstance = mapRef.current
    const sourceId = "selected-user-route-source"
    const layerId = "selected-user-route-layer"

    safeRemoveLayer(mapInstance, layerId)
    if (sourceExists(mapInstance, sourceId)) {
      try {
        mapInstance.removeSource(sourceId)
      } catch (error) {
        console.error(`Error removing source ${sourceId}:`, error)
      }
    }

    if (!selectedUserRoute?.route_geometry?.coordinates?.length) return

    safeAddSource(mapInstance, sourceId, {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: selectedUserRoute.route_geometry,
      },
    })

    safeAddLayer(mapInstance, layerId, {
      id: layerId,
      type: "line",
      source: sourceId,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#1d4ed8",
        "line-width": 5,
        "line-opacity": 0.88,
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyleSyncToken, selectedUserRoute])

  useEffect(() => {
    if (!selectedUserRoute) return
    fitRouteBounds(selectedUserRoute)
  }, [fitRouteBounds, selectedUserRoute])
}
