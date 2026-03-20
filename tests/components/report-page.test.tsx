import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import ReportHubPage from "@/app/report/page"

const mocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  }

  query.select.mockReturnValue({ in: query.in })
  query.in.mockReturnValue({ order: query.order })
  query.order.mockReturnValue({ limit: query.limit })
  query.limit.mockResolvedValue({ data: [], error: null })

  return {
    query,
    toast: vi.fn(),
    shareFamilyShareCard: vi.fn(),
    supabase: {
      from: vi.fn(() => ({ select: query.select })),
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
  it("does not render the 3D gallery tab", async () => {
    render(<ReportHubPage />)

    await waitFor(() => {
      expect(mocks.query.limit).toHaveBeenCalled()
    })

    expect(screen.queryByRole("tab", { name: "3Dギャラリー" })).not.toBeInTheDocument()
  })

  it("shows a destructive toast when detail-card sharing fails", async () => {
    mocks.query.limit.mockResolvedValueOnce({
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
    })
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
})
