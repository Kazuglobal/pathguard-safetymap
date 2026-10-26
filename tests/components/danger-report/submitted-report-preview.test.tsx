import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import SubmittedReportPreview from "@/components/danger-report/submitted-report-preview"

vi.mock("next/image", () => ({ default: ({ fill, unoptimized, ...props }: any) => <img {...props} /> }))
vi.mock("@/components/providers/supabase-provider", () => ({ useOptionalSupabase: () => null }))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))

describe("submitted report images", () => {
  const original = "/api/media/private/danger-reports/owner/report/original.webp"
  const processed = ["/api/media/private/danger-reports/owner/report/processed.webp"]

  it("shows the attached processed image first and lets users switch to the original", () => {
    render(<SubmittedReportPreview isOpen onClose={vi.fn()} originalImage={original} processedImages={processed} />)
    expect(screen.getByAltText("加工画像 1")).toHaveAttribute("src", processed[0])
    expect(screen.getByRole("tab", { name: "加工画像" })).toHaveAttribute("aria-selected", "true")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "元画像" }), { button: 0 })
    expect(screen.getByAltText("報告の元画像")).toHaveAttribute("src", original)
  })

  it("shows the original when there are no processed attachments", () => {
    render(<SubmittedReportPreview isOpen onClose={vi.fn()} originalImage={original} processedImages={[]} />)
    expect(screen.getByAltText("報告の元画像")).toHaveAttribute("src", original)
    expect(screen.getByRole("tab", { name: "加工画像" })).toBeDisabled()
  })

  it("reloads a failed processed image with a new URL", () => {
    render(<SubmittedReportPreview isOpen onClose={vi.fn()} originalImage={original} processedImages={processed} />)
    fireEvent.error(screen.getByAltText("加工画像 1"))
    fireEvent.click(screen.getByRole("button", { name: "再試行" }))
    expect(screen.getByAltText("加工画像 1").getAttribute("src")).toMatch(/processed\.webp\?t=\d+$/)
  })
})
