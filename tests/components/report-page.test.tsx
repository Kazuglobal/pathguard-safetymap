import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ReportHubPage from "@/app/report/page"

// Supabase は Auth のみ、報告データは D1 Route Handler をモックする。
const mocks = vi.hoisted(() => {
  const state = {
    requests: [] as string[],
    reportsResult: { data: [] as unknown[], error: null as unknown },
    cityResult: { data: [] as unknown[], error: null as unknown } as any,
  }
  const fetchApi = vi.fn(async (input: string | URL | Request) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    state.requests.push(rawUrl)
    const url = new URL(rawUrl, "https://app.example")
    const result = await Promise.resolve(
      url.searchParams.get("limit") === "2000" ? state.cityResult : state.reportsResult,
    )
    return {
      ok: !result.error,
      status: result.error ? 500 : 200,
      json: async () => ({ reports: result.data }),
    }
  })

  return {
    state,
    fetchApi,
    toast: vi.fn(),
    shareFamilyShareCard: vi.fn(),
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        onAuthStateChange: vi.fn(() => ({
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        })),
      },
    },
  }
})

const reportRequests = () => mocks.state.requests
  .map((request) => new URL(request, "https://app.example"))
  .filter((url) => url.searchParams.get("limit") !== "2000")
const lastReportRequest = () => reportRequests()[reportRequests().length - 1]

const schoolSearchMocks = vi.hoisted(() => ({
  searchSchools: vi.fn(),
}))

vi.mock("@/lib/school-search", async () => {
  const actual = await vi.importActual<typeof import("@/lib/school-search")>(
    "@/lib/school-search",
  )
  return {
    ...actual,
    searchSchools: schoolSearchMocks.searchSchools,
  }
})

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({ supabase: mocks.supabase }),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}))

vi.mock("@/hooks/use-report-interactions", () => ({
  useReportInteractionsBatch: () => ({
    interactions: new Map(),
    isLoading: false,
    error: null,
    toggleLike: vi.fn(),
    toggleSave: vi.fn(),
  }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/danger-report/image-preview-dialog", () => ({
  default: () => null,
}))

vi.mock("@/components/comments/report-comment-section", () => ({
  ReportCommentSection: () => <div data-testid="report-comment-section" />,
}))

vi.mock("@/components/ui/long-press-zoomable-image", () => ({
  LongPressZoomableImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

vi.mock("@/components/report/shared-gallery-3d", () => ({
  default: () => <div data-testid="shared-gallery-3d" />,
}))

vi.mock("@/lib/report-generation/family-share-card", async () => {
  const actual = await vi.importActual<typeof import("@/lib/report-generation/family-share-card")>(
    "@/lib/report-generation/family-share-card",
  )

  return {
    ...actual,
    shareFamilyShareCard: mocks.shareFamilyShareCard,
  }
})

describe("ReportHubPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mocks.fetchApi)
    window.localStorage.clear()
    mocks.state.requests.length = 0
    mocks.state.reportsResult = { data: [], error: null }
    mocks.state.cityResult = { data: [], error: null }
    mocks.supabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    mocks.supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("does not render the 3D gallery tab", async () => {
    render(<ReportHubPage />)

    await waitFor(() => {
      expect(reportRequests().length).toBeGreaterThan(0)
    })

    expect(screen.queryByRole("tab", { name: "3Dギャラリー" })).not.toBeInTheDocument()
  })

  it("shows a destructive toast when detail-card sharing fails", async () => {
    mocks.state.reportsResult = {
      data: [
        {
          id: "report-1",
          title: "見通しの悪い交差点",
          description: "小学生の目線では車が急に見える",
          danger_type: "traffic",
          danger_level: 3,
          latitude: 35.681,
          longitude: 139.767,
          status: "published",
          image_url: null,
          processed_image_urls: [],
          created_at: "2026-03-20T00:00:00.000Z",
          prefecture: "東京都",
          city: "千代田区",
          town: "丸の内",
        },
      ],
      error: null,
    }
    mocks.shareFamilyShareCard.mockRejectedValueOnce(new Error("share failed"))

    const user = userEvent.setup()

    render(<ReportHubPage />)

    await user.click(await screen.findByRole("tab", { name: "共有フィード" }))
    const reportItem = await screen.findByTestId("report-item")
    await user.click(reportItem)
    await user.click(await screen.findByRole("button", { name: "家族に共有" }))

    await waitFor(() => {
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "共有に失敗しました",
          variant: "destructive",
        }),
      )
    })
  })

  describe("地域フィルタ", () => {
    it("全国では prefecture で絞り込まない", async () => {
      render(<ReportHubPage />)

      await waitFor(() => {
        expect(reportRequests().length).toBeGreaterThan(0)
      })
      expect(lastReportRequest().searchParams.has("prefecture")).toBe(false)
    })

    it("都道府県チップを選ぶと prefecture で絞り込む", async () => {
      render(<ReportHubPage />)

      const chip = await screen.findByRole("button", { name: "東京都" })
      fireEvent.click(chip)

      await waitFor(() => {
        expect(lastReportRequest().searchParams.get("prefecture")).toBe("東京都")
      })
    })

    it("市町村を選ぶと city でも絞り込む", async () => {
      window.localStorage.setItem("pathguardian:selected_prefecture", "東京都")
      mocks.state.cityResult = { data: [{ city: "千代田区" }], error: null }

      render(<ReportHubPage />)

      const citySelect = await screen.findByRole("combobox", { name: "市町村を選ぶ" })
      fireEvent.change(citySelect, { target: { value: "千代田区" } })

      await waitFor(() => {
        const request = lastReportRequest()
        expect(request.searchParams.get("prefecture")).toBe("東京都")
        expect(request.searchParams.get("city")).toBe("千代田区")
      })
    })

    it("学校モード(/reportは精密座標)では2kmちょうど超えの報告を含めない", async () => {
      schoolSearchMocks.searchSchools.mockResolvedValue([
        {
          id: "poi-1",
          name: "テスト小学校",
          address: "東京都千代田区1-1",
          latitude: 35.68,
          longitude: 139.76,
        },
      ])
      const baseReport = {
        description: null,
        danger_type: "traffic",
        danger_level: 3,
        status: "published",
        image_url: null,
        processed_image_urls: [],
        created_at: "2026-03-20T00:00:00.000Z",
        prefecture: "東京都",
        city: "千代田区",
        town: null,
      }
      mocks.state.reportsResult = {
        data: [
          // 約1.1km北 → 圏内
          { ...baseReport, id: "inside-1", title: "圏内の報告", latitude: 35.69, longitude: 139.76 },
          // 約2.5km北 → 丸め許容幅(0.8km)があれば入るが、精密座標では除外されるべき
          { ...baseReport, id: "edge-1", title: "2.5km地点の報告", latitude: 35.70246, longitude: 139.76 },
        ],
        error: null,
      }

      const user = userEvent.setup()
      render(<ReportHubPage />)

      await user.click(await screen.findByRole("tab", { name: "共有フィード" }))
      expect(await screen.findByText("圏内の報告")).toBeInTheDocument()
      expect(screen.getByText("2.5km地点の報告")).toBeInTheDocument()

      fireEvent.change(await screen.findByRole("textbox", { name: "学校名で探す" }), {
        target: { value: "テスト小学校" },
      })
      fireEvent.click(screen.getByRole("button", { name: "学校を検索" }))
      fireEvent.click(await screen.findByRole("button", { name: /テスト小学校/ }))

      await waitFor(() => {
        expect(screen.queryByText("2.5km地点の報告")).not.toBeInTheDocument()
      })
      expect(screen.getByText("圏内の報告")).toBeInTheDocument()
    })
  })
})
