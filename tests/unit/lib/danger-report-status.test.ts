import { describe, expect, it } from "vitest"
import {
  PUBLIC_DANGER_REPORT_STATUSES,
  resolveInitialDangerReportStatus,
  shouldRetryDangerReportInsertAsPending,
} from "@/lib/danger-report-status"

describe("PUBLIC_DANGER_REPORT_STATUSES", () => {
  it("includes all statuses that must be visible in public map/report feeds", () => {
    expect(PUBLIC_DANGER_REPORT_STATUSES).toEqual(["approved", "published", "resolved"])
  })
})

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

describe("shouldRetryDangerReportInsertAsPending", () => {
  it("returns true when published insert fails with RLS", () => {
    expect(
      shouldRetryDangerReportInsertAsPending("published", {
        code: "42501",
        message: "new row violates row-level security policy for table danger_reports",
      })
    ).toBe(true)
  })

  it("returns true when published insert fails with status check constraint", () => {
    expect(
      shouldRetryDangerReportInsertAsPending("published", {
        code: "23514",
        message: 'new row for relation "danger_reports" violates check constraint "danger_reports_status_check"',
      })
    ).toBe(true)
  })

  it("returns false for non-published status", () => {
    expect(
      shouldRetryDangerReportInsertAsPending("pending", {
        code: "42501",
        message: "new row violates row-level security policy",
      })
    ).toBe(false)
  })

  it("returns false for non-RLS errors", () => {
    expect(
      shouldRetryDangerReportInsertAsPending("published", {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      })
    ).toBe(false)
  })
})
