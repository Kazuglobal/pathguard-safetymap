import { describe, it, expect } from "vitest"
import {
  CURRENT_LOCATION_ZOOM,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  ROUTE_MAX_ZOOM,
  ROUTE_MIN_ZOOM,
  getCurrentLocationMapView,
  getFallbackMapView,
  getRouteMapView,
  resolveInitialMapView,
  resolveRouteMapView,
} from "@/lib/map-center"
import type { UserRoute } from "@/lib/types"

const makeRoute = (overrides: Partial<UserRoute> = {}): UserRoute => ({
  id: "route-1",
  user_id: "user-1",
  name: "テストルート",
  description: null,
  child_id: null,
  child_name: null,
  start_lat: 35.68,
  start_lng: 139.7,
  end_lat: 35.69,
  end_lng: 139.71,
  start_address: "自宅",
  end_address: "学校",
  route_geometry: null,
  distance_meters: null,
  estimated_time_minutes: null,
  is_favorite: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
})

describe("getRouteMapView", () => {
  it("start/end の中間点を center（[lng, lat]）として返す", () => {
    const view = getRouteMapView(makeRoute())
    expect(view).not.toBeNull()
    expect(view!.center[0]).toBeCloseTo((139.7 + 139.71) / 2, 6)
    expect(view!.center[1]).toBeCloseTo((35.68 + 35.69) / 2, 6)
    expect(view!.source).toBe("route")
  })

  it("route_geometry があれば bbox の中心を優先する", () => {
    const view = getRouteMapView(
      makeRoute({
        route_geometry: {
          type: "LineString",
          coordinates: [
            [139.5, 35.6],
            [139.6, 35.65],
            [139.7, 35.7],
          ],
        },
      }),
    )
    expect(view!.center).toEqual([(139.5 + 139.7) / 2, (35.6 + 35.7) / 2])
  })

  it("route_geometry の有効座標が2未満なら start/end へフォールバックする", () => {
    const view = getRouteMapView(
      makeRoute({
        route_geometry: {
          type: "LineString",
          coordinates: [[139.5, 35.6], [NaN, NaN]],
        },
      }),
    )
    expect(view!.center[0]).toBeCloseTo((139.7 + 139.71) / 2, 6)
  })

  it("有効な座標が1つもなければ null を返す", () => {
    const view = getRouteMapView(
      makeRoute({ start_lat: NaN, start_lng: NaN, end_lat: 999, end_lng: 999 }),
    )
    expect(view).toBeNull()
  })

  it("片方の端点だけ有効ならその地点を中心にし最大ズームにする", () => {
    const view = getRouteMapView(
      makeRoute({ end_lat: NaN, end_lng: NaN }),
    )
    expect(view!.center).toEqual([139.7, 35.68])
    expect(view!.zoom).toBe(ROUTE_MAX_ZOOM)
  })

  it("ズームはルート規模に応じて 13〜15 にクランプされる", () => {
    // ごく短いルート（約200m）→ 上限15
    const short = getRouteMapView(
      makeRoute({ start_lat: 35.68, end_lat: 35.6818, start_lng: 139.7, end_lng: 139.7 }),
    )
    expect(short!.zoom).toBe(ROUTE_MAX_ZOOM)

    // 非常に長いルート（緯度0.5度 ≒ 55km）→ 下限13
    const long = getRouteMapView(
      makeRoute({ start_lat: 35.5, end_lat: 36.0, start_lng: 139.7, end_lng: 139.7 }),
    )
    expect(long!.zoom).toBe(ROUTE_MIN_ZOOM)
  })
})

describe("resolveRouteMapView", () => {
  it("primaryRoute を最優先で使う", () => {
    const primary = makeRoute({ id: "primary", start_lng: 140.0, end_lng: 140.0, is_favorite: true })
    const other = makeRoute({ id: "other", created_at: "2026-06-01T00:00:00Z" })
    const view = resolveRouteMapView(primary, [other, primary])
    expect(view!.center[0]).toBeCloseTo(140.0, 6)
  })

  it("primaryRoute の座標が無効なら最新登録ルートへフォールバックする", () => {
    const primary = makeRoute({
      id: "primary",
      start_lat: NaN,
      start_lng: NaN,
      end_lat: NaN,
      end_lng: NaN,
      is_favorite: true,
    })
    const older = makeRoute({ id: "older", start_lng: 138.0, end_lng: 138.0, created_at: "2026-01-01T00:00:00Z" })
    const newer = makeRoute({ id: "newer", start_lng: 141.0, end_lng: 141.0, created_at: "2026-06-01T00:00:00Z" })
    const view = resolveRouteMapView(primary, [older, newer, primary])
    expect(view!.center[0]).toBeCloseTo(141.0, 6)
  })

  it("primaryRoute が無ければ最新登録ルートを使う", () => {
    const older = makeRoute({ id: "older", start_lng: 138.0, end_lng: 138.0, created_at: "2026-01-01T00:00:00Z" })
    const newer = makeRoute({ id: "newer", start_lng: 141.0, end_lng: 141.0, created_at: "2026-06-01T00:00:00Z" })
    const view = resolveRouteMapView(null, [older, newer])
    expect(view!.center[0]).toBeCloseTo(141.0, 6)
  })

  it("ルートが1件も無ければ null を返す", () => {
    expect(resolveRouteMapView(null, [])).toBeNull()
  })

  it("入力の routes 配列を変更しない（不変性）", () => {
    const routes = [
      makeRoute({ id: "a", created_at: "2026-01-01T00:00:00Z" }),
      makeRoute({ id: "b", created_at: "2026-06-01T00:00:00Z" }),
    ]
    resolveRouteMapView(null, routes)
    expect(routes.map((r) => r.id)).toEqual(["a", "b"])
  })
})

describe("getCurrentLocationMapView", () => {
  it("有効な現在地なら現在地ズームのビューを返す", () => {
    const view = getCurrentLocationMapView([139.71, 35.66])
    expect(view).toEqual({
      center: [139.71, 35.66],
      zoom: CURRENT_LOCATION_ZOOM,
      source: "current-location",
    })
  })

  it("null や不正座標なら null を返す", () => {
    expect(getCurrentLocationMapView(null)).toBeNull()
    expect(getCurrentLocationMapView([NaN, NaN])).toBeNull()
    expect(getCurrentLocationMapView([139.7, 999])).toBeNull()
  })
})

describe("getFallbackMapView", () => {
  it("東京固定座標と既定ズームを返す", () => {
    expect(getFallbackMapView()).toEqual({
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      source: "fallback",
    })
  })
})

describe("resolveInitialMapView", () => {
  it("優先順位: ルート → 現在地 → フォールバック", () => {
    const route = makeRoute()

    const withRoute = resolveInitialMapView({
      primaryRoute: route,
      routes: [route],
      currentLocation: [139.71, 35.66],
    })
    expect(withRoute.source).toBe("route")

    const withLocation = resolveInitialMapView({
      primaryRoute: null,
      routes: [],
      currentLocation: [139.71, 35.66],
    })
    expect(withLocation.source).toBe("current-location")

    const fallback = resolveInitialMapView({
      primaryRoute: null,
      routes: [],
      currentLocation: null,
    })
    expect(fallback.source).toBe("fallback")
    expect(fallback.center).toEqual(DEFAULT_MAP_CENTER)
  })
})
