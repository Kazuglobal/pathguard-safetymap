import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => {
  const auth = {
    getSession: vi.fn(),
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  }
  return { auth, supabase: { auth } }
})

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({ supabase: h.supabase }),
}))

import { useUserRoutes } from "@/hooks/use-user-routes"
import { invalidateFetchCache } from "@/lib/reports-fetch-cache"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

const FULL_LINE: GeoJSON.LineString = { type: "LineString", coordinates: [[139.691706, 35.689634], [139.700512, 35.689634]] }

/** サーバーが返す、両端を削って丸めた通学路 */
const serverRoute = {
  id: "r1", user_id: "user-1", name: "登校", description: null, child_id: null, child_name: null,
  start_lat: 35.69, start_lng: 139.69, end_lat: 35.69, end_lng: 139.7,
  start_address: "東京都新宿区", end_address: "東京都新宿区",
  route_geometry: { type: "LineString", coordinates: [[139.6939, 35.6896], [139.6983, 35.6896]] },
  distance_meters: 800, estimated_time_minutes: 12, is_favorite: false,
  created_at: "2026-10-29T00:00:00.000Z", updated_at: "2026-10-29T00:00:00.000Z",
}

let routesOnServer: unknown[] = []

beforeEach(() => {
  localStorage.clear()
  invalidateFetchCache()
  routesOnServer = []
  h.auth.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } })
  h.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null })
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/routes" && init?.method === "POST") {
      routesOnServer = [serverRoute]
      return json({ route: serverRoute }, 201)
    }
    if (url.startsWith("/api/routes/") && init?.method === "DELETE") {
      routesOnServer = []
      return json({ deleted: true })
    }
    if (url === "/api/routes") return json({ routes: routesOnServer })
    return json({ reports: [] })
  }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useUserRoutes と端末に残す元の線(UIUX改装 項目59)", () => {
  it("作った端末では、サーバーの削った線ではなく元の線・起点・終点・住所を表示に使う", async () => {
    const { result } = renderHook(() => useUserRoutes())
    await waitFor(() => expect(result.current.isLoading).toBe(false))

    await act(async () => {
      await expect(result.current.addRoute({
        name: "登校",
        start_lat: 35.689634, start_lng: 139.691706, end_lat: 35.689634, end_lng: 139.700512,
        start_address: "東京都新宿区西新宿2丁目8-1", end_address: "東京都新宿区西新宿3丁目",
        route_geometry: FULL_LINE,
      })).resolves.toBe(true)
    })

    await waitFor(() => expect(result.current.routes).toHaveLength(1))
    expect(result.current.routes[0]).toMatchObject({
      id: "r1",
      start_lat: 35.689634,
      start_address: "東京都新宿区西新宿2丁目8-1",
      route_geometry: FULL_LINE,
      distance_meters: 800,
    })
  })

  it("通学路を消したら、端末に残した元の線も消す", async () => {
    const { result } = renderHook(() => useUserRoutes())
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => {
      await result.current.addRoute({
        name: "登校",
        start_lat: 35.689634, start_lng: 139.691706, end_lat: 35.689634, end_lng: 139.700512,
        start_address: "東京都新宿区西新宿2丁目8-1", end_address: "東京都新宿区西新宿3丁目",
        route_geometry: FULL_LINE,
      })
    })
    await waitFor(() => expect(result.current.routes).toHaveLength(1))
    // 削除の確認(唯一のお気に入りは消せない)に当たらないよう、お気に入りでない1本を消す
    await act(async () => {
      await expect(result.current.deleteRoute("r1")).resolves.toBe(true)
    })

    expect(localStorage.getItem("pathguardian:route-full-geometry:v1:user-1")).toBeNull()
  })
})
