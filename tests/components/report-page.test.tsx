import { render, screen, waitFor } from "@testing-library/react"
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

describe("ReportHubPage", () => {
  it("does not render the 3D gallery tab", async () => {
    render(<ReportHubPage />)

    await waitFor(() => {
      expect(mocks.query.limit).toHaveBeenCalled()
    })

    expect(screen.queryByRole("tab", { name: "3Dギャラリー" })).not.toBeInTheDocument()
  })
})
