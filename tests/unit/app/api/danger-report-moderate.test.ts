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
  getDangerModerationMode: vi.fn(() => "live"),
  moderateDangerReportRecord: vi.fn(),
}))

import { POST as postDanger } from "@/app/api/danger-report/moderate/route"
import { POST as postSuspicious } from "@/app/api/suspicious-alert/moderate/route"
import { createServerClient } from "@/lib/supabase-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
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
  return { from }
}

describe("POST /api/danger-report/moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
