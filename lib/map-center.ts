import { isValidCoordinates } from "@/lib/coordinates"
import type { UserRoute } from "@/lib/types"

/** 従来の固定初期表示（東京）。最終フォールバックとしてのみ使う */
export const DEFAULT_MAP_CENTER: [number, number] = [139.6917, 35.6895]
export const DEFAULT_MAP_ZOOM = 12
/** 現在地中心で表示するときのズーム */
export const CURRENT_LOCATION_ZOOM = 15
/** ルート中心表示のズーム範囲（極端なズームイン/アウトを避ける） */
export const ROUTE_MIN_ZOOM = 13
export const ROUTE_MAX_ZOOM = 15

export type InitialMapViewSource = "route" | "current-location" | "fallback"

export interface InitialMapView {
  /** [longitude, latitude]（Mapbox規約） */
  center: [number, number]
  zoom: number
  source: InitialMapViewSource
}

/**
 * ルートから中心計算に使える座標列（[lng, lat]）を返す。
 * route_geometry（LineString）があればそのbboxを、なければ start/end の2点を使う。
 */
function collectRouteCoordinates(route: UserRoute): Array<[number, number]> {
  const geometryCoords = (route.route_geometry?.coordinates ?? [])
    .filter(
      (coord): coord is [number, number] =>
        Array.isArray(coord) &&
        coord.length >= 2 &&
        isValidCoordinates(coord[1], coord[0]),
    )
    .map((coord) => [coord[0], coord[1]] as [number, number])
  if (geometryCoords.length >= 2) {
    return geometryCoords
  }

  const endpoints: Array<[number, number]> = []
  if (isValidCoordinates(route.start_lat, route.start_lng)) {
    endpoints.push([route.start_lng, route.start_lat])
  }
  if (isValidCoordinates(route.end_lat, route.end_lng)) {
    endpoints.push([route.end_lng, route.end_lat])
  }
  return endpoints
}

function zoomForSpan(spanDegrees: number): number {
  if (!Number.isFinite(spanDegrees) || spanDegrees <= 0) {
    return ROUTE_MAX_ZOOM
  }
  // 全世界=360度を基準に、余白込み（2.5倍）でルート全体が収まるズームを概算する
  const zoom = Math.floor(Math.log2(360 / (spanDegrees * 2.5)))
  return Math.min(ROUTE_MAX_ZOOM, Math.max(ROUTE_MIN_ZOOM, zoom))
}

/**
 * 1本のルートに対する初期表示（bbox中心 + ルート全体が収まる目安のズーム）を返す。
 * 有効な座標が1つもなければ null。
 */
export function getRouteMapView(route: UserRoute): InitialMapView | null {
  const coords = collectRouteCoordinates(route)
  if (coords.length === 0) {
    return null
  }

  // spread による Math.min/max は頂点数が多い geometry でスタックを圧迫しうるため reduce で求める
  let minLng = coords[0][0]
  let maxLng = coords[0][0]
  let minLat = coords[0][1]
  let maxLat = coords[0][1]
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng)
    maxLng = Math.max(maxLng, lng)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }
  const center: [number, number] = [(minLng + maxLng) / 2, (minLat + maxLat) / 2]

  // 経度1度の実距離は緯度で縮むため補正し、大きい方のスパンでズームを決める
  const latSpan = maxLat - minLat
  const lngSpan = (maxLng - minLng) * Math.cos((center[1] * Math.PI) / 180)
  return { center, zoom: zoomForSpan(Math.max(latSpan, lngSpan)), source: "route" }
}

/**
 * お気に入りルート → 最新登録ルートの順で、有効な初期表示を持つ最初のルートを採用する。
 */
export function resolveRouteMapView(
  primaryRoute: UserRoute | null,
  routes: UserRoute[],
): InitialMapView | null {
  const candidates = [
    ...(primaryRoute ? [primaryRoute] : []),
    ...[...routes]
      .filter((route) => route.id !== primaryRoute?.id)
      .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
  ]

  for (const route of candidates) {
    const view = getRouteMapView(route)
    if (view) {
      return view
    }
  }
  return null
}

export function getCurrentLocationMapView(
  location: [number, number] | null,
): InitialMapView | null {
  if (!location || !isValidCoordinates(location[1], location[0])) {
    return null
  }
  return {
    center: [location[0], location[1]],
    zoom: CURRENT_LOCATION_ZOOM,
    source: "current-location",
  }
}

export function getFallbackMapView(): InitialMapView {
  return {
    center: [DEFAULT_MAP_CENTER[0], DEFAULT_MAP_CENTER[1]],
    zoom: DEFAULT_MAP_ZOOM,
    source: "fallback",
  }
}

/**
 * 初期表示の決定（優先順: 登録ルート → 現在地 → 東京フォールバック）。
 */
export function resolveInitialMapView(args: {
  primaryRoute: UserRoute | null
  routes: UserRoute[]
  currentLocation: [number, number] | null
}): InitialMapView {
  return (
    resolveRouteMapView(args.primaryRoute, args.routes) ??
    getCurrentLocationMapView(args.currentLocation) ??
    getFallbackMapView()
  )
}
