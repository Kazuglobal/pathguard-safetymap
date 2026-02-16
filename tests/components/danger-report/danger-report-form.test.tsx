import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import DangerReportForm from "@/components/danger-report/danger-report-form"

const mocks = vi.hoisted(() => ({
  supabase: { from: vi.fn(), rpc: vi.fn() } as any,
  toast: vi.fn(),
  fetchStats: vi.fn(),
  resetAccidentStats: vi.fn(),
  hookState: { enrichCallCount: 0 },
  startVlmAnalysis: vi.fn(async () => undefined),
  retryVlmAnalysis: vi.fn(async () => undefined),
  resetVlmAnalysis: vi.fn(),
  enrichReportWithAccidents: vi.fn(),
}))

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: vi.fn(() => ({ supabase: mocks.supabase })),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: vi.fn(() => ({ toast: mocks.toast })),
}))

vi.mock("@/hooks/use-vlm-analysis", () => ({
  useVlmAnalysis: vi.fn(() => ({
    status: "idle",
    result: null,
    error: null,
    startAnalysis: mocks.startVlmAnalysis,
    retry: mocks.retryVlmAnalysis,
    reset: mocks.resetVlmAnalysis,
  })),
}))

vi.mock("@/hooks/use-accident-stats", async () => {
  const ReactModule = await import("react")

  return {
    useAccidentStats: () => {
      const [status, setStatus] = ReactModule.useState<"idle" | "loading" | "loaded" | "error">("loaded")

      const enrichReport = ReactModule.useCallback(async () => {
        mocks.hookState.enrichCallCount += 1
        setStatus("loading")
        return new Promise(() => {}) as Promise<never>
      }, [])

      return {
        stats: { total_accidents: 3 } as any,
        status,
        error: null,
        isLoading: status === "loading",
        hasData: true,
        fetchStats: mocks.fetchStats,
        enrichReport,
        reset: mocks.resetAccidentStats,
      }
    },
  }
})

vi.mock("@/components/danger-report/accident-stats-panel", () => ({
  AccidentStatsPanel: () => <div data-testid="accident-panel">accident-panel</div>,
  AccidentStatsLoading: () => <div data-testid="accident-loading">accident-loading</div>,
}))

vi.mock("@/components/danger-report/vlm-analysis-panel", () => ({
  VlmAnalysisPanel: () => null,
}))

vi.mock("@/components/danger-report/image-preview-dialog", () => ({
  default: () => null,
}))

vi.mock("@/lib/traffic-accident-data", () => ({
  enrichReportWithAccidents: mocks.enrichReportWithAccidents,
}))

describe("DangerReportForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hookState.enrichCallCount = 0
    mocks.fetchStats.mockResolvedValue({ total_accidents: 3 })
    mocks.enrichReportWithAccidents.mockResolvedValue({ id: "report-123" })
  })

  it("keeps accident stats panel stable after submit and bypasses hook enrich state", async () => {
    const onSubmit = vi.fn(async () => ({ reportId: "report-123", imageUrl: null }))
    const onCancel = vi.fn()
    const user = userEvent.setup()

    render(
      <DangerReportForm
        onSubmit={onSubmit}
        onCancel={onCancel}
        selectedLocation={[139.7004, 35.6595]}
      />
    )

    await waitFor(() => {
      expect(mocks.resetAccidentStats).toHaveBeenCalled()
      expect(mocks.fetchStats).toHaveBeenCalledWith({
        latitude: 35.6595,
        longitude: 139.7004,
      })
    })

    expect(screen.getByTestId("accident-panel")).toBeInTheDocument()
    expect(screen.queryByTestId("accident-loading")).not.toBeInTheDocument()

    await user.type(screen.getByLabelText("タイトル"), "交差点の見通しが悪い")
    await user.click(screen.getByRole("button", { name: "報告を送信" }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
      expect(mocks.enrichReportWithAccidents).toHaveBeenCalledWith(mocks.supabase, "report-123")
    })

    expect(mocks.hookState.enrichCallCount).toBe(0)
    expect(screen.queryByTestId("accident-loading")).not.toBeInTheDocument()
    expect(screen.getByTestId("accident-panel")).toBeInTheDocument()
  })
})
