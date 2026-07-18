import { describe, expect, it } from "vitest"

import {
  countModerationQueues,
  filterModerationQueue,
  sampleApprovedReports,
  type AdminModerationReport,
} from "@/lib/admin-report-moderation-queue"

function report(
  id: string,
  aiStatus: AdminModerationReport["ai_moderation_status"],
): AdminModerationReport {
  return {
    id,
    title: id,
    description: null,
    danger_type: "traffic",
    danger_level: 3,
    status: "pending",
    latitude: 35,
    longitude: 139,
    created_at: "2026-07-18T00:00:00.000Z",
    profiles: null,
    ai_moderation_status: aiStatus,
    ai_moderation_reason: null,
    ai_moderation_score: null,
    ai_moderation_checked_at: null,
  }
}

const reports = [
  report("escalated", "escalated"),
  report("review", "needs_review"),
  report("approved", "approved"),
  report("pending", "pending"),
  report("unreviewed", null),
]

describe("admin moderation queues", () => {
  it("filters each operational queue by AI status", () => {
    expect(filterModerationQueue(reports, "escalated").map((item) => item.id))
      .toEqual(["escalated"])
    expect(filterModerationQueue(reports, "needs_review").map((item) => item.id))
      .toEqual(["review"])
    expect(filterModerationQueue(reports, "approved").map((item) => item.id))
      .toEqual(["approved"])
    expect(filterModerationQueue(reports, "all")).toHaveLength(5)
  })

  it("returns tab counts including all reports", () => {
    expect(countModerationQueues(reports)).toEqual({
      escalated: 1,
      needs_review: 1,
      approved: 1,
      all: 5,
    })
  })

  it("samples at most ten approved reports without mutating the source", () => {
    const source = Array.from({ length: 12 }, (_, index) =>
      report(`r-${index}`, "approved"),
    )
    const originalOrder = source.map((item) => item.id)
    const sampled = sampleApprovedReports(source, () => 0.5)

    expect(sampled).toHaveLength(10)
    expect(sampled.every((item) => item.ai_moderation_status === "approved"))
      .toBe(true)
    expect(source.map((item) => item.id)).toEqual(originalOrder)
  })
})
