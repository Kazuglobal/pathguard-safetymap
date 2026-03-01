import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { VlmAnalysisPanel } from "@/components/danger-report/vlm-analysis-panel"
import type { VlmAnalysisResult } from "@/lib/vlm-analysis"

const mockResult: VlmAnalysisResult = {
  hazards: [
    {
      category: "traffic",
      severity: 4,
      description_ja: "交通量が多く、車のスピードが速い",
      description_en: "High traffic volume and fast vehicle speeds",
      child_specific_risk: "子供が横断中に車に気づかれにくい",
      recommendation: "信号機の設置を検討",
    },
    {
      category: "visibility",
      severity: 3,
      description_ja: "見通しが悪い交差点",
      description_en: "Poor visibility at intersection",
      child_specific_risk: "背の低い子供が見えにくい",
      recommendation: "カーブミラーの設置",
    },
  ],
  overall_safety_score: 65,
  overall_risk_level: 3,
  child_perspective_summary: "この通学路は交通量が多く、子供にとって危険な箇所が複数あります。",
  time_weather_risks: {
    morning_commute: "朝の通勤時間帯は交通量が増加",
    rainy_conditions: "雨天時は視界が悪化",
  },
  improvement_suggestions: {
    immediate_actions: ["警察に取締りを依頼", "保護者の見守り強化"],
    medium_term_improvements: ["信号機の設置", "横断歩道の追加"],
    community_involvement: ["地域でのパトロール活動"],
  },
}

/** Expand the collapsible details section */
function getToggleButton() {
  return screen.getByRole("button", { name: /分析詳細を(展開|折りたたむ)/ })
}

/** Toggle the collapsible details section */
function expandDetails() {
  const toggleButton = getToggleButton()
  fireEvent.click(toggleButton)
}

describe("VlmAnalysisPanel", () => {
  it("should not render anything when status is idle", () => {
    const { container } = render(
      <VlmAnalysisPanel
        status="idle"
        result={null}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expect(container.firstChild).toBeNull()
  })

  it("should render analyzing state with spinner", () => {
    render(
      <VlmAnalysisPanel
        status="analyzing"
        result={null}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getByText("画像を解析しています...")).toBeInTheDocument()
    expect(screen.getByText("Claude Haiku Visionで危険要因を検出中")).toBeInTheDocument()
    expect(screen.getByText("分析中")).toBeInTheDocument()
  })

  it("should render failed state with error message and retry button", () => {
    const onRetry = vi.fn()

    render(
      <VlmAnalysisPanel
        status="failed"
        result={null}
        error="Network timeout"
        onRetry={onRetry}
      />
    )

    expect(screen.getByText("分析に失敗しました")).toBeInTheDocument()
    expect(screen.getByText("Network timeout")).toBeInTheDocument()
    expect(screen.getByText("失敗")).toBeInTheDocument()

    const retryButton = screen.getByRole("button", { name: /再試行/i })
    expect(retryButton).toBeInTheDocument()

    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("should render completed state with safety score always visible", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    // Status badge
    expect(screen.getByText("完了")).toBeInTheDocument()

    // Safety score always visible (even when collapsed)
    expect(screen.getByText("65")).toBeInTheDocument()
    expect(screen.getByText("/100")).toBeInTheDocument()
    expect(screen.getByText("要注意")).toBeInTheDocument()
  })

  it("should show collapsed hint with hazard count when collapsed", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getByText(/タップして詳細を表示（リスク要因 2件）/)).toBeInTheDocument()

    // Details should NOT be visible when collapsed
    expect(screen.queryByText("検出されたリスク要因 (2件)")).not.toBeInTheDocument()
    expect(screen.queryByText("交通量が多く、車のスピードが速い")).not.toBeInTheDocument()
  })

  it("should expand details when toggle button is clicked", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    // Expand
    expandDetails()

    // Now details should be visible
    expect(screen.getByText("検出されたリスク要因 (2件)")).toBeInTheDocument()
    expect(screen.getByText("交通量が多く、車のスピードが速い")).toBeInTheDocument()
    expect(screen.getByText("見通しが悪い交差点")).toBeInTheDocument()

    // Tabs should be visible
    expect(screen.getByRole("tab", { name: "子供視点" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "時間・天候" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "改善提案" })).toBeInTheDocument()

    // Collapsed hint should disappear
    expect(screen.queryByText(/タップして詳細を表示/)).not.toBeInTheDocument()
  })

  it("should collapse details when toggle button is clicked again", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    // Expand then collapse
    expandDetails()
    expandDetails()

    // Details should be hidden again
    expect(screen.queryByText("検出されたリスク要因 (2件)")).not.toBeInTheDocument()
    expect(screen.getByText(/タップして詳細を表示/)).toBeInTheDocument()
  })

  it("should have correct aria-expanded attribute on toggle button", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    const toggleButton = screen.getByRole("button", { name: /分析詳細を展開/ })
    expect(toggleButton).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(toggleButton)
    expect(toggleButton).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByRole("button", { name: /分析詳細を折りたたむ/ })
    ).toBeInTheDocument()
  })

  it("should generate unique detail section ids per panel instance", () => {
    render(
      <>
        <VlmAnalysisPanel
          status="completed"
          result={mockResult}
          error={null}
          onRetry={vi.fn()}
        />
        <VlmAnalysisPanel
          status="completed"
          result={mockResult}
          error={null}
          onRetry={vi.fn()}
        />
      </>
    )

    const toggleButtons = screen.getAllByRole("button", { name: /分析詳細を展開/ })
    expect(toggleButtons).toHaveLength(2)

    const firstControls = toggleButtons[0].getAttribute("aria-controls")
    const secondControls = toggleButtons[1].getAttribute("aria-controls")
    expect(firstControls).toBeTruthy()
    expect(secondControls).toBeTruthy()
    expect(firstControls).not.toBe(secondControls)
    expect(document.getElementById(firstControls as string)).toBeNull()
    expect(document.getElementById(secondControls as string)).toBeNull()

    fireEvent.click(toggleButtons[0])
    fireEvent.click(toggleButtons[1])

    expect(document.getElementById(firstControls as string)).toBeInTheDocument()
    expect(document.getElementById(secondControls as string)).toBeInTheDocument()
  })

  it("should display child-specific risks when expanded", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expandDetails()

    expect(screen.getByText(/子供が横断中に車に気づかれにくい/)).toBeInTheDocument()
    expect(screen.getByText(/背の低い子供が見えにくい/)).toBeInTheDocument()
  })

  it("should display recommendations when expanded", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expandDetails()

    expect(screen.getByText(/信号機の設置を検討/)).toBeInTheDocument()
    expect(screen.getByText(/カーブミラーの設置/)).toBeInTheDocument()
  })

  it("should display correct severity badges when expanded", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expandDetails()

    expect(screen.getByText("レベル4")).toBeInTheDocument()
    expect(screen.getByText("レベル3")).toBeInTheDocument()
  })

  it("should render all tab content when expanded", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expandDetails()

    // Check that all tabs are present
    expect(screen.getByRole("tab", { name: "子供視点" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "時間・天候" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "改善提案" })).toBeInTheDocument()

    // Default tab content should be visible
    expect(screen.getByText(mockResult.child_perspective_summary)).toBeInTheDocument()
  })

  it("should display improvement suggestions correctly when expanded", async () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expandDetails()

    const user = userEvent.setup()
    const improvementTab = screen.getByRole("tab", { name: "改善提案" })
    await user.click(improvementTab)
    expect(improvementTab).toHaveAttribute("aria-selected", "true")

    expect(await screen.findByText("警察に取締りを依頼")).toBeInTheDocument()
    expect(screen.getByText("保護者の見守り強化")).toBeInTheDocument()
    expect(screen.getByText("信号機の設置")).toBeInTheDocument()
    expect(screen.getByText("横断歩道の追加")).toBeInTheDocument()
    expect(screen.getByText("地域でのパトロール活動")).toBeInTheDocument()
  })

  it("should handle empty hazards array", () => {
    const emptyResult: VlmAnalysisResult = {
      ...mockResult,
      hazards: [],
    }

    render(
      <VlmAnalysisPanel
        status="completed"
        result={emptyResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    // Collapsed hint should still be visible to discover expandable summary
    expect(screen.getByText(/タップして詳細を表示（分析サマリーを確認）/)).toBeInTheDocument()

    expandDetails()

    expect(screen.getByText("検出されたリスク要因 (0件)")).toBeInTheDocument()
  })

  it("should handle missing time/weather risks", async () => {
    const resultWithoutTimeRisks: VlmAnalysisResult = {
      ...mockResult,
      time_weather_risks: {},
    }

    render(
      <VlmAnalysisPanel
        status="completed"
        result={resultWithoutTimeRisks}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expandDetails()

    const user = userEvent.setup()
    // Switch to time/weather tab
    const timeWeatherTab = screen.getByRole("tab", { name: "時間・天候" })
    await user.click(timeWeatherTab)
    expect(timeWeatherTab).toHaveAttribute("aria-selected", "true")

    // Should not display any risk entries
    expect(screen.queryByText("朝の通学時")).not.toBeInTheDocument()
  })
})
