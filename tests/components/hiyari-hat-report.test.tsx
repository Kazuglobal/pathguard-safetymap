import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HiyariHatReport } from "@/components/landing/HiyariHatReport"
import type { DangerReport } from "@/lib/types"

// D1 Route Handler の一覧取得と市町村選択肢取得を limit で区別する。
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
    useLandingReportReactions: vi.fn(),
    toggleLandingReaction: vi.fn(),
    searchSchools: vi.fn(),
  }
})

vi.mock("@/hooks/use-landing-report-reactions", () => ({
  useLandingReportReactions: mocks.useLandingReportReactions,
}))

vi.mock("@/lib/school-search", async () => {
  const actual = await vi.importActual<typeof import("@/lib/school-search")>(
    "@/lib/school-search",
  )
  return {
    ...actual,
    searchSchools: mocks.searchSchools,
  }
})

vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/danger-report/danger-report-detail-modal", () => ({
  default: ({
    isOpen,
    report,
  }: {
    isOpen: boolean
    report: DangerReport | null
    onClose: () => void
  }) =>
    isOpen && report ? (
      <div role="dialog" aria-label={report.title ?? "report"}>
        {report.title}
      </div>
    ) : null,
}))

const reportRequests = () => mocks.state.requests
  .map((request) => new URL(request, "https://app.example"))
  .filter((url) => url.searchParams.get("limit") !== "2000")
const lastReportRequest = () => reportRequests()[reportRequests().length - 1]

const zeroCoordReport = {
  id: "report-1",
  title: "座標ゼロのテスト",
  description: "赤道・本初子午線",
  danger_type: "other",
  danger_level: 1,
  status: "approved",
  latitude: 0,
  longitude: 0,
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
  user_id: "u1",
  created_at: "2026-02-20T00:00:00.000Z",
  updated_at: "2026-02-20T00:00:00.000Z",
}

const clickableReport = {
  id: "report-click",
  title: "交差点の危険",
  description: "車がスピードを出しすぎている",
  danger_type: "traffic",
  danger_level: 3,
  status: "approved",
  latitude: 35.6895,
  longitude: 139.6917,
  image_url: null,
  processed_image_url: null,
  processed_image_urls: [],
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
  user_id: "u1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
}

describe("HiyariHatReport", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("fetch", mocks.fetchApi)
    window.localStorage.clear()
    mocks.state.requests.length = 0
    mocks.state.reportsResult = { data: [zeroCoordReport], error: null }
    mocks.state.cityResult = { data: [], error: null }

    mocks.useLandingReportReactions.mockReturnValue({
      reactions: {},
      isLoading: false,
      toggleReaction: mocks.toggleLandingReaction,
    })
  })

  afterEach(() => vi.unstubAllGlobals())

  it("renders coordinates even when latitude and longitude are zero", async () => {
    render(<HiyariHatReport />)

    await waitFor(() => {
      expect(screen.getByText(/0\.0000,\s*0\.0000/)).toBeInTheDocument()
    })
  })

  it("公開ステータスと表示上限を D1 API に渡す", async () => {
    render(<HiyariHatReport />)

    await waitFor(() => {
      expect(reportRequests().length).toBeGreaterThan(0)
    })

    const request = lastReportRequest()
    expect(request.pathname).toBe("/api/reports")
    expect(request.searchParams.get("limit")).toBe("5")
    expect(request.searchParams.getAll("status")).toEqual(["approved", "published", "resolved"])
  })

  it("永続化された helpful リアクションを active 状態で描画する", async () => {
    mocks.state.reportsResult = { data: [clickableReport], error: null }
    mocks.useLandingReportReactions.mockReturnValue({
      reactions: {
        [clickableReport.id]: {
          helpful: true,
          caution: false,
        },
      },
      isLoading: false,
      toggleReaction: mocks.toggleLandingReaction,
    })

    render(<HiyariHatReport />)

    const button = await screen.findByRole("button", { name: "参考になった" })
    expect(button).toHaveClass("bg-blue-100")
    expect(button).toHaveClass("text-blue-600")
  })

  it("リアクションボタン押下で永続化トグルを呼ぶ", async () => {
    mocks.state.reportsResult = { data: [clickableReport], error: null }

    render(<HiyariHatReport />)

    fireEvent.click(await screen.findByRole("button", { name: "参考になった" }))

    expect(mocks.toggleLandingReaction).toHaveBeenCalledWith(clickableReport.id, "helpful")
  })

  describe("詳細モーダル表示", () => {
    beforeEach(() => {
      mocks.state.reportsResult = { data: [clickableReport], error: null }
    })

    it("報告カードが role=button を持つ", async () => {
      const { container } = render(<HiyariHatReport />)

      await waitFor(() => {
        expect(container.querySelector('article[role="button"]')).toBeTruthy()
      })
    })

    it("カードをクリックすると DangerReportDetailModal が開く", async () => {
      const { container } = render(<HiyariHatReport />)

      await waitFor(() => {
        expect(container.querySelector('article[role="button"]')).toBeTruthy()
      })

      const card = container.querySelector('article[role="button"]') as HTMLElement
      fireEvent.click(card)

      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    it("モーダルのタイトルが報告の title と一致する", async () => {
      const { container } = render(<HiyariHatReport />)

      await waitFor(() => {
        expect(container.querySelector('article[role="button"]')).toBeTruthy()
      })

      const card = container.querySelector('article[role="button"]') as HTMLElement
      fireEvent.click(card)

      expect(screen.getByRole("dialog")).toHaveTextContent("交差点の危険")
    })

    it("リアクションボタンで Enter を押してもモーダルは開かない", async () => {
      const { container } = render(<HiyariHatReport />)

      await waitFor(() => {
        expect(container.querySelector('article[role="button"]')).toBeTruthy()
      })

      fireEvent.keyDown(screen.getByRole("button", { name: "参考になった" }), {
        key: "Enter",
      })

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  describe("地域フィルタ", () => {
    it("地域未選択(全国)では prefecture で絞り込まない", async () => {
      render(<HiyariHatReport />)

      await waitFor(() => {
        expect(reportRequests().length).toBeGreaterThan(0)
      })

      expect(lastReportRequest().searchParams.has("prefecture")).toBe(false)
    })

    it("都道府県チップを選ぶと prefecture で絞り込み、localStorage に保存する", async () => {
      render(<HiyariHatReport />)

      const chip = await screen.findByRole("button", { name: "東京都" })
      fireEvent.click(chip)

      await waitFor(() => {
        expect(lastReportRequest().searchParams.get("prefecture")).toBe("東京都")
      })
      expect(window.localStorage.getItem("pathguardian:selected_prefecture")).toBe("東京都")
    })

    it("プルダウンでクイックチップに無い県(47県対応)も選べる", async () => {
      render(<HiyariHatReport />)

      const select = await screen.findByRole("combobox", { name: "都道府県を選ぶ" })
      fireEvent.change(select, { target: { value: "鳥取県" } })

      await waitFor(() => {
        expect(lastReportRequest().searchParams.get("prefecture")).toBe("鳥取県")
      })
      expect(window.localStorage.getItem("pathguardian:selected_prefecture")).toBe("鳥取県")
    })

    it("保存済みの地域を復元してクエリに反映する", async () => {
      window.localStorage.setItem("pathguardian:selected_prefecture", "大阪府")

      render(<HiyariHatReport />)

      await waitFor(() => {
        expect(lastReportRequest()?.searchParams.get("prefecture")).toBe("大阪府")
      })
    })

    it("該当地域に報告が0件のとき、地域名入りの空メッセージを表示する", async () => {
      mocks.state.reportsResult = { data: [], error: null }

      render(<HiyariHatReport />)

      const chip = await screen.findByRole("button", { name: "東京都" })
      fireEvent.click(chip)

      await waitFor(() => {
        expect(screen.getByText("東京都ではまだ報告がありません。最初の「気をつけて」を地図に残してみましょう。")).toBeInTheDocument()
      })
    })

    it("「全国」に戻すと絞り込みが解除される", async () => {
      render(<HiyariHatReport />)

      fireEvent.click(await screen.findByRole("button", { name: "東京都" }))
      await waitFor(() => {
        expect(lastReportRequest().searchParams.get("prefecture")).toBe("東京都")
      })

      fireEvent.click(await screen.findByRole("button", { name: "全国" }))

      await waitFor(() => {
        expect(lastReportRequest().searchParams.has("prefecture")).toBe(false)
      })
    })
  })

  describe("市町村フィルタ", () => {
    it("県を選ぶと報告のある市町村が選択肢に出て、選ぶと city でも絞り込む", async () => {
      window.localStorage.setItem("pathguardian:selected_prefecture", "東京都")
      mocks.state.cityResult = {
        data: [{ city: "千代田区" }, { city: "港区" }, { city: "千代田区" }],
        error: null,
      }

      render(<HiyariHatReport />)

      const citySelect = await screen.findByRole("combobox", { name: "市町村を選ぶ" })
      fireEvent.change(citySelect, { target: { value: "港区" } })

      await waitFor(() => {
        const request = lastReportRequest()
        expect(request.searchParams.get("prefecture")).toBe("東京都")
        expect(request.searchParams.get("city")).toBe("港区")
      })
    })

    it("県を切り替えた瞬間に前の県の市町村選択肢を消す(取得完了を待たない)", async () => {
      window.localStorage.setItem("pathguardian:selected_prefecture", "東京都")
      mocks.state.cityResult = { data: [{ city: "千代田区" }], error: null }

      render(<HiyariHatReport />)

      await screen.findByRole("combobox", { name: "市町村を選ぶ" })

      // 大阪府の市町村取得は未解決のまま(前の県の選択肢が残ると
      // 「大阪府+千代田区」という成立しない絞り込みを選べてしまう)
      mocks.state.cityResult = new Promise(() => {}) as never

      fireEvent.click(screen.getByRole("button", { name: "大阪府" }))

      await waitFor(() => {
        expect(
          screen.queryByRole("combobox", { name: "市町村を選ぶ" }),
        ).not.toBeInTheDocument()
      })
    })

    it("市町村の選択は県とペアで localStorage に保存される", async () => {
      window.localStorage.setItem("pathguardian:selected_prefecture", "東京都")
      mocks.state.cityResult = { data: [{ city: "港区" }], error: null }

      render(<HiyariHatReport />)

      const citySelect = await screen.findByRole("combobox", { name: "市町村を選ぶ" })
      fireEvent.change(citySelect, { target: { value: "港区" } })

      await waitFor(() => {
        expect(window.localStorage.getItem("pathguardian:selected_city")).toBe(
          JSON.stringify({ prefecture: "東京都", city: "港区" }),
        )
      })
    })
  })

  describe("学校フィルタ", () => {
    it("学校を選ぶと矩形(gte/lte)で絞り込み、圏外の報告は表示しない", async () => {
      mocks.searchSchools.mockResolvedValue([
        {
          id: "poi-1",
          name: "テスト小学校",
          address: "東京都千代田区1-1",
          latitude: 35.68,
          longitude: 139.76,
        },
      ])
      const insideReport = {
        ...clickableReport,
        id: "inside-1",
        title: "圏内の報告",
        latitude: 35.69,
        longitude: 139.76,
      }
      const outsideReport = {
        ...clickableReport,
        id: "outside-1",
        title: "圏外の報告",
        latitude: 35.8,
        longitude: 139.76,
      }
      mocks.state.reportsResult = { data: [insideReport, outsideReport], error: null }

      render(<HiyariHatReport />)

      fireEvent.change(await screen.findByRole("textbox", { name: "学校名で探す" }), {
        target: { value: "テスト小学校" },
      })
      fireEvent.click(screen.getByRole("button", { name: "学校を検索" }))
      fireEvent.click(await screen.findByRole("button", { name: /テスト小学校/ }))

      await waitFor(() => {
        expect(screen.queryByText("圏外の報告")).not.toBeInTheDocument()
      })
      expect(screen.getByText("圏内の報告")).toBeInTheDocument()

      const request = lastReportRequest()
      expect(Number(request.searchParams.get("minLat"))).toBeTypeOf("number")
      expect(Number(request.searchParams.get("maxLat"))).toBeTypeOf("number")
      expect(Number(request.searchParams.get("minLng"))).toBeTypeOf("number")
      expect(Number(request.searchParams.get("maxLng"))).toBeTypeOf("number")
      expect(request.searchParams.has("prefecture")).toBe(false)
    })
  })
})
