import { render, screen, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ChildRouteDashboard } from "@/components/landing/child-route-dashboard"
import { useChildRouteDashboard } from "@/hooks/use-child-route-dashboard"
import { useUserRoutes } from "@/hooks/use-user-routes"
import { useRouteDangers } from "@/hooks/use-route-dangers"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/hooks/use-user-routes", () => ({
  useUserRoutes: vi.fn(),
}))

vi.mock("@/hooks/use-route-dangers", () => ({
  useRouteDangers: vi.fn(),
}))

describe("ChildRouteDashboard", () => {
  it("selects the primary route and derives route-linked quick checks", () => {
    vi.mocked(useUserRoutes).mockReturnValue({
      routes: [
        {
          id: "route-1",
          user_id: "test-user-id",
          name: "さくらの予備ルート",
          description: null,
          child_id: "child-sakura",
          child_name: "さくら",
          start_lat: 35.68,
          start_lng: 139.76,
          end_lat: 35.69,
          end_lng: 139.77,
          start_address: "自宅",
          end_address: "学校",
          route_geometry: null,
          distance_meters: 900,
          estimated_time_minutes: 11,
          is_favorite: false,
          created_at: "2026-03-14T00:00:00Z",
          updated_at: "2026-03-14T00:00:00Z",
        },
        {
          id: "route-2",
          user_id: "test-user-id",
          name: "さくらの通学路",
          description: null,
          child_id: "child-sakura",
          child_name: "さくら",
          start_lat: 35.68,
          start_lng: 139.76,
          end_lat: 35.69,
          end_lng: 139.77,
          start_address: "自宅",
          end_address: "学校",
          route_geometry: {
            type: "LineString",
            coordinates: [
              [139.76, 35.68],
              [139.77, 35.69],
            ],
          },
          distance_meters: 800,
          estimated_time_minutes: 10,
          is_favorite: true,
          created_at: "2026-03-14T00:00:00Z",
          updated_at: "2026-03-15T00:00:00Z",
        },
      ],
      childProfiles: [
        { id: "all", label: "すべて", routeCount: 2 },
        { id: "child-sakura", label: "さくら", routeCount: 2 },
      ],
      primaryRoute: {
        id: "route-2",
        user_id: "test-user-id",
        name: "さくらの通学路",
        description: null,
        child_id: "child-sakura",
        child_name: "さくら",
        start_lat: 35.68,
        start_lng: 139.76,
        end_lat: 35.69,
        end_lng: 139.77,
        start_address: "自宅",
        end_address: "学校",
        route_geometry: {
          type: "LineString",
          coordinates: [
            [139.76, 35.68],
            [139.77, 35.69],
          ],
        },
        distance_meters: 800,
        estimated_time_minutes: 10,
        is_favorite: true,
        created_at: "2026-03-14T00:00:00Z",
        updated_at: "2026-03-15T00:00:00Z",
      },
      isLoading: false,
      error: null,
      addRoute: vi.fn(),
      updateRoute: vi.fn(),
      deleteRoute: vi.fn(),
      setPrimaryRoute: vi.fn(),
      refreshRoutes: vi.fn(),
    })

    vi.mocked(useRouteDangers).mockReturnValue({
      dangers: [
        {
          id: "danger-1",
          user_id: "test-user-id",
          title: "見通しの悪い交差点",
          description: null,
          latitude: 35.68,
          longitude: 139.76,
          danger_type: "traffic",
          danger_level: 3,
          status: "approved",
          image_url: null,
          processed_image_url: null,
          processed_image_urls: null,
          prefecture: null,
          prefecture_code: null,
          city: null,
          municipality_code: null,
          town: null,
          postal_code: null,
          geocode_source: null,
          geocoded_at: null,
          geocode_confidence: null,
          address_hash: null,
          created_at: "2026-03-18T00:00:00Z",
          updated_at: "2026-03-18T00:00:00Z",
        },
      ],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    const { result } = renderHook(() => useChildRouteDashboard())

    expect(useRouteDangers).toHaveBeenCalledWith("route-2", 100)
    expect(result.current.state).toBe("ready")
    expect(result.current.childName).toBe("さくら")
    expect(result.current.quickChecks[0]?.title).toBe("今日の注意地点")
    expect(result.current.quickChecks[0]?.value).toBe("1件")
    expect(result.current.quickChecks[1]?.title).toBe("通学ルート")
    expect(result.current.quickChecks[1]?.value).toBe("10分")
    expect(result.current.quickChecks[2]?.title).toBe("直近の更新")
  })

  it("keeps routes without geometry out of the ready quick-check state", () => {
    vi.mocked(useUserRoutes).mockReturnValue({
      routes: [
        {
          id: "route-no-geometry",
          user_id: "test-user-id",
          name: "さくらの通学路",
          description: null,
          child_id: "child-sakura",
          child_name: null,
          start_lat: 35.68,
          start_lng: 139.76,
          end_lat: 35.69,
          end_lng: 139.77,
          start_address: "自宅",
          end_address: "学校",
          route_geometry: null,
          distance_meters: 800,
          estimated_time_minutes: 10,
          is_favorite: true,
          created_at: "2026-03-14T00:00:00Z",
          updated_at: "2026-03-15T00:00:00Z",
        },
      ],
      childProfiles: [{ id: "all", label: "すべて", routeCount: 1 }],
      primaryRoute: null,
      isLoading: false,
      error: null,
      addRoute: vi.fn(),
      updateRoute: vi.fn(),
      deleteRoute: vi.fn(),
      setPrimaryRoute: vi.fn(),
      refreshRoutes: vi.fn(),
    })

    vi.mocked(useRouteDangers).mockReturnValue({
      dangers: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })

    const { result } = renderHook(() => useChildRouteDashboard())

    expect(useRouteDangers).toHaveBeenCalledWith("", 100)
    expect(result.current.state).toBe("needs_setup")
    expect(result.current.childName).toBeUndefined()
    expect(result.current.quickChecks).toHaveLength(0)
  })

  it("renders the loading and empty states", () => {
    render(<ChildRouteDashboard state="loading" quickChecks={[]} />)

    expect(screen.getAllByText("通学路を読み込み中...")).toHaveLength(3)
  })

  it("renders the empty state", () => {
    render(<ChildRouteDashboard state="empty" quickChecks={[]} />)

    expect(
      screen.getByText("通学路を登録すると、わが子向けの注意が表示されます")
    ).toBeInTheDocument()
  })

  it("renders the route setup state", () => {
    render(<ChildRouteDashboard state="needs_setup" quickChecks={[]} />)

    expect(
      screen.getByText("この通学路はまだシミュレーション準備中です")
    ).toBeInTheDocument()
    expect(
      screen.getByText("ルートをもう一度設定すると、危険地点や見直しポイントをここで表示できます。")
    ).toBeInTheDocument()
  })

  it("renders the weekly quick-check headline and cards", () => {
    render(
      <ChildRouteDashboard
        state="ready"
        childName="さくら"
        quickChecks={[
          { id: "today", title: "今日の注意地点", value: "2件", href: "/map" },
          { id: "share", title: "直近の共有カード", value: "昨夜 21:00", href: "/report" },
        ]}
      />,
    )

    expect(screen.getByRole("heading", { name: "今日の通学3分チェック" })).toBeInTheDocument()
    expect(screen.getByText(/さくらさん向け/)).toBeInTheDocument()
    expect(screen.getByText("今日の注意地点")).toBeInTheDocument()
    expect(screen.getByText("直近の共有カード")).toBeInTheDocument()
  })

  it("falls back to route-neutral copy when the child name is unavailable", () => {
    render(
      <ChildRouteDashboard
        state="ready"
        quickChecks={[
          { id: "today", title: "今日の注意地点", value: "2件", href: "/map" },
        ]}
      />
    )

    expect(screen.getByText(/登録した通学路向け/)).toBeInTheDocument()
    expect(screen.queryByText(/さん向け/)).not.toBeInTheDocument()
  })
})
