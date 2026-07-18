import { describe, expect, it } from "vitest"

import { evaluateDangerModeration } from "@/lib/danger-report-moderation-eval"

describe("evaluateDangerModeration", () => {
  it("builds a confusion matrix and computes the rollout gate metrics", () => {
    const result = evaluateDangerModeration([
      { humanStatus: "approved", aiStatus: "approved", fallback: false },
      { humanStatus: "approved", aiStatus: "needs_review", fallback: false },
      { humanStatus: "rejected", aiStatus: "approved", fallback: false },
      { humanStatus: "rejected", aiStatus: "escalated", fallback: true },
    ])

    expect(result.confusionMatrix).toEqual({
      approved: { approved: 1, needs_review: 1, escalated: 0 },
      rejected: { approved: 1, needs_review: 0, escalated: 1 },
    })
    expect(result.dangerousErrorCount).toBe(1)
    expect(result.dangerousErrorRate).toBe(0.5)
    expect(result.approveRecall).toBe(0.5)
    expect(result.fallbackRate).toBe(0.25)
    expect(result.phase0GatePassed).toBe(false)
  })

  it("avoids NaN when a denominator has no samples", () => {
    const result = evaluateDangerModeration([])

    expect(result.dangerousErrorRate).toBe(0)
    expect(result.approveRecall).toBe(0)
    expect(result.fallbackRate).toBe(0)
  })

  it("passes Phase 0 only with zero dangerous errors and at least 30% recall", () => {
    const result = evaluateDangerModeration([
      { humanStatus: "approved", aiStatus: "approved", fallback: false },
      { humanStatus: "approved", aiStatus: "needs_review", fallback: false },
      { humanStatus: "approved", aiStatus: "needs_review", fallback: false },
      { humanStatus: "rejected", aiStatus: "needs_review", fallback: false },
    ])

    expect(result.approveRecall).toBeCloseTo(1 / 3)
    expect(result.phase0GatePassed).toBe(true)
  })
})
