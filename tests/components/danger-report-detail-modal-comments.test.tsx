import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import type React from "react"
import DangerReportDetailModal from "@/components/danger-report/danger-report-detail-modal"
import type { DangerReport } from "@/lib/types"

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/image-zoom-overlay", () => ({
  ImageZoomOverlay: () => null,
}))

vi.mock("@/hooks/use-accident-stats", () => ({
  useAccidentStats: () => ({
    stats: null,
    status: "idle",
    fetchStats: vi.fn(),
    error: null,
    reset: vi.fn(),
  }),
}))

vi.mock("@/components/danger-report/detail/report-hero-header", () => ({
  ReportHeroHeader: () => <div data-testid="hero-header" />,
}))

vi.mock("@/components/danger-report/detail/report-metadata-bar", () => ({
  ReportMetadataBar: () => <div data-testid="metadata-bar" />,
}))

vi.mock("@/components/danger-report/detail/report-accident-section", () => ({
  ReportAccidentSection: () => <div data-testid="accident-section" />,
}))

vi.mock("@/components/danger-report/detail/report-image-carousel", () => ({
  ReportImageCarousel: () => <div data-testid="image-carousel" />,
}))

vi.mock("@/components/danger-report/detail/report-admin-image-upload", () => ({
  ReportAdminImageUpload: () => <div data-testid="admin-upload" />,
}))

vi.mock("@/components/comments/report-comment-section", () => ({
  ReportCommentSection: ({ reportId }: { reportId: string }) => (
    <div data-testid="comment-section" data-report-id={reportId} />
  ),
}))

const createReport = (overrides: Partial<DangerReport> = {}): DangerReport => ({
  id: "report-1",
  user_id: "user-1",
  title: "テスト危険箇所",
  description: "テスト説明",
  latitude: 35.6895,
  longitude: 139.6917,
  danger_type: "traffic",
  danger_level: 3,
  status: "approved",
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
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...overrides,
})

describe("DangerReportDetailModal — Comments", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("コメントセクションがモーダル内に表示される", () => {
    render(
      <DangerReportDetailModal
        isOpen={true}
        onClose={vi.fn()}
        report={createReport()}
      />,
    )

    expect(screen.getByTestId("comment-section")).toBeInTheDocument()
  })

  it("コメントセクションに report.id が反映される", () => {
    render(
      <DangerReportDetailModal
        isOpen={true}
        onClose={vi.fn()}
        report={createReport({ id: "report-xyz" })}
      />,
    )

    expect(screen.getByTestId("comment-section")).toHaveAttribute(
      "data-report-id",
      "report-xyz",
    )
  })
})
