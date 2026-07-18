import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(),
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}))

vi.mock("@/lib/upstash-rate-limiter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/upstash-rate-limiter")>(
    "@/lib/upstash-rate-limiter",
  )
  return {
    ...actual,
    checkApiRateLimit: vi.fn().mockResolvedValue({ success: true }),
  }
})

vi.mock("@/lib/danger-report-moderation-service", () => ({
  DANGER_REPORT_MODERATION_SELECT:
    "id,user_id,title,description,danger_type,danger_level,latitude,longitude,status,ai_moderation_status",
  MAX_DANGER_MODERATION_FALLBACKS: 3,
  getDangerModerationFallbackCount: vi.fn().mockResolvedValue(0),
  getDangerModerationMode: vi.fn(() => "live"),
  markDangerReportModerationFailed: vi.fn(),
  moderateDangerReportRecord: vi.fn(),
}))

import { POST as postDanger } from "@/app/api/danger-report/moderate/route"
import { POST as postSuspicious } from "@/app/api/suspicious-alert/moderate/route"
import { createServerClient } from "@/lib/supabase-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  getDangerModerationFallbackCount,
  getDangerModerationMode,
  markDangerReportModerationFailed,
  moderateDangerReportRecord,
} from "@/lib/danger-report-moderation-service"

const ownReport = {
  id: "report-1",
  user_id: "user-1",
  danger_type: "traffic",
  status: "pending",
  ai_moderation_status: "pending",
}

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function mockAuth(user: { id: string } | null = { id: "user-1" }) {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
  } as any)
}

function queryResult(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  }
}

function mockAdmin(report: Record<string, unknown>, profileRole: string | null = null) {
  const reportQuery = queryResult(report)
  const profileQuery = queryResult(
    profileRole ? { role: profileRole } : null,
  )
  const from = vi.fn((table: string) =>
    table === "profiles" ? profileQuery : reportQuery,
  )
  vi.mocked(getSupabaseAdmin).mockReturnValue({ from } as any)
  return { from, reportQuery }
}

describe("POST /api/danger-report/moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getDangerModerationMode).mockReturnValue("live")
    vi.mocked(getDangerModerationFallbackCount).mockResolvedValue(0)
    vi.mocked(markDangerReportModerationFailed).mockResolvedValue(null as never)
    mockAuth()
    mockAdmin(ownReport)
    vi.mocked(moderateDangerReportRecord).mockResolvedValue({
      outcome: "updated",
      verdict: {
        status: "approved",
        reason: "問題なし",
        score: 0.1,
        aiExecuted: true,
      },
      report: { ...ownReport, status: "approved" },
    } as any)
  })

  it("requires authentication", async () => {
    mockAuth(null)

    const response = await postDanger(
      request("/api/danger-report/moderate", { reportId: "report-1" }),
    )

    expect(response.status).toBe(401)
    expect(moderateDangerReportRecord).not.toHaveBeenCalled()
  })

  it("allows the owner and delegates to the shared moderation service", async () => {
    const { reportQuery } = mockAdmin(ownReport)
    const response = await postDanger(
      request("/api/danger-report/moderate", { reportId: "report-1" }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(moderateDangerReportRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        report: ownReport,
        mode: "live",
      }),
    )
    expect(body.report.status).toBe("approved")
    expect(reportQuery.select).toHaveBeenCalledWith(
      expect.not.stringContaining("*"),
    )
  })

  it("does not expose internal moderation reason or score", async () => {
    vi.mocked(moderateDangerReportRecord).mockResolvedValueOnce({
      outcome: "updated",
      verdict: {
        status: "approved",
        reason: "内部判定理由",
        score: 0.1,
        aiExecuted: true,
      },
      report: {
        ...ownReport,
        status: "approved",
        ai_moderation_reason: "攻略に使える内部理由",
        ai_moderation_score: 0.1,
        ai_moderation_checked_at: "2026-07-18T00:00:00.000Z",
      },
    } as any)

    const response = await postDanger(
      request("/api/danger-report/moderate", { reportId: "report-1" }),
    )
    const body = await response.json()

    expect(body.report).not.toHaveProperty("ai_moderation_reason")
    expect(body.report).not.toHaveProperty("ai_moderation_score")
    expect(body.report).not.toHaveProperty("ai_moderation_checked_at")
  })

  it("returns 202 while a live fallback waits for the bounded retry", async () => {
    vi.mocked(moderateDangerReportRecord).mockResolvedValueOnce({
      outcome: "retry",
      verdict: {
        status: "needs_review",
        reason: "AI障害",
        score: 0.5,
        aiExecuted: false,
        fallback: true,
      },
      report: ownReport,
    } as any)

    const response = await postDanger(
      request("/api/danger-report/moderate", { reportId: "report-1" }),
    )
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body).toMatchObject({ mode: "live", pending: true })
  })

  it("stops owner-triggered retries after the live fallback budget", async () => {
    const failedReport = {
      ...ownReport,
      ai_moderation_status: "needs_review",
    }
    vi.mocked(getDangerModerationFallbackCount).mockResolvedValueOnce(3)
    vi.mocked(markDangerReportModerationFailed).mockResolvedValueOnce(
      failedReport as never,
    )

    const response = await postDanger(
      request("/api/danger-report/moderate", { reportId: "report-1" }),
    )
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body).toMatchObject({
      mode: "live",
      pending: true,
      report: failedReport,
    })
    expect(markDangerReportModerationFailed).toHaveBeenCalledWith(
      expect.anything(),
      "report-1",
      expect.any(Date),
    )
    expect(moderateDangerReportRecord).not.toHaveBeenCalled()
  })

  it("keeps the suspicious endpoint pending without an error in off mode", async () => {
    vi.mocked(getDangerModerationMode).mockReturnValueOnce("off")

    const response = await postSuspicious(
      request("/api/suspicious-alert/moderate", { reportId: "report-1" }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ mode: "off", skipped: true })
    expect(moderateDangerReportRecord).not.toHaveBeenCalled()
  })

  it("forbids a different non-admin user", async () => {
    mockAdmin({ ...ownReport, user_id: "owner-2" }, "user")

    const response = await postDanger(
      request("/api/danger-report/moderate", { reportId: "report-1" }),
    )

    expect(response.status).toBe(403)
    expect(moderateDangerReportRecord).not.toHaveBeenCalled()
  })

  it("allows a profile admin to moderate another user's report", async () => {
    mockAdmin({ ...ownReport, user_id: "owner-2" }, "admin")

    const response = await postDanger(
      request("/api/danger-report/moderate", { reportId: "report-1" }),
    )

    expect(response.status).toBe(200)
    expect(moderateDangerReportRecord).toHaveBeenCalled()
  })

  it("returns 409 before running AI for finalized moderation", async () => {
    mockAdmin({ ...ownReport, ai_moderation_status: "approved" })

    const response = await postDanger(
      request("/api/danger-report/moderate", { reportId: "report-1" }),
    )

    expect(response.status).toBe(409)
    expect(moderateDangerReportRecord).not.toHaveBeenCalled()
  })

  it("keeps the legacy suspicious endpoint but rejects non-suspicious reports", async () => {
    const response = await postSuspicious(
      request("/api/suspicious-alert/moderate", { reportId: "report-1" }),
    )

    expect(response.status).toBe(400)
    expect(moderateDangerReportRecord).not.toHaveBeenCalled()
  })
})
