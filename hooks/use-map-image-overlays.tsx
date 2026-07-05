"use client"

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react"
import { createRoot } from "react-dom/client"
import mapboxgl from "mapbox-gl"
import type { DangerReport } from "@/lib/types"
import { MapImagePopupContent } from "@/components/map/map-image-popup-content"

export interface MapImageOverlayEntry {
  id: string
  url: string
  reportId?: string
  reportTitle?: string | null
  type?: "original" | "processed"
  index?: number
  coordinates: [number, number]
  hasError?: boolean
}

interface UseMapImageOverlaysParams {
  mapRef: MutableRefObject<mapboxgl.Map | null>
  supabase: any
  combinedReports: DangerReport[]
}

/**
 * 地図上の画像プレビュー用ポップアップ（mapboxgl.Popup + createRoot の独立Reactツリー）の
 * ライフサイクル管理を担うフック。オーバーレイ state と署名URL付き画像プレビュー state を保持し、
 * 対応するレポートが消えたオーバーレイの掃除・ポップアップの生成/更新/破棄を行う。
 * map-container.tsx から挙動を変えずに抽出。
 */
export function useMapImageOverlays({ mapRef, supabase, combinedReports }: UseMapImageOverlaysParams) {
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [mapImageOverlays, setMapImageOverlays] = useState<MapImageOverlayEntry[]>([])
  const mapImagePopupRefs = useRef<Map<string, mapboxgl.Popup>>(new Map())
  const mapImagePopupRootRefs = useRef<Map<string, ReturnType<typeof createRoot>>>(new Map())

  const destroyAllMapImagePopups = useCallback(() => {
    const popupRefs = mapImagePopupRefs.current
    const rootRefs = mapImagePopupRootRefs.current

    rootRefs.forEach((root) => {
      Promise.resolve().then(() => root.unmount())
    })
    rootRefs.clear()

    popupRefs.forEach((popup) => {
      popup.remove()
    })
    popupRefs.clear()
  }, [])

  // 対応レポートが消えたオーバーレイを取り除く
  useEffect(() => {
    setMapImageOverlays((prev) => {
      if (prev.length === 0) return prev

      const validReportIds = new Set(combinedReports.map((report) => report.id))
      const filtered = prev.filter((overlay) => !overlay.reportId || validReportIds.has(overlay.reportId))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [combinedReports])

  useEffect(() => {
    if (!mapRef.current) return

    const mapInstance = mapRef.current
    const popupRefs = mapImagePopupRefs.current
    const rootRefs = mapImagePopupRootRefs.current
    const activeOverlayIds = new Set(mapImageOverlays.map((overlay) => overlay.id))

    popupRefs.forEach((popup, id) => {
      if (!activeOverlayIds.has(id)) {
        popup.remove()
        popupRefs.delete(id)

        const root = rootRefs.get(id)
        if (root) {
          Promise.resolve().then(() => root.unmount())
          rootRefs.delete(id)
        }
      }
    })

    mapImageOverlays.forEach((overlay) => {
      if (!overlay.coordinates) return

      let popup = popupRefs.get(overlay.id)
      if (!popup) {
        popup = new mapboxgl.Popup({
          closeButton: true,
          closeOnClick: false,
          anchor: "top",
          offset: [0, -18],
          className: "map-image-popup",
        }).addTo(mapInstance)

        popup.on("close", () => {
          setMapImageOverlays((prev) => prev.filter((entry) => entry.id !== overlay.id))
        })

        popupRefs.set(overlay.id, popup)
      }

      popup.setLngLat(overlay.coordinates)

      let root = rootRefs.get(overlay.id)
      if (!root) {
        const container = document.createElement("div")
        popup.setDOMContent(container)
        root = createRoot(container)
        rootRefs.set(overlay.id, root)
      }

      root.render(
        <MapImagePopupContent
          url={overlay.url}
          hasError={overlay.hasError ?? false}
          supabase={supabase}
          onPreview={(resolvedUrl) => setPreviewImage(resolvedUrl)}
          onRetry={() =>
            setMapImageOverlays((prev) =>
              prev.map((entry) =>
                entry.id === overlay.id ? { ...entry, hasError: false } : entry
              )
            )
          }
          onImageError={() =>
            setMapImageOverlays((prev) =>
              prev.map((entry) =>
                entry.id === overlay.id ? { ...entry, hasError: true } : entry
              )
            )
          }
        />
      )
    })
  }, [mapImageOverlays, setPreviewImage, supabase, mapRef])

  useEffect(() => destroyAllMapImagePopups, [destroyAllMapImagePopups])

  return { mapImageOverlays, setMapImageOverlays, previewImage, setPreviewImage }
}
