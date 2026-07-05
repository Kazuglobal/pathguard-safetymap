"use client"

import { useCallback, useEffect, useRef, type MutableRefObject } from "react"
import mapboxgl from "mapbox-gl"
import { createRoot } from "react-dom/client"
import { AlertTriangle } from "lucide-react"
import type { RouteHazardMarker } from "@/lib/types"

interface UseRouteHazardMarkersParams {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  mapInitializedRef: MutableRefObject<boolean>
  visibleRouteHazards: RouteHazardMarker[]
  /** ポップアップ内「災害イメージを見る」押下時に呼ばれる */
  onHazardDetail: (hazard: RouteHazardMarker) => void
}

/**
 * 通学路上のハザードマーカーとクリック時のポップアップを地図に描画する。
 * map-container.tsx から挙動をそのまま抽出。
 * clear 関数は地図の破棄（再初期化）時に呼べるよう公開している。
 */
export function useRouteHazardMarkers({
  mapRef,
  mapInitializedRef,
  visibleRouteHazards,
  onHazardDetail,
}: UseRouteHazardMarkersParams) {
  const routeHazardMarkersRef = useRef<mapboxgl.Marker[]>([])
  const routeHazardPopupRef = useRef<mapboxgl.Popup | null>(null)

  const clearRouteHazardMarkers = useCallback(() => {
    routeHazardMarkersRef.current.forEach((marker) => marker.remove())
    routeHazardMarkersRef.current = []
  }, [])

  const clearRouteHazardPopup = useCallback(() => {
    routeHazardPopupRef.current?.remove()
    routeHazardPopupRef.current = null
  }, [])

  useEffect(() => {
    if (!mapRef.current || !mapInitializedRef.current) return

    clearRouteHazardMarkers()
    clearRouteHazardPopup()

    visibleRouteHazards.forEach((hazard) => {
      const markerElement = document.createElement("button")
      markerElement.type = "button"
      markerElement.className = "route-hazard-marker"
      markerElement.style.width = "30px"
      markerElement.style.height = "30px"
      markerElement.style.borderRadius = "9999px"
      markerElement.style.border = "2px solid white"
      markerElement.style.background = hazard.hazard_type === "tsunami" ? "#1d4ed8" : "#f97316"
      markerElement.style.color = "white"
      markerElement.style.boxShadow = "0 6px 16px rgba(15,23,42,0.28)"
      markerElement.style.cursor = "pointer"

      const root = createRoot(markerElement)
      root.render(<AlertTriangle className="h-4 w-4" />)

      const markerInstance = new mapboxgl.Marker(markerElement)
        .setLngLat(hazard.coordinates)
        .addTo(mapRef.current!)

      markerElement.addEventListener("click", (event) => {
        event.stopPropagation()
        clearRouteHazardPopup()

        const popupContent = document.createElement("div")
        popupContent.className = "space-y-3 p-1"

        const title = document.createElement("div")
        const titleText = document.createElement("div")
        titleText.style.fontWeight = "700"
        titleText.style.fontSize = "14px"
        titleText.textContent = hazard.title
        const summaryText = document.createElement("div")
        summaryText.style.fontSize = "12px"
        summaryText.style.color = "#475569"
        summaryText.textContent = hazard.summary
        title.appendChild(titleText)
        title.appendChild(summaryText)
        popupContent.appendChild(title)

        const meta = document.createElement("div")
        meta.style.fontSize = "12px"
        meta.style.color = "#334155"
        meta.textContent = `${hazard.area_label} / ${hazard.depth_label}`
        popupContent.appendChild(meta)

        const button = document.createElement("button")
        button.type = "button"
        button.textContent = "災害イメージを見る"
        button.style.width = "100%"
        button.style.borderRadius = "8px"
        button.style.border = "0"
        button.style.padding = "8px 12px"
        button.style.background = "#0f172a"
        button.style.color = "#fff"
        button.style.fontSize = "12px"
        button.style.fontWeight = "600"
        button.style.cursor = "pointer"
        button.addEventListener("click", () => {
          onHazardDetail(hazard)
        })
        popupContent.appendChild(button)

        routeHazardPopupRef.current = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          offset: 16,
          maxWidth: "280px",
        })
          .setLngLat(hazard.coordinates)
          .setDOMContent(popupContent)
          .addTo(mapRef.current!)
      })

      routeHazardMarkersRef.current.push(markerInstance)
    })

    return () => {
      clearRouteHazardMarkers()
      clearRouteHazardPopup()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearRouteHazardMarkers, clearRouteHazardPopup, visibleRouteHazards])

  return { clearRouteHazardMarkers, clearRouteHazardPopup }
}
