import { describe, expect, it } from "vitest"

import { resolveSuspiciousModerationOutcome } from "@/lib/suspicious-moderation-response"

const approvedReport = { id: "report-1", status: "approved" }
const approvedVerdict = { status: "approved" }

describe("resolveSuspiciousModerationOutcome", () => {
  it.each([
    [{ mode: "off", skipped: true }, "off"],
    [
      {
        mode: "shadow",
        verdict: approvedVerdict,
        report: { ...approvedReport, status: "pending" },
      },
      "shadow",
    ],
  ])("keeps a %s response in the pending UI", (body) => {
    expect(resolveSuspiciousModerationOutcome(true, body)).toBe("pending")
  })

  it("shows published only for a persisted live approval", () => {
    expect(
      resolveSuspiciousModerationOutcome(true, {
        mode: "live",
        verdict: approvedVerdict,
        report: approvedReport,
      }),
    ).toBe("published")
  })

  it("keeps a live needs-review result pending", () => {
    expect(
      resolveSuspiciousModerationOutcome(true, {
        mode: "live",
        verdict: { status: "needs_review" },
        report: { ...approvedReport, status: "pending" },
      }),
    ).toBe("pending")
  })

  it("treats an HTTP or malformed live response as failed", () => {
    expect(resolveSuspiciousModerationOutcome(false, {})).toBe("failed")
    expect(
      resolveSuspiciousModerationOutcome(true, { mode: "live" }),
    ).toBe("failed")
  })
})
