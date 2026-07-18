import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { ReportModerationQueue } from "@/components/admin/report-moderation-queue"
import type { AdminModerationReport } from "@/lib/admin-report-moderation-queue"

function report(
  id: string,
  aiStatus: AdminModerationReport["ai_moderation_status"],
): AdminModerationReport {
  return {
    id,
    title: `報告 ${id}`,
    description: "交差点の見通しが悪いです。",
    danger_type: "traffic",
    danger_level: 3,
    status: "pending",
    latitude: 35.6812,
    longitude: 139.7671,
    created_at: "2026-07-18T00:00:00.000Z",
    profiles: { display_name: "管理テスト" },
    ai_moderation_status: aiStatus,
    ai_moderation_reason:
      aiStatus === "escalated" ? "現在進行中の危険が申告されています。" : "確認理由",
    ai_moderation_score: 0.91,
    ai_moderation_checked_at: "2026-07-18T00:01:00.000Z",
  }
}

describe("ReportModerationQueue", () => {
  it("shows queue tabs with counts and prioritizes escalation details", () => {
    render(
      <ReportModerationQueue
        reports={[
          report("e-1", "escalated"),
          report("n-1", "needs_review"),
          report("a-1", "approved"),
        ]}
        updatingIds={new Set()}
        onStatusChange={vi.fn()}
      />,
    )

    expect(
      screen.getByRole("tab", { name: /エスカレーション1件/ }),
    ).toHaveAttribute("data-state", "active")
    expect(screen.getByText("現在進行中の危険が申告されています。"))
      .toBeInTheDocument()
    expect(screen.getByText("AIスコア 91%")).toBeInTheDocument()
  })

  it("offers a random ten-item audit action in the approved queue", async () => {
    const user = userEvent.setup()
    const approved = Array.from({ length: 12 }, (_, index) =>
      report(`a-${index}`, "approved"),
    )
    render(
      <ReportModerationQueue
        reports={approved}
        updatingIds={new Set()}
        onStatusChange={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("tab", { name: /AI承認済み12件/ }))
    const auditButton = screen.getByRole("button", {
      name: "ランダム10件を表示",
    })
    expect(auditButton).toBeInTheDocument()
    await user.click(auditButton)

    expect(screen.getAllByTestId("admin-report-card")).toHaveLength(10)
  })

  it("shows a meaningful empty state for an empty queue", () => {
    render(
      <ReportModerationQueue
        reports={[]}
        updatingIds={new Set()}
        onStatusChange={vi.fn()}
      />,
    )

    expect(screen.getByRole("status")).toHaveTextContent(
      "エスカレーションされた報告はありません",
    )
  })
})
