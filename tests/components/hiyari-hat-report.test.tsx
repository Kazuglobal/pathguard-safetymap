import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { HiyariHatReport } from "@/components/landing/HiyariHatReport"
import type { DangerReport } from "@/lib/types"

const mocks = vi.hoisted(() => ({
  createBrowserClient: vi.fn(),
  limit: vi.fn(),
  order: vi.fn(),
  inFilter: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  useLandingReportReactions: vi.fn(),
  toggleLandingReaction: vi.fn(),
}))

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: mocks.createBrowserClient,
}))

vi.mock("@/hooks/use-landing-report-reactions", () => ({
  useLandingReportReactions: mocks.useLandingReportReactions,
}))

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

    mocks.limit.mockResolvedValue({
      data: [zeroCoordReport],
      error: null,
    })
    mocks.order.mockReturnValue({ limit: mocks.limit })
    mocks.inFilter.mockReturnValue({ order: mocks.order })
    mocks.select.mockReturnValue({ in: mocks.inFilter })
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.createBrowserClient.mockReturnValue({ from: mocks.from })
    mocks.useLandingReportReactions.mockReturnValue({
      reactions: {},
      isLoading: false,
      toggleReaction: mocks.toggleLandingReaction,
    })
  })

  it("renders coordinates even when latitude and longitude are zero", async () => {
    render(<HiyariHatReport />)

    await waitFor(() => {
      expect(screen.getByText(/0\.0000,\s*0\.0000/)).toBeInTheDocument()
    })
  })

  it("danger_reports クエリはワイルドカードではなく必要カラムのみ取得する", async () => {
    render(<HiyariHatReport />)

    await waitFor(() => {
      expect(mocks.select).toHaveBeenCalled()
    })

    const [projection] = mocks.select.mock.calls[0] as [string]
    expect(projection).not.toContain("*")
    expect(projection).toContain("id")
    expect(projection).toContain("title")
    expect(projection).toContain("danger_level")
  })

  it("永続化された helpful リアクションを active 状態で描画する", async () => {
    mocks.limit.mockResolvedValue({
      data: [clickableReport],
      error: null,
    })
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
    mocks.limit.mockResolvedValue({
      data: [clickableReport],
      error: null,
    })

    render(<HiyariHatReport />)

    fireEvent.click(await screen.findByRole("button", { name: "参考になった" }))

    expect(mocks.toggleLandingReaction).toHaveBeenCalledWith(clickableReport.id, "helpful")
  })

  describe("詳細モーダル表示", () => {
    beforeEach(() => {
      mocks.limit.mockResolvedValue({
        data: [clickableReport],
        error: null,
      })
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
})
