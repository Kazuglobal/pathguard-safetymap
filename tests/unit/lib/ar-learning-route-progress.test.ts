import { describe, expect, it } from "vitest"

import { summarizeRouteLearningProgress } from "@/lib/ar-learning-route-progress"
import { createMockDangerReport } from "@/tests/fixtures/dangers"

describe("summarizeRouteLearningProgress", () => {
  const reports = [
    createMockDangerReport({ id: "near-danger", danger_level: 3 }),
    createMockDangerReport({ id: "far-danger", danger_level: 5, title: "遠い交差点" }),
  ]

  it("表示中の危険地点だけでなくルート全体の未確認を完了判定に含める", () => {
    const summary = summarizeRouteLearningProgress(reports, {
      "near-danger": "reviewed",
    })

    expect(summary.totalCount).toBe(2)
    expect(summary.completedCount).toBe(1)
    expect(summary.pendingCount).toBe(1)
    expect(summary.isComplete).toBe(false)
  })

  it("ルート上の全危険地点がreviewedまたはsavedなら完了にする", () => {
    const summary = summarizeRouteLearningProgress(reports, {
      "near-danger": "reviewed",
      "far-danger": "saved",
    })

    expect(summary.isComplete).toBe(true)
    expect(summary.reviewedCount).toBe(1)
    expect(summary.savedCount).toBe(1)
    expect(summary.highestRiskReport?.id).toBe("far-danger")
  })
})
