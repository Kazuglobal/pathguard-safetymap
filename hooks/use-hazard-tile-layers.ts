"use client"

import { useEffect, type MutableRefObject } from "react"
import type mapboxgl from "mapbox-gl"
import {
  layerExists,
  sourceExists,
  safeAddLayer,
  safeAddSource,
  safeRemoveLayer,
} from "@/lib/map/mapbox-layer-utils"
import { HAZARD_TILE_CONFIG } from "@/lib/hazard-scenarios"
import type { HazardType } from "@/lib/types"

interface UseHazardTileLayersParams {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  mapInitializedRef: MutableRefObject<boolean>
  hazardLayerVisibility: Record<HazardType, boolean>
  mapStyleSyncToken: number
}

/**
 * 重ねるハザードマップ（洪水・津波）のラスタータイルレイヤーを
 * トグル状態と同期する。map-container.tsx から挙動をそのまま抽出。
 * mapStyleSyncToken はスタイル変更後にレイヤーを貼り直すための再実行トリガー。
 */
export function useHazardTileLayers({
  mapRef,
  mapInitializedRef,
  hazardLayerVisibility,
  mapStyleSyncToken,
}: UseHazardTileLayersParams) {
  useEffect(() => {
    if (!mapRef.current || !mapInitializedRef.current) return

    const mapInstance = mapRef.current

    const syncLayer = (hazardType: HazardType) => {
      const config = HAZARD_TILE_CONFIG[hazardType]
      const sourceId = `${config.id}-source`
      const layerId = `${config.id}-layer`

      if (!hazardLayerVisibility[hazardType]) {
        safeRemoveLayer(mapInstance, layerId)
        if (sourceExists(mapInstance, sourceId)) {
          try {
            mapInstance.removeSource(sourceId)
          } catch (error) {
            console.error(`Error removing source ${sourceId}:`, error)
          }
        }
        return
      }

      if (!sourceExists(mapInstance, sourceId)) {
        safeAddSource(mapInstance, sourceId, {
          type: "raster",
          tiles: [config.tileUrl],
          tileSize: 256,
          attribution: "国土交通省 重ねるハザードマップ",
        })
      }

      if (!layerExists(mapInstance, layerId)) {
        safeAddLayer(mapInstance, layerId, {
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: {
            "raster-opacity": hazardType === "flood" ? 0.72 : 0.78,
          },
        })
      }
    }

    syncLayer("flood")
    syncLayer("tsunami")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hazardLayerVisibility, mapStyleSyncToken])
}
