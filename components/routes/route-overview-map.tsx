"use client"

import { useCallback, useMemo, useRef } from "react"
import Map, { Layer, Source, type MapRef } from "react-map-gl/mapbox"
import "mapbox-gl/dist/mapbox-gl.css"
import { localizeMapLabels } from "@/lib/hunter/map-labels"
import { tankenTokens } from "@/lib/design/tanken"
import { DEFAULT_MAPBOX_STYLE } from "@/lib/mapbox-config"
import type { UserRoute } from "@/lib/types"

interface RouteOverviewMapProps {
  routes: UserRoute[]
  mapToken: string
}

interface Bounds {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

function computeBounds(routes: UserRoute[]): Bounds | null {
  let bounds: Bounds | null = null

  for (const route of routes) {
    const coordinates = route.route_geometry?.coordinates
    if (!coordinates) continue

    for (const [lng, lat] of coordinates) {
      if (typeof lng !== "number" || typeof lat !== "number") continue
      if (!bounds) {
        bounds = { minLng: lng, minLat: lat, maxLng: lng, maxLat: lat }
        continue
      }
      bounds.minLng = Math.min(bounds.minLng, lng)
      bounds.minLat = Math.min(bounds.minLat, lat)
      bounds.maxLng = Math.max(bounds.maxLng, lng)
      bounds.maxLat = Math.max(bounds.maxLat, lat)
    }
  }

  return bounds
}

/**
 * 通学路一覧の下に置く、読み取り専用の全体マップ。
 * 登録済みルートのジオメトリ全体が収まるよう fitBounds し、日本語ラベルを優先する。
 */
export function RouteOverviewMap({ routes, mapToken }: RouteOverviewMapProps) {
  const bounds = useMemo(() => computeBounds(routes), [routes])

  const linesGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    return {
      type: "FeatureCollection",
      features: routes
        .filter((route) => route.route_geometry)
        .map((route) => ({
          type: "Feature" as const,
          properties: { id: route.id },
          geometry: route.route_geometry as GeoJSON.LineString,
        })),
    }
  }, [routes])

  const initialViewState = useMemo(() => {
    if (!bounds) {
      return { longitude: 139.753, latitude: 35.6844, zoom: 12 }
    }
    return {
      longitude: (bounds.minLng + bounds.maxLng) / 2,
      latitude: (bounds.minLat + bounds.maxLat) / 2,
      zoom: 13,
    }
  }, [bounds])

  const mapRef = useRef<MapRef | null>(null)

  const localize = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return
    try {
      localizeMapLabels(map)
    } catch {
      // ラベル日本語化に失敗しても地図表示は継続する。
    }
  }, [])

  const handleLoad = useCallback(() => {
    localize()

    const map = mapRef.current?.getMap()
    if (
      map &&
      bounds &&
      (bounds.maxLng - bounds.minLng > 0 || bounds.maxLat - bounds.minLat > 0)
    ) {
      map.fitBounds(
        [
          [bounds.minLng, bounds.minLat],
          [bounds.maxLng, bounds.maxLat],
        ],
        { padding: 48, duration: 0, maxZoom: 16 }
      )
    }
  }, [bounds, localize])

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={mapToken}
      mapStyle={DEFAULT_MAPBOX_STYLE}
      initialViewState={initialViewState}
      onLoad={handleLoad}
      onStyleData={localize}
      attributionControl={false}
      style={{ width: "100%", height: "100%" }}
      cursor="grab"
    >
      {linesGeoJson.features.length > 0 && (
        <Source id="route-overview-lines" type="geojson" data={linesGeoJson}>
          <Layer
            id="route-overview-line-casing"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": "#ffffff", "line-width": 7 }}
          />
          <Layer
            id="route-overview-line"
            type="line"
            layout={{ "line-join": "round", "line-cap": "round" }}
            paint={{ "line-color": tankenTokens.color.primary, "line-width": 4 }}
          />
        </Source>
      )}
    </Map>
  )
}
