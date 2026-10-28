import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  context: { supabase: {} } as { supabase: unknown } | undefined,
}))

vi.mock("@/components/providers/supabase-provider", () => ({
  useOptionalSupabase: () => h.context,
  useSupabase: () => h.context,
}))

import { useRouteDangerCounts } from "@/hooks/use-route-danger-counts"
import { useRouteDangers } from "@/hooks/use-route-dangers"
import { findDangersNearRoute, sortDangersByRoutePosition } from "@/lib/geo/route-danger-finder"
import { buildPublicReportsUrl, invalidateFetchCache } from "@/lib/reports-fetch-cache"
import type { DangerReport } from "@/lib/types"
import { mockRoutes } from "../../fixtures/routes"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const [routeA, routeB, routeWithoutGeometry] = mockRoutes

// routeA の頂点・routeB の頂点・両方の出発点のそば・遠くの大阪
const reports = [
  { id: "near-a", latitude: 35.69, longitude: 139.695, status: "approved" },
  { id: "near-b", latitude: 35.692, longitude: 139.698, status: "approved" },
  { id: "shared-start", latitude: 35.6895, longitude: 139.6918, status: "published" },
  { id: "far-away", latitude: 34.7, longitude: 135.5, status: "approved" },
] as DangerReport[]

const expectedCounts = () => ({
  [routeA.id]: findDangersNearRoute(routeA.route_geometry!, reports, 100).length,
  [routeB.id]: findDangersNearRoute(routeB.route_geometry!, reports, 100).length,
})

let fetchMock: ReturnType<typeof vi.fn>

const publicReportRequests = () =>
  fetchMock.mock.calls.filter(([url]) => url === buildPublicReportsUrl()).length

function serveRoutesAndReports(reportsResponse: () => Response | Promise<Response> = () => json({ reports })) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/routes/")) {
      const id = decodeURIComponent(url.slice("/api/routes/".length))
      return json({ route: mockRoutes.find((item) => item.id === id) })
    }
    if (url === buildPublicReportsUrl()) return reportsResponse()
    throw new Error(`unexpected request: ${url}`)
  })
}

beforeEach(() => {
  h.context = { supabase: {} }
  invalidateFetchCache()
  fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useRouteDangerCounts", () => {
  it("useRouteDangers と同じ通報の取得を 1 回で共有し、件数は findDangersNearRoute と同じになる", async () => {
    serveRoutesAndReports()

    const { result } = renderHook(() => ({
      list: useRouteDangerCounts(mockRoutes),
      detail: useRouteDangers(routeA.id, 100),
    }))

    await waitFor(() => {
      expect(result.current.list.isLoading).toBe(false)
      expect(result.current.detail.isLoading).toBe(false)
    })

    expect(publicReportRequests()).toBe(1)
    expect(result.current.list.counts).toEqual(expectedCounts())
    expect(result.current.list.counts[routeA.id]).toBeGreaterThan(0)
    expect(result.current.list.counts[routeB.id]).toBeGreaterThan(0)
    expect(result.current.list.counts).not.toHaveProperty(routeWithoutGeometry.id)

    const expectedDetail = sortDangersByRoutePosition(
      routeA.route_geometry!,
      findDangersNearRoute(routeA.route_geometry!, reports, 100)
    )
    expect(result.current.detail.dangers.map((danger) => danger.id)).toEqual(
      expectedDetail.map((danger) => danger.id)
    )
  })

  it("最初の描画から「確認中」で、数え終えたら isLoading が下がる", async () => {
    const pending = deferred<Response>()
    serveRoutesAndReports(() => pending.promise)
    const loadingHistory: boolean[] = []

    const { result } = renderHook(() => {
      const value = useRouteDangerCounts(mockRoutes)
      loadingHistory.push(value.isLoading)
      return value
    })

    expect(loadingHistory[0]).toBe(true)
    expect(result.current.counts).toEqual({})

    await act(async () => {
      pending.resolve(json({ reports }))
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.counts).toEqual(expectedCounts())
  })

  it("座標が数値でない通報は数えない（従来どおり）", async () => {
    serveRoutesAndReports(() =>
      json({ reports: [...reports, { id: "broken", latitude: null, longitude: null, status: "approved" }] })
    )

    const { result } = renderHook(() => useRouteDangerCounts(mockRoutes))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.counts).toEqual(expectedCounts())
  })

  it("取得に失敗したら件数は空にして、確認中もやめる", async () => {
    serveRoutesAndReports(() => json({ error: "boom" }, 500))

    const { result } = renderHook(() => useRouteDangerCounts(mockRoutes))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.counts).toEqual({})
  })

  it("ルートを追加して数え直すあいだも、もとからあるルートの件数は出したままにする", async () => {
    serveRoutesAndReports()

    const { result, rerender } = renderHook(({ routes }) => useRouteDangerCounts(routes), {
      initialProps: { routes: [routeA] },
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    const countA = result.current.counts[routeA.id]

    rerender({ routes: [routeA, routeB] })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.counts[routeA.id]).toBe(countA)

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.counts).toEqual(expectedCounts())
    // 60 秒以内の数え直しは同じ取得結果を使う
    expect(publicReportRequests()).toBe(1)
  })

  it("ジオメトリのあるルートが無ければ取りにいかない", () => {
    const { result } = renderHook(() => useRouteDangerCounts([routeWithoutGeometry]))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.counts).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("Supabase プロバイダが無い環境では何も取得しない", () => {
    h.context = undefined

    const { result } = renderHook(() => useRouteDangerCounts(mockRoutes))

    expect(result.current.isLoading).toBe(false)
    expect(result.current.counts).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("useRouteDangers と共有キャッシュ", () => {
  it("60 秒以内に開き直したときは通報を取り直さない（ルートだけ取り直す）", async () => {
    serveRoutesAndReports()

    const first = renderHook(() => useRouteDangers(routeA.id, 100))
    await waitFor(() => expect(first.result.current.isLoading).toBe(false))
    first.unmount()

    const second = renderHook(() => useRouteDangers(routeA.id, 100))
    await waitFor(() => expect(second.result.current.isLoading).toBe(false))

    expect(publicReportRequests()).toBe(1)
    expect(second.result.current.dangers.length).toBeGreaterThan(0)
  })

  it("refetch() は共有キャッシュを使わずに通報を取り直す", async () => {
    serveRoutesAndReports()

    const { result } = renderHook(() => useRouteDangers(routeA.id, 100))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(publicReportRequests()).toBe(1)

    act(() => {
      result.current.refetch()
    })

    await waitFor(() => expect(publicReportRequests()).toBe(2))
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeNull()
  })

  it("通報の取得が 2xx 以外なら従来どおりの文言を出す", async () => {
    serveRoutesAndReports(() => json({ error: "boom" }, 503))

    const { result } = renderHook(() => useRouteDangers(routeA.id, 100))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBe("危険箇所の取得に失敗しました")
    expect(result.current.dangers).toEqual([])
  })
})
