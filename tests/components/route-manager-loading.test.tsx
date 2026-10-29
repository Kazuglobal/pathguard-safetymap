import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  userRoutes: null as unknown,
  supabaseContext: { supabase: {} } as { supabase: unknown } | undefined,
}))

vi.mock("@/hooks/use-user-routes", () => ({
  useUserRoutes: () => h.userRoutes,
}))

vi.mock("@/components/providers/supabase-provider", () => ({
  useOptionalSupabase: () => h.supabaseContext,
  useSupabase: () => h.supabaseContext,
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("@/lib/mapbox-config", () => ({
  DEFAULT_MAPBOX_STYLE: "mapbox://styles/test/streets",
  getMapboxToken: () => "pk.test-token",
}))

// 地図は描かず、最初の表示（initialViewState）だけを data 属性に残す
vi.mock("react-map-gl/mapbox", async () => {
  const { forwardRef, useImperativeHandle } = await import("react")
  return {
    default: forwardRef(function MockMap(
      { children, initialViewState }: { children?: ReactNode; initialViewState?: unknown },
      ref
    ) {
      useImperativeHandle(ref, () => ({
        flyTo: vi.fn(),
        getMap: () => ({ dragPan: { disable: vi.fn(), enable: vi.fn() } }),
      }))
      return (
        <div data-testid="mock-map" data-initial-view={JSON.stringify(initialViewState)}>
          {children}
        </div>
      )
    }),
    Layer: () => null,
    Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  }
})

import { RouteManager } from "@/components/map/route-manager"
import { findDangersNearRoute } from "@/lib/geo/route-danger-finder"
import { getRouteMapView } from "@/lib/map-center"
import { buildPublicReportsUrl, invalidateFetchCache } from "@/lib/reports-fetch-cache"
import type { DangerReport, UserRoute } from "@/lib/types"
import { mockEmptyRoutes, mockPrimaryRoute, mockRoutes } from "../fixtures/routes"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const reports = [
  { id: "near-a", latitude: 35.69, longitude: 139.695, status: "approved" },
  { id: "shared-start", latitude: 35.6895, longitude: 139.6918, status: "approved" },
  { id: "far-away", latitude: 34.7, longitude: 135.5, status: "approved" },
] as DangerReport[]

// routes は描画のたびに同じ参照を返すこと（新しい配列だと比較用の effect が回り続ける）
function setUserRoutes(overrides: { routes?: UserRoute[]; primaryRoute?: UserRoute | null; isLoading?: boolean }) {
  h.userRoutes = {
    routes: mockEmptyRoutes,
    primaryRoute: null,
    isLoading: false,
    error: null,
    addRoute: vi.fn(),
    updateRoute: vi.fn(),
    deleteRoute: vi.fn(),
    setPrimaryRoute: vi.fn(),
    refreshRoutes: vi.fn(),
    ...overrides,
  }
}

function initialViewOf(map: HTMLElement) {
  return JSON.parse(map.dataset.initialView ?? "null")
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  invalidateFetchCache()
  h.supabaseContext = { supabase: {} }
  fetchMock = vi.fn(async (url: string) =>
    url === buildPublicReportsUrl() ? json({ reports: [] }) : json({ error: `unexpected ${url}` }, 404)
  )
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("RouteManager の読み込み表示", () => {
  it("通学路のカードを先に出し、注意ポイント数はあとから埋める", async () => {
    setUserRoutes({ routes: mockRoutes, primaryRoute: mockPrimaryRoute })
    const pendingReports = deferred<Response>()
    fetchMock.mockImplementation((url: string) =>
      url === buildPublicReportsUrl() ? pendingReports.promise : Promise.resolve(json({}, 404))
    )

    render(<RouteManager />)

    const cards = screen.getAllByTestId("route-card")
    expect(cards).toHaveLength(3)
    // ジオメトリのある 2 本だけ「確認中」、ジオメトリの無いルートには出さない
    const pendingPills = screen.getAllByTestId("route-danger-count-pending")
    expect(pendingPills).toHaveLength(2)
    expect(pendingPills[0]).toHaveTextContent("注意ポイントを確認中…")
    expect(within(cards[2]).queryByTestId("route-danger-count-pending")).not.toBeInTheDocument()
    expect(screen.queryAllByTestId("route-danger-count")).toHaveLength(0)

    await act(async () => {
      pendingReports.resolve(json({ reports }))
    })

    await waitFor(() => expect(screen.getAllByTestId("route-danger-count")).toHaveLength(2))
    expect(screen.queryAllByTestId("route-danger-count-pending")).toHaveLength(0)

    const expectedA = findDangersNearRoute(mockRoutes[0].route_geometry!, reports, 100).length
    expect(expectedA).toBeGreaterThan(0)
    expect(within(cards[0]).getByTestId("route-danger-count")).toHaveTextContent(
      `注意ポイント ${expectedA}か所`
    )
  })

  it("取り直し中（isLoading）でも一覧があればスケルトンに戻さず、カードを出したままにする", () => {
    setUserRoutes({ routes: mockRoutes, primaryRoute: mockPrimaryRoute, isLoading: true })

    render(<RouteManager />)

    expect(screen.queryByTestId("route-manager-loading")).not.toBeInTheDocument()
    expect(screen.getAllByTestId("route-card")).toHaveLength(3)
  })

  it("一覧がまだ無い読み込み中だけ、見出しつきの軽いスケルトンを出す", () => {
    setUserRoutes({ routes: mockEmptyRoutes, isLoading: true })

    render(<RouteManager />)

    const loading = screen.getByTestId("route-manager-loading")
    expect(loading).toHaveAttribute("role", "status")
    expect(within(loading).getByText("通学路を読み込んでいます")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "通学路一覧" })).toBeInTheDocument()
    expect(screen.queryByTestId("route-card")).not.toBeInTheDocument()
    expect(screen.queryByTestId("route-manager-empty")).not.toBeInTheDocument()
  })
})

describe("RouteManager の作成・編集マップの最初の表示", () => {
  it("登録ルートが無いときは日本全体から始める（東京に寄せない）", async () => {
    setUserRoutes({ routes: mockEmptyRoutes })

    render(<RouteManager />)
    await userEvent.click(screen.getByTestId("add-route-button"))

    expect(initialViewOf(screen.getByTestId("mock-map"))).toEqual({
      longitude: 137,
      latitude: 37.5,
      zoom: 4.6,
    })
  })

  it("登録ルートがあるときは、よく使う道のまわりから始める", async () => {
    setUserRoutes({ routes: mockRoutes, primaryRoute: mockPrimaryRoute })
    const view = getRouteMapView(mockPrimaryRoute)!

    render(<RouteManager />)
    await userEvent.click(screen.getByTestId("add-route-button"))

    expect(initialViewOf(screen.getByTestId("mock-map"))).toEqual({
      longitude: view.center[0],
      latitude: view.center[1],
      zoom: view.zoom,
    })
  })

  it("編集するときは、編集中のルートのまわりから始める", async () => {
    setUserRoutes({ routes: mockRoutes, primaryRoute: mockPrimaryRoute })
    const editedRoute = mockRoutes[1]
    const view = getRouteMapView(editedRoute)!

    render(<RouteManager />)
    await userEvent.click(screen.getAllByTestId("edit-route-button")[1])

    expect(screen.getByTestId("route-edit-panel")).toBeInTheDocument()
    expect(initialViewOf(screen.getByTestId("mock-map"))).toEqual({
      longitude: view.center[0],
      latitude: view.center[1],
      zoom: view.zoom,
    })
  })
})
