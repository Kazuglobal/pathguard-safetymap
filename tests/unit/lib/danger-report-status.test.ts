import { describe, expect, it } from "vitest"
import { resolveInitialDangerReportStatus } from "@/lib/danger-report-status"

describe("resolveInitialDangerReportStatus", () => {
  it("returns published when requested status is published", () => {
    expect(resolveInitialDangerReportStatus("published")).toBe("published")
  })

  it("falls back to pending for unsupported statuses", () => {
    expect(resolveInitialDangerReportStatus("approved")).toBe("pending")
    expect(resolveInitialDangerReportStatus("resolved")).toBe("pending")
  })

  it("falls back to pending when status is missing", () => {
    expect(resolveInitialDangerReportStatus(undefined)).toBe("pending")
    expect(resolveInitialDangerReportStatus(null)).toBe("pending")
  })
})
