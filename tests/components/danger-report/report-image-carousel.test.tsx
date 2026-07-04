import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type React from "react"
import { ReportImageCarousel } from "@/components/danger-report/detail/report-image-carousel"
import type { DangerReport } from "@/lib/types"

vi.mock("@/components/ui/carousel", () => ({
  Carousel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CarouselPrevious: () => null,
  CarouselNext: () => null,
}))

vi.mock("@/components/danger-report/detail/image-with-long-press", () => ({
  ImageWithLongPress: ({
    src,
    onZoom,
  }: {
    src: string
    onZoom: () => void
  }) => (
    <button type="button" data-testid="image-with-long-press" data-src={src} onClick={onZoom}>
      image
    </button>
  ),
}))

vi.mock("@/components/providers/supabase-provider", () => ({
  useOptionalSupabase: () => ({ supabase: {} }),
}))

// 署名URL発行の非同期処理はこのテストの対象外なので、入力URLをそのまま返す
// スタブに差し替え、既存のキャッシュバスター周りの挙動だけを検証する。
vi.mock("@/lib/danger-report-image-access", () => ({
  useDangerReportSignedImageUrls: (
    _client: unknown,
    urls: (string | null | undefined)[],
  ) => urls.map((url) => url ?? null),
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

describe("ReportImageCarousel", () => {
  it("keeps cache-busted URL stable across rerenders with same images", () => {
    const report = createReport()
    const onZoomImage = vi.fn()

    const { rerender } = render(
      <ReportImageCarousel report={report} onZoomImage={onZoomImage} />,
    )

    const firstSrc =
      screen.getByTestId("image-with-long-press").getAttribute("data-src") ?? ""

    rerender(<ReportImageCarousel report={report} onZoomImage={onZoomImage} />)

    const secondSrc =
      screen.getByTestId("image-with-long-press").getAttribute("data-src") ?? ""

    expect(firstSrc).toContain("?t=")
    expect(secondSrc).toBe(firstSrc)

    fireEvent.click(screen.getByTestId("image-with-long-press"))
    expect(onZoomImage).toHaveBeenCalledWith(firstSrc)
  })

  it("refreshes cache token when image set changes", () => {
    const report = createReport()
    const reportWithNewProcessedImage = createReport({
      processed_image_urls: ["https://example.com/processed-1.jpg"],
    })

    const { rerender } = render(
      <ReportImageCarousel report={report} onZoomImage={vi.fn()} />,
    )

    const beforeUpdate =
      screen.getAllByTestId("image-with-long-press")[0]?.getAttribute("data-src") ?? ""

    rerender(
      <ReportImageCarousel
        report={reportWithNewProcessedImage}
        onZoomImage={vi.fn()}
      />,
    )

    const afterUpdate =
      screen.getAllByTestId("image-with-long-press")[0]?.getAttribute("data-src") ?? ""

    expect(afterUpdate).not.toBe(beforeUpdate)
  })
})
