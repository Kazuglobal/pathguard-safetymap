import { render, screen, renderHook, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ChildRouteDashboard } from "@/components/landing/child-route-dashboard"
import { LandingChildRouteDashboard } from "@/components/landing/LandingChildRouteDashboard"
import { useChildRouteDashboard } from "@/hooks/use-child-route-dashboard"
import { useUserRoutes } from "@/hooks/use-user-routes"
import { useRouteDangers } from "@/hooks/use-route-dangers"
import type { DangerReport, UserRoute } from "@/lib/types"

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

// 「この30日」の判定を実行日に左右されず再現できるよう、現在時刻を固定する
const NOW = new Date("2026-10-28T00:00:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS).toISOString()

beforeEach(() => {
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

const makeRoute = (overrides: Partial<UserRoute> = {}): UserRoute => ({
  id: "route-main",
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
  estimated_time_minutes: null,
  is_favorite: true,
  created_at: "2026-01-10T00:00:00Z",
  updated_at: "2026-02-03T00:00:00Z",
  ...overrides,
})

const makeDanger = (id: string, createdAt: string | null): DangerReport => ({
  id,
  user_id: "test-user-id",
  title: `危険 ${id}`,
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
  created_at: createdAt,
  updated_at: createdAt,
})

const mockRoutes = (routes: UserRoute[]) => {
  vi.mocked(useUserRoutes).mockReturnValue({
    routes,
    childProfiles: [{ id: "all", label: "すべて", routeCount: routes.length }],
    primaryRoute: routes.find((route) => route.is_favorite) ?? null,
    isLoading: false,
    error: null,
    addRoute: vi.fn(),
    updateRoute: vi.fn(),
    deleteRoute: vi.fn(),
    setPrimaryRoute: vi.fn(),
    refreshRoutes: vi.fn(),
  })
}

const mockDangers = (dangers: DangerReport[]) => {
  vi.mocked(useRouteDangers).mockReturnValue({
    dangers,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
}

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
          created_at: daysAgo(10),
          updated_at: daysAgo(10),
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
    expect(result.current.quickChecks).toHaveLength(2)
    expect(result.current.quickChecks[0]?.title).toBe("この30日の注意地点")
    expect(result.current.quickChecks[0]?.value).toBe("1件")
    expect(result.current.quickChecks[0]?.href).toBe("/map?routeId=route-2")
    expect(result.current.quickChecks[1]?.title).toBe("通学路")
    expect(result.current.quickChecks[1]?.value).toBe("登録済み")
    expect(result.current.quickChecks[1]?.detail).toBe("徒歩約10分")
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

    // ready 時のセル数(この30日の注意地点・通学路)と同じ数の骨組みを出す
    expect(screen.getAllByText("読み込み中")).toHaveLength(2)
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
          { id: "recent", title: "この30日の注意地点", value: "2件", href: "/map" },
          { id: "share", title: "直近の共有カード", value: "昨夜 21:00", href: "/report" },
        ]}
      />,
    )

    expect(screen.getByRole("heading", { name: "今日の通学3分チェック" })).toBeInTheDocument()
    expect(screen.getAllByText(/さくらさん向け/).length).toBeGreaterThan(0)
    expect(screen.getByText("この30日の注意地点")).toBeInTheDocument()
    expect(screen.getByText("直近の共有カード")).toBeInTheDocument()
  })

  it("renders a mobile-visible child context label when childName is available", () => {
    render(
      <ChildRouteDashboard
        state="ready"
        childName="さくら"
        quickChecks={[
          { id: "recent", title: "この30日の注意地点", value: "2件", href: "/map" },
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
          { id: "recent", title: "この30日の注意地点", value: "2件", href: "/map" },
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
    { id: "recent", title: "この30日の注意地点", value: "2件", href: "/map" },
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

describe("今日の通学3分チェック: 表示と実データの整合", () => {
  it("shows only the register-route guidance and its CTA when no route is registered", () => {
    mockRoutes([])
    mockDangers([])

    const { result } = renderHook(() => useChildRouteDashboard())

    expect(result.current.state).toBe("empty")
    expect(result.current.quickChecks).toEqual([])

    render(<LandingChildRouteDashboard newsPreview={[]} />)

    const dashboard = screen.getByTestId("child-route-dashboard")
    expect(
      within(dashboard).getByText("通学路を登録すると、わが子向けの注意が表示されます")
    ).toBeInTheDocument()
    // 行動は「通学路を登録する」1つだけ(地図への近道や件数・未設定の行は出さない)
    const links = within(dashboard).getAllByRole("link")
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent("通学路を登録する")
    expect(links[0]).toHaveAttribute("href", "/routes")
    expect(within(dashboard).queryByText(/^\d+件$/)).not.toBeInTheDocument()
    expect(within(dashboard).queryByText("未設定")).not.toBeInTheDocument()
    expect(within(dashboard).queryByText("登録済み")).not.toBeInTheDocument()
  })

  it("counts only reports near the route created within the last 30 days and labels the period", () => {
    mockRoutes([makeRoute()])
    mockDangers([
      makeDanger("yesterday", daysAgo(1)),
      makeDanger("cutoff", daysAgo(30)),
      makeDanger("just-outside", daysAgo(31)),
      makeDanger("last-year", "2025-09-01T00:00:00.000Z"),
      makeDanger("no-date", null),
      makeDanger("broken-date", "not-a-date"),
    ])

    const { result } = renderHook(() => useChildRouteDashboard())

    // 期間以外の条件(公開済み・通学路から100m以内)は useRouteDangers と同じものを使う
    expect(useRouteDangers).toHaveBeenCalledWith("route-main", 100)
    expect(result.current.state).toBe("ready")
    const recent = result.current.quickChecks.find((check) => check.id === "recent")
    expect(recent?.title).toBe("この30日の注意地点")
    expect(recent?.value).toBe("2件")
    expect(recent?.href).toBe("/map?routeId=route-main")
    expect(result.current.quickChecks.some((check) => check.title.includes("今日"))).toBe(false)
  })

  it("shows 0件 when every nearby report is older than 30 days", () => {
    mockRoutes([makeRoute()])
    mockDangers([
      makeDanger("old", daysAgo(45)),
      makeDanger("much-older", daysAgo(268)),
    ])

    const { result } = renderHook(() => useChildRouteDashboard())

    expect(result.current.quickChecks.find((check) => check.id === "recent")?.value).toBe("0件")

    render(<LandingChildRouteDashboard newsPreview={[]} />)

    expect(screen.getByText("0件")).toBeInTheDocument()
    expect(screen.getByText("この30日の注意地点")).toBeInTheDocument()
    expect(screen.queryByText("今日の注意地点")).not.toBeInTheDocument()
  })

  it.each([
    ["null", null],
    ["0", 0],
  ])(
    "shows 登録済み (never 未設定) for a registered route when estimated_time_minutes is %s",
    (_label, estimatedTimeMinutes) => {
      mockRoutes([makeRoute({ estimated_time_minutes: estimatedTimeMinutes })])
      mockDangers([])

      const { result } = renderHook(() => useChildRouteDashboard())

      const routeCheck = result.current.quickChecks.find((check) => check.id === "route")
      expect(routeCheck).toMatchObject({ title: "通学路", value: "登録済み", href: "/routes" })
      expect(routeCheck?.detail).toBeUndefined()
      expect(result.current.quickChecks.map((check) => check.value)).not.toContain("未設定")

      render(<LandingChildRouteDashboard newsPreview={[]} />)

      expect(screen.getByText("登録済み")).toBeInTheDocument()
      expect(screen.getByText("通学路")).toBeInTheDocument()
      expect(screen.queryByText("未設定")).not.toBeInTheDocument()
      expect(screen.queryByText(/通学ルート/)).not.toBeInTheDocument()
      expect(screen.queryByText(/徒歩約/)).not.toBeInTheDocument()
    }
  )

  it("adds 徒歩約N分 under 登録済み when the route has an estimated time", () => {
    mockRoutes([makeRoute({ estimated_time_minutes: 12 })])
    mockDangers([])

    const { result } = renderHook(() => useChildRouteDashboard())

    expect(result.current.quickChecks.find((check) => check.id === "route")).toMatchObject({
      title: "通学路",
      value: "登録済み",
      detail: "徒歩約12分",
    })

    render(<LandingChildRouteDashboard newsPreview={[]} />)

    const routeLink = screen.getByRole("link", { name: /登録済み/ })
    expect(routeLink).toHaveAttribute("href", "/routes")
    expect(within(routeLink).getByText("徒歩約12分")).toBeInTheDocument()
    expect(within(routeLink).getByText("通学路")).toBeInTheDocument()
  })

  it("does not show a 直近の更新 / N日前 row derived from the route's own updated_at", () => {
    // 通学路そのものの更新日(268日前)は情報の新しさではないので、鮮度のような表示に使わない
    mockRoutes([makeRoute({ updated_at: daysAgo(268) })])
    mockDangers([makeDanger("yesterday", daysAgo(1))])

    const { result } = renderHook(() => useChildRouteDashboard())

    expect(result.current.quickChecks.map((check) => check.id)).toEqual(["recent", "route"])
    expect(result.current.quickChecks.some((check) => /前$/.test(check.value))).toBe(false)

    render(<LandingChildRouteDashboard newsPreview={[]} />)

    expect(screen.queryByText("直近の更新")).not.toBeInTheDocument()
    expect(screen.queryByText(/日前/)).not.toBeInTheDocument()
  })

  it("says 毎朝3分 in the lead copy and keeps the map shortcut when a route is registered", () => {
    mockRoutes([makeRoute()])
    mockDangers([])

    render(<LandingChildRouteDashboard newsPreview={[]} />)

    // モバイル用とデスクトップ用の2か所
    expect(screen.getAllByText("さくらさん向けの注意点を毎朝3分で確認できます。")).toHaveLength(2)
    expect(screen.queryByText(/30秒/)).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /地図を見る/ })).toHaveAttribute("href", "/map")
  })

  it("uses the route-neutral 毎朝3分 copy when the child name is unavailable", () => {
    render(<ChildRouteDashboard state="ready" quickChecks={[]} />)

    expect(screen.getAllByText("登録した通学路向けの注意点を毎朝3分で確認できます。")).toHaveLength(2)
    expect(screen.queryByText(/30秒/)).not.toBeInTheDocument()
  })
})
