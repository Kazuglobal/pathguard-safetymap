import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ReportComposer from "@/components/danger-report/report-composer"

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  getCurrentPosition: vi.fn(),
}))

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({ supabase: {} }),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock("@/hooks/use-danger-report-submit", () => ({
  useDangerReportSubmit: () => mocks.submit,
}))

vi.mock("@/components/danger-report/danger-report-form", () => ({
  default: ({ selectedLocation }: { selectedLocation: [number, number] | null }) => (
    <div data-testid="report-wizard" data-location={selectedLocation?.join(",") ?? "none"} />
  ),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

describe("ReportComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { getCurrentPosition: mocks.getCurrentPosition },
    })
  })

  it("shows the approved three-step hierarchy and opens the shared wizard", async () => {
    const user = userEvent.setup()
    render(<ReportComposer />)

    expect(screen.getByText("1", { selector: "span" })).toBeInTheDocument()
    expect(screen.getByText("場所", { selector: "span" })).toBeInTheDocument()
    expect(screen.getByText("写真・内容", { selector: "span" })).toBeInTheDocument()
    expect(screen.getByText("確認", { selector: "span" })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "危険を報告する" }))

    expect(screen.getByRole("dialog", { name: "危険を報告する" })).toBeInTheDocument()
    expect(screen.getByTestId("report-wizard")).toHaveAttribute("data-location", "none")
    expect(screen.getByRole("link", { name: "住所や地図から選ぶ" })).toHaveAttribute("href", "/map?report=open")
  })

  it("offers map recovery when current-location permission is denied", async () => {
    mocks.getCurrentPosition.mockImplementationOnce((_success, failure) => {
      failure({ code: 1, PERMISSION_DENIED: 1 })
    })
    const user = userEvent.setup()
    render(<ReportComposer />)

    await user.click(screen.getByRole("button", { name: "現在地からはじめる" }))

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("住所や地図から選べます")
    })
  })
})
