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
    expect(result.current.quickChecks[0]?.href).toBe("/map?routeId=route-2")
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

  it("renders the compact loading state", () => {
    render(<ChildRouteDashboard state="loading" quickChecks={[]} />)

    expect(screen.getAllByText("読み込み中")).toHaveLength(3)
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

  it("returns an error state when danger lookup fails", () => {
    vi.mocked(useUserRoutes).mockReturnValue({
      routes: [
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
      childProfiles: [{ id: "child-sakura", label: "さくら", routeCount: 1 }],
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
      error: "Database error",
      refetch: vi.fn(),
    })

    const { result } = renderHook(() => useChildRouteDashboard())

    expect(result.current.state).toBe("error")
    expect(result.current.quickChecks).toHaveLength(0)
  })

  it("renders the error state", () => {
    render(
      <ChildRouteDashboard
        state="error"
        quickChecks={[]}
        retryHref="/map?routeId=route-2"
        errorMessage="最新の危険情報を読み込めませんでした。"
      />
    )

    expect(
      screen.getByText("最新の危険情報を読み込めませんでした。")
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "マップで確認する" })).toHaveAttribute(
      "href",
      "/map?routeId=route-2"
    )
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
    expect(screen.getAllByText(/さくらさん向け/).length).toBeGreaterThan(0)
    expect(screen.getByText("今日の注意地点")).toBeInTheDocument()
    expect(screen.getByText("直近の共有カード")).toBeInTheDocument()
  })

  it("renders a mobile-visible child context label when childName is available", () => {
    render(
      <ChildRouteDashboard
        state="ready"
        childName="さくら"
        quickChecks={[
          { id: "today", title: "今日の注意地点", value: "2件", href: "/map" },
        ]}
      />
    )

    const childLabels = screen.getAllByText(/さくらさん向け/)

    expect(childLabels.some((element) => element.className.includes("md:hidden"))).toBe(true)
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

    expect(screen.getAllByText(/登録した通学路向け/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/さん向け/)).not.toBeInTheDocument()
  })

  const mockNewsPreview = [
    { id: "1", title: "交差点で事故", categoryLabel: "事故", categoryColor: "#ef4444", slug: "news-1" },
    { id: "2", title: "登校時の注意喚起", categoryLabel: "注意", categoryColor: "#f59e0b", slug: "news-2" },
  ]

  const mockChecks = [
    { id: "today", title: "今日の注意地点", value: "2件", href: "/map" },
  ]

  it("renders news preview when state is ready and newsPreview provided", () => {
    render(<ChildRouteDashboard state="ready" quickChecks={mockChecks} newsPreview={mockNewsPreview} />)
    expect(screen.getByText("通学路の安全ニュース")).toBeInTheDocument()
    expect(screen.getByText("交差点で事故")).toBeInTheDocument()
    expect(screen.getByText("事故")).toBeInTheDocument()
    expect(screen.getByText("注意")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /すべて見る/ })).toHaveAttribute("href", "/school-route-news")
  })

  it("does not render news preview when newsPreview is empty", () => {
    render(<ChildRouteDashboard state="ready" quickChecks={mockChecks} newsPreview={[]} />)
    expect(screen.queryByText("通学路の安全ニュース")).not.toBeInTheDocument()
  })

  it("does not render news preview when state is not ready", () => {
    render(<ChildRouteDashboard state="loading" newsPreview={mockNewsPreview} />)
    expect(screen.queryByText("通学路の安全ニュース")).not.toBeInTheDocument()
  })
})
