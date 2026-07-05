"use client"

import { useState, type MutableRefObject } from "react"
import type mapboxgl from "mapbox-gl"
import {
  layerExists,
  sourceExists,
  safeAddLayer,
  safeRemoveLayer,
  safeAddSource,
} from "@/lib/map/mapbox-layer-utils"

interface UseMap3DModeParams {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  styleChangeInProgressRef: MutableRefObject<boolean>
  setMapError: (message: string) => void
}

/**
 * 地図の3D表示（terrain + sky レイヤー + ピッチ/ベアリング）の切り替え。
 * map-container.tsx から挙動をそのまま抽出。
 * enable/disable はスタイル変更後の再適用のために公開している。
 */
export function useMap3DMode({ mapRef, styleChangeInProgressRef, setMapError }: UseMap3DModeParams) {
  const [is3DEnabled, setIs3DEnabled] = useState(false)

  const enable3DMode = () => {
    const map = mapRef.current
    if (!map) return
    try {
      if (!sourceExists(map, "mapbox-dem")) {
        safeAddSource(map, "mapbox-dem", { type: "raster-dem", url: "mapbox://mapbox.mapbox-terrain-dem-v1", tileSize: 512, maxzoom: 14 })
      }
      map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 })
      if (!layerExists(map, "sky")) {
        safeAddLayer(map, "sky", { id: "sky", type: "sky", paint: { "sky-type": "atmosphere", "sky-atmosphere-sun": [0.0, 0.0], "sky-atmosphere-sun-intensity": 15 } })
      }
      map.setPitch(60)
      map.setBearing(30)
    } catch (error) { console.error("Error enabling 3D mode:", error); throw error }
  }

  const disable3DMode = () => {
    const map = mapRef.current
    if (!map) return
    try {
      map.setTerrain(null)
      safeRemoveLayer(map, "sky")
      map.setPitch(0)
      map.setBearing(0)
    } catch (error) { console.error("Error disabling 3D mode:", error); throw error }
  }

  const toggle3DMode = () => {
    if (!mapRef.current || styleChangeInProgressRef.current) return
    const newIs3DEnabled = !is3DEnabled
    setIs3DEnabled(newIs3DEnabled)
    try {
      if (newIs3DEnabled) {
        if (!mapRef.current.loaded()) mapRef.current.once("load", enable3DMode)
        else enable3DMode()
      } else {
        disable3DMode()
      }
    } catch (error) {
      console.error("Error toggling 3D mode:", error)
      setMapError("3Dモードの切り替え中にエラーが発生しました。")
      setIs3DEnabled(!newIs3DEnabled) // Revert state on error
    }
  }

  return { is3DEnabled, toggle3DMode, enable3DMode, disable3DMode }
}
