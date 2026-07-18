import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}))

vi.mock("@/lib/danger-report-moderation-service", () => ({
  getDangerModerationMode: vi.fn(() => "live"),
  getDangerModerationFallbackCount: vi.fn().mockResolvedValue(0),
  markDangerReportModerationFailed: vi.fn().mockResolvedValue(undefined),
  moderateDangerReportRecord: vi.fn().mockResolvedValue({
    outcome: "updated",
  }),
}))

vi.mock("@/lib/danger-report-moderation-monitoring", () => ({
  monitorDangerModerationOperations: vi.fn().mockResolvedValue({
    alerted: false,
    reasons: [],
  }),
}))

import { GET } from "@/app/api/cron/moderation-sweep/route"
import { monitorDangerModerationOperations } from "@/lib/danger-report-moderation-monitoring"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  getDangerModerationFallbackCount,
  markDangerReportModerationFailed,
  moderateDangerReportRecord,
} from "@/lib/danger-report-moderation-service"

function request(token = "test-cron-secret") {
  return new NextRequest("http://localhost/api/cron/moderation-sweep", {
    headers: { authorization: `Bearer ${token}` },
  })
}

function adminWithReports(reports: Array<Record<string, unknown>>) {
  const calls: Array<[string, ...unknown[]]> = []
  const query = {
    select(...args: unknown[]) {
      calls.push(["select", ...args])
      return this
    },
    eq(...args: unknown[]) {
      calls.push(["eq", ...args])
      return this
    },
    or(...args: unknown[]) {
      calls.push(["or", ...args])
      return this
    },
    lt(...args: unknown[]) {
      calls.push(["lt", ...args])
      return this
    },
    order(...args: unknown[]) {
      calls.push(["order", ...args])
      return this
    },
    limit(...args: unknown[]) {
      calls.push(["limit", ...args])
      return Promise.resolve({ data: reports, error: null })
    },
  }
  const client = { from: vi.fn(() => query) }
  vi.mocked(getSupabaseAdmin).mockReturnValue(client as any)
  return { client, calls }
}

describe("GET /api/cron/moderation-sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("CRON_SECRET", "test-cron-secret")
    adminWithReports([])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("rejects an invalid cron secret", async () => {
    const response = await GET(request("wrong"))

    expect(response.status).toBe(401)
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it("selects stale null-or-pending rows oldest-first with a limit of 10", async () => {
    const { calls } = adminWithReports([{ id: "r-1" }])

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(calls).toContainEqual(["eq", "status", "pending"])
    expect(calls).toContainEqual([
      "or",
      "ai_moderation_status.is.null,ai_moderation_status.eq.pending",
    ])
    expect(calls.some(([name]) => name === "lt")).toBe(true)
    expect(calls).toContainEqual(["order", "created_at", { ascending: true }])
    expect(calls).toContainEqual(["limit", 10])
    expect(moderateDangerReportRecord).toHaveBeenCalledTimes(1)
  })

  it("stops retrying after three fallbacks and sends the report to human review", async () => {
    adminWithReports([{ id: "r-3" }])
    vi.mocked(getDangerModerationFallbackCount).mockResolvedValueOnce(3)

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(markDangerReportModerationFailed).toHaveBeenCalledWith(
      expect.anything(),
      "r-3",
      expect.any(Date),
    )
    expect(moderateDangerReportRecord).not.toHaveBeenCalled()
    expect(body.exhausted).toBe(1)
  })

  it("processes reports serially", async () => {
    adminWithReports([{ id: "r-1" }, { id: "r-2" }])
    const order: string[] = []
    vi.mocked(moderateDangerReportRecord).mockImplementation(async ({ report }: any) => {
      order.push(`start:${report.id}`)
      await Promise.resolve()
      order.push(`end:${report.id}`)
      return { outcome: "updated" } as any
    })

    await GET(request())

    expect(order).toEqual([
      "start:r-1",
      "end:r-1",
      "start:r-2",
      "end:r-2",
    ])
  })

  it("checks operational alert thresholds after sweeping", async () => {
    const { client } = adminWithReports([])

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(monitorDangerModerationOperations).toHaveBeenCalledWith(client)
  })
})
