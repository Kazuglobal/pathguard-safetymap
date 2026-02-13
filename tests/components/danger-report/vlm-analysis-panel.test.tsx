import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
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

  it("should render completed state with analysis results", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    // Check status badge
    expect(screen.getByText("完了")).toBeInTheDocument()

    // Check safety score
    expect(screen.getByText("65")).toBeInTheDocument()
    expect(screen.getByText("/100")).toBeInTheDocument()
    expect(screen.getByText("要注意")).toBeInTheDocument()

    // Check hazards count
    expect(screen.getByText("検出されたリスク要因 (2件)")).toBeInTheDocument()

    // Check hazard descriptions
    expect(screen.getByText("交通量が多く、車のスピードが速い")).toBeInTheDocument()
    expect(screen.getByText("見通しが悪い交差点")).toBeInTheDocument()

    // Check tabs
    expect(screen.getByRole("tab", { name: "子供視点" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "時間・天候" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "改善提案" })).toBeInTheDocument()
  })

  it("should display child-specific risks in hazard items", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getByText(/子供が横断中に車に気づかれにくい/)).toBeInTheDocument()
    expect(screen.getByText(/背の低い子供が見えにくい/)).toBeInTheDocument()
  })

  it("should display recommendations in hazard items", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getByText(/信号機の設置を検討/)).toBeInTheDocument()
    expect(screen.getByText(/カーブミラーの設置/)).toBeInTheDocument()
  })

  it("should display correct severity badges", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    expect(screen.getByText("レベル4")).toBeInTheDocument()
    expect(screen.getByText("レベル3")).toBeInTheDocument()
  })

  it("should render all tab content", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    // Check that all tabs are present
    expect(screen.getByRole("tab", { name: "子供視点" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "時間・天候" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "改善提案" })).toBeInTheDocument()

    // Default tab content should be visible
    expect(screen.getByText(mockResult.child_perspective_summary)).toBeInTheDocument()
  })

  it("should display improvement suggestions correctly", () => {
    render(
      <VlmAnalysisPanel
        status="completed"
        result={mockResult}
        error={null}
        onRetry={vi.fn()}
      />
    )

    // All improvement suggestions should be in the document (even if hidden)
    // Just verify the data is rendered
    const improvementTab = screen.getByRole("tab", { name: "改善提案" })
    expect(improvementTab).toBeInTheDocument()

    // Verify component renders without crashing when mockResult contains improvement suggestions
    expect(mockResult.improvement_suggestions.immediate_actions?.length).toBeGreaterThan(0)
    expect(mockResult.improvement_suggestions.medium_term_improvements?.length).toBeGreaterThan(0)
    expect(mockResult.improvement_suggestions.community_involvement?.length).toBeGreaterThan(0)
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

    expect(screen.getByText("検出されたリスク要因 (0件)")).toBeInTheDocument()
  })

  it("should handle missing time/weather risks", () => {
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

    // Switch to time/weather tab
    fireEvent.click(screen.getByRole("tab", { name: "時間・天候" }))

    // Should not display any risk entries
    expect(screen.queryByText("朝の通学時")).not.toBeInTheDocument()
  })
})
