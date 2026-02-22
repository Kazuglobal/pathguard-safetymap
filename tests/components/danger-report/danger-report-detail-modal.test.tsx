import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type React from "react"
import DangerReportDetailModal from "@/components/danger-report/danger-report-detail-modal"
import type { DangerReport } from "@/lib/types"

const fetchStatsMock = vi.fn()
const resetAccidentStatsMock = vi.fn()

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
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
    fetchStats: fetchStatsMock,
    error: null,
    reset: resetAccidentStatsMock,
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
  ReportImageCarousel: ({ report }: { report: DangerReport }) => (
    <div data-testid="carousel-image-count">{report.processed_image_urls?.length ?? 0}</div>
  ),
}))

vi.mock("@/components/comments/report-comment-section", () => ({
  ReportCommentSection: () => <div data-testid="comment-section" />,
}))

vi.mock("@/components/danger-report/detail/report-admin-image-upload", () => ({
  ReportAdminImageUpload: ({
    report,
    onProcessedUrlsChange,
  }: {
    report: DangerReport
    onProcessedUrlsChange?: (urls: string[]) => void
  }) => (
    <div>
      <div data-testid="admin-image-count">{report.processed_image_urls?.length ?? 0}</div>
      <button type="button" onClick={() => onProcessedUrlsChange?.(["p1", "p2"])}>
        sync
      </button>
    </div>
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
  image_url: "https://example.com/original.jpg",
  processed_image_url: null,
  processed_image_urls: ["https://example.com/p1.jpg"],
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

describe("DangerReportDetailModal", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("updates displayed processed images when admin changes URLs", () => {
    const report = createReport()

    render(
      <DangerReportDetailModal
        isOpen={true}
        onClose={vi.fn()}
        report={report}
        isAdmin={true}
      />,
    )

    expect(screen.getByTestId("carousel-image-count")).toHaveTextContent("1")
    expect(screen.getByTestId("admin-image-count")).toHaveTextContent("1")

    fireEvent.click(screen.getByRole("button", { name: "sync" }))

    expect(screen.getByTestId("carousel-image-count")).toHaveTextContent("2")
    expect(screen.getByTestId("admin-image-count")).toHaveTextContent("2")
  })

  it("re-syncs local processed images when report prop changes", () => {
    const firstReport = createReport({
      id: "report-1",
      processed_image_urls: ["https://example.com/p1.jpg", "https://example.com/p2.jpg"],
      updated_at: "2026-01-01T00:00:00Z",
    })
    const secondReport = createReport({
      id: "report-2",
      processed_image_urls: [],
      updated_at: "2026-01-02T00:00:00Z",
    })

    const { rerender } = render(
      <DangerReportDetailModal
        isOpen={true}
        onClose={vi.fn()}
        report={firstReport}
        isAdmin={true}
      />,
    )

    expect(screen.getByTestId("carousel-image-count")).toHaveTextContent("2")

    rerender(
      <DangerReportDetailModal
        isOpen={true}
        onClose={vi.fn()}
        report={secondReport}
        isAdmin={true}
      />,
    )

    expect(screen.getByTestId("carousel-image-count")).toHaveTextContent("0")
    expect(screen.getByTestId("admin-image-count")).toHaveTextContent("0")
  })
})
