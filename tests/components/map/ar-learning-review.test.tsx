import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ARLearningReviewCard } from "@/components/map/ar-learning-review"
import { buildKidsChecklist, generateKidsQuiz } from "@/lib/ar-learning-quiz"
import type { ARLearningTourSummary } from "@/lib/ar-learning-tour"
import type { RouteLearningProgressSummary } from "@/lib/ar-learning-route-progress"
import { createMockDangerReport } from "@/tests/fixtures/dangers"

const report = createMockDangerReport({
  id: "550e8400-e29b-41d4-a716-446655440000",
  title: "見通しの悪い交差点",
  danger_type: "traffic",
})

const routeSummary: RouteLearningProgressSummary = {
  totalCount: 1,
  reviewedCount: 1,
  savedCount: 0,
  completedCount: 1,
  pendingCount: 0,
  isComplete: true,
  revisitReports: [],
  highestRiskReport: report,
}

const learningSummary: ARLearningTourSummary = {
  totalCount: 1,
  reviewedCount: 1,
  savedCount: 0,
  revisitStops: [],
  highestRiskStop: null,
}

describe("ARLearningReviewCard", () => {
  it("チェックリスト完了後にAR内クイズを回答できる", async () => {
    const user = userEvent.setup()
    const onToggleChecklistItem = vi.fn()
    const onCompleteQuiz = vi.fn()
    const checklist = buildKidsChecklist([report])

    const { rerender } = render(
      <ARLearningReviewCard
        isParentChildMode={true}
        routeId="route-1"
        routeProgressSummary={routeSummary}
        learningSummary={learningSummary}
        checklist={checklist}
        quiz={generateKidsQuiz([report], { seed: "route-1" })}
        quizAnswers={{}}
        quizScore={0}
        quizTotal={0}
        quizCompletedAt={null}
        onToggleChecklistItem={onToggleChecklistItem}
        onCompleteQuiz={onCompleteQuiz}
        onRestartTour={vi.fn()}
        onClose={vi.fn()}
        onQuizLinkClick={vi.fn()}
      />,
    )

    expect(screen.getByText("親子チェックリスト")).toBeInTheDocument()
    expect(screen.getByText("チェックリストをすべて確認すると、最大3問のクイズを始められます。")).toBeInTheDocument()

    rerender(
      <ARLearningReviewCard
        isParentChildMode={true}
        routeId="route-1"
        routeProgressSummary={routeSummary}
        learningSummary={learningSummary}
        checklist={checklist.map((item) => ({ ...item, checked: true }))}
        quiz={generateKidsQuiz([report], { seed: "route-1" })}
        quizAnswers={{}}
        quizScore={0}
        quizTotal={0}
        quizCompletedAt={null}
        onToggleChecklistItem={onToggleChecklistItem}
        onCompleteQuiz={onCompleteQuiz}
        onRestartTour={vi.fn()}
        onClose={vi.fn()}
        onQuizLinkClick={vi.fn()}
      />,
    )

    const correctButton = screen.getByRole("button", { name: "止まって左右を見る" })
    await user.click(correctButton)

    expect(onCompleteQuiz).toHaveBeenCalledWith(expect.any(Object), 1, 1)
  })

  it("クイズ完了後は理解度を表示する", () => {
    render(
      <ARLearningReviewCard
        isParentChildMode={true}
        routeId="route-1"
        routeProgressSummary={routeSummary}
        learningSummary={learningSummary}
        checklist={buildKidsChecklist([report]).map((item) => ({ ...item, checked: true }))}
        quiz={generateKidsQuiz([report], { seed: "route-1" })}
        quizAnswers={{}}
        quizScore={1}
        quizTotal={1}
        quizCompletedAt="2026-05-04T00:00:00.000Z"
        onToggleChecklistItem={vi.fn()}
        onCompleteQuiz={vi.fn()}
        onRestartTour={vi.fn()}
        onClose={vi.fn()}
        onQuizLinkClick={vi.fn()}
      />,
    )

    expect(screen.getByText("理解度")).toBeInTheDocument()
    expect(screen.getByText("1 / 1")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "地図クイズへ" })).toHaveAttribute(
      "href",
      "/route-quiz?routeId=route-1",
    )
  })
})
