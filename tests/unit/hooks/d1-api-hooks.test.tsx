import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const auth = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: { user: { id: "user-1" } } } })),
  getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}))
const toast = vi.hoisted(() => vi.fn())

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({ supabase: { auth } }),
}))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast }) }))

import { useDangerReports } from "@/hooks/use-danger-reports"
import { useLandingReportReactions } from "@/hooks/use-landing-report-reactions"
import { useReportComments } from "@/hooks/use-report-comments"
import { ROUTE_LINE_UNAVAILABLE_MESSAGE, useRouteDangers } from "@/hooks/use-route-dangers"
import { saveLocalRouteGeometry } from "@/lib/route-local-geometry"
import { useUserRoutes } from "@/hooks/use-user-routes"

const originalFetch = global.fetch
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
})

beforeEach(() => {
  vi.clearAllMocks()
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } })
  auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } })
})
afterEach(() => { global.fetch = originalFetch })

describe("D1 API backed hooks", () => {
  it("encodes report filters and separates pending reports", async () => {
    const fetchMock = vi.fn(async () => json({ reports: [
      { id: "approved", status: "approved" }, { id: "pending", status: "pending" },
    ] }))
    global.fetch = fetchMock as typeof fetch
    const setIsLoading = vi.fn()
    const { result } = renderHook(() => useDangerReports({
      supabase: { auth }, toast, setIsLoading,
      filterOptions: {
        dangerType: "suspicious", dangerLevel: "4", dateRange: "all", showPending: true,
        prefecture: "東京都", bounds: { minLng: 139, minLat: 35, maxLng: 140, maxLat: 36 },
      },
    }))
    await waitFor(() => expect(result.current.dangerReports).toHaveLength(1))
    expect(result.current.pendingReports).toHaveLength(1)
    const requested = new URL(String(fetchMock.mock.calls[0][0]), "https://example.test")
    expect(requested.searchParams.get("dangerType")).toBe("suspicious")
    expect(requested.searchParams.get("minimumDangerLevel")).toBe("4")
    expect(requested.searchParams.get("prefecture")).toBe("東京都")
    expect(requested.searchParams.get("minLng")).toBe("139")
    expect(setIsLoading).toHaveBeenCalledWith(true)
    expect(setIsLoading).toHaveBeenLastCalledWith(false)
  })

  it("loads and posts report comments through the route handler", async () => {
    const comment = { id: "c1", content: "安全確認", created_at: "now", updated_at: "now", user_id: "u1", report_id: "r1", is_edited: false, parent_comment_id: null, profiles: null }
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST" ? json({ comment }, 201) : json({ comments: [comment] }))
    global.fetch = fetchMock as typeof fetch
    const { result } = renderHook(() => useReportComments("r1"))
    await waitFor(() => expect(result.current.comments).toEqual([comment]))
    await act(async () => { expect(await result.current.addComment(" 安全確認 ")).toBe(true) })
    expect(fetchMock).toHaveBeenCalledWith("/api/reports/r1/comments", expect.objectContaining({
      method: "POST", body: JSON.stringify({ content: "安全確認" }),
    }))
  })

  it("loads routes, derives child profiles, and posts a new route", async () => {
    const routes = [
      { id: "r1", name: "学校", child_id: "child-1", child_name: "太郎", is_favorite: true },
      { id: "r2", name: "塾", child_id: null, child_name: null, is_favorite: false },
    ]
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === "POST" ? json({ route: routes[0] }, 201) : json({ routes }))
    global.fetch = fetchMock as typeof fetch
    const { result } = renderHook(() => useUserRoutes())
    await waitFor(() => expect(result.current.routes).toHaveLength(2))
    expect(result.current.primaryRoute?.id).toBe("r1")
    expect(result.current.childProfiles).toEqual(expect.arrayContaining([
      { id: "all", label: "すべて", routeCount: 2 },
      { id: "child-1", label: "太郎", routeCount: 1 },
      { id: "shared", label: "共通", routeCount: 1 },
    ]))
    await act(async () => { expect(await result.current.addRoute({ name: "新ルート" })).toBe(true) })
    expect(fetchMock).toHaveBeenCalledWith("/api/routes", expect.objectContaining({ method: "POST" }))
  })

  it("移行前の id(child-名前)と新しい id で同じ呼び名の通学路は、1人の子どもにまとめる", async () => {
    const route = (id: string, childId: string | null, childName: string | null) => ({
      id, user_id: "user-1", name: id, child_id: childId, child_name: childName, is_favorite: false,
      start_lat: 35.69, start_lng: 139.69, end_lat: 35.69, end_lng: 139.7, start_address: "東京都新宿区", end_address: "東京都新宿区",
      route_geometry: null, created_at: "2026-10-29T00:00:00.000Z", updated_at: "2026-10-29T00:00:00.000Z",
    })
    global.fetch = vi.fn(async () => json({ routes: [route("legacy", "child-さくら", "さくら"), route("new", "c-uuid-1", "さくら"), route("shared", null, null)] })) as typeof fetch

    const { result } = renderHook(() => useUserRoutes())

    await waitFor(() => expect(result.current.routes).toHaveLength(3))
    const named = result.current.childProfiles.filter((profile) => profile.label === "さくら")
    expect(named).toHaveLength(1)
    expect(named[0]?.routeCount).toBe(2)
  })

  it("loads and toggles landing reactions through the D1 API", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST"
      ? json({ active: false })
      : json({ reactions: [{ report_id: "r1", reaction_type: "helpful" }] }))
    global.fetch = fetchMock as typeof fetch
    const { result } = renderHook(() => useLandingReportReactions(["r1"]))
    await waitFor(() => expect(result.current.reactions.r1).toEqual({ helpful: true, caution: false }))
    await act(async () => { await result.current.toggleReaction("r1", "helpful") })
    expect(fetchMock).toHaveBeenCalledWith("/api/reactions", expect.objectContaining({
      method: "POST", body: JSON.stringify({ reportId: "r1", reactionType: "helpful" }),
    }))
  })

  it("loads route geometry and filters nearby public reports", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/api/routes/")
      ? json({ route: { id: "route-1", route_geometry: { type: "LineString", coordinates: [[139, 35], [139.001, 35]] } } })
      : json({ reports: [{ id: "danger-1", latitude: 35, longitude: 139.0005, status: "approved" }] }))
    global.fetch = fetchMock as typeof fetch
    const { result } = renderHook(() => useRouteDangers("route-1", 100))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.dangers.map((danger) => danger.id)).toEqual(["danger-1"])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("作った端末では、手元に残した元の線(両端を削る前)で近くの報告を探す", async () => {
    localStorage.clear()
    // サーバーの線は両端を削ってあり、端の近くの報告(139.0005)まで届かない
    saveLocalRouteGeometry("user-1", "route-local", {
      start_lat: 35, start_lng: 139, end_lat: 35, end_lng: 139.02,
      start_address: "東京都新宿区西新宿2丁目8-1", end_address: "東京都新宿区西新宿3丁目",
      route_geometry: { type: "LineString", coordinates: [[139, 35], [139.02, 35]] },
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).startsWith("/api/routes/")
      ? json({ route: { id: "route-local", user_id: "user-1", route_geometry: { type: "LineString", coordinates: [[139.01, 35], [139.015, 35]] } } })
      : json({ reports: [{ id: "danger-1", latitude: 35, longitude: 139.0005, status: "approved" }] }))
    global.fetch = fetchMock as typeof fetch

    const { result } = renderHook(() => useRouteDangers("route-local", 100))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeNull()
    expect(result.current.dangers.map((danger) => danger.id)).toEqual(["danger-1"])
    localStorage.clear()
  })

  it("サーバーにも手元にも道すじが無いときは、そう知らせる(短い通学路・「粗く保存」)", async () => {
    localStorage.clear()
    const fetchMock = vi.fn(async () => json({ route: { id: "route-short", user_id: "user-1", route_geometry: null } }))
    global.fetch = fetchMock as typeof fetch

    const { result } = renderHook(() => useRouteDangers("route-short", 100))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe(ROUTE_LINE_UNAVAILABLE_MESSAGE)
  })
})
