import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}))

vi.mock("@/lib/danger-report-moderation-service", () => ({
  MAX_DANGER_MODERATION_FALLBACKS: 3,
  getDangerModerationMode: vi.fn(() => "live"),
  getDangerModerationFallbackCount: vi.fn().mockResolvedValue(0),
  markDangerReportModerationFailed: vi
    .fn()
    .mockResolvedValue({ id: "exhausted-report" }),
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
import { hasModerationSweepTimeRemaining } from "@/lib/danger-report-moderation-sweep"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import {
  getDangerModerationFallbackCount,
  getDangerModerationMode,
  markDangerReportModerationFailed,
  moderateDangerReportRecord,
} from "@/lib/danger-report-moderation-service"

function request(token = "test-cron-secret") {
  return new NextRequest("http://localhost/api/cron/moderation-sweep", {
    headers: { authorization: `Bearer ${token}` },
  })
}

function adminWithReports(reports: Array<Record<string, unknown>>) {
  const rpc = vi.fn().mockResolvedValue({ data: reports, error: null })
  const client = { rpc }
  vi.mocked(getSupabaseAdmin).mockReturnValue(client as any)
  return { client, rpc }
}

describe("GET /api/cron/moderation-sweep", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("CRON_SECRET", "test-cron-secret")
    vi.mocked(getDangerModerationMode).mockReturnValue("live")
    vi.mocked(getDangerModerationFallbackCount).mockResolvedValue(0)
    vi.mocked(markDangerReportModerationFailed).mockResolvedValue({
      id: "exhausted-report",
    } as any)
    vi.mocked(moderateDangerReportRecord).mockResolvedValue({
      outcome: "updated",
    } as any)
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

  it("reserves execution time for the current report and monitoring", () => {
    expect(hasModerationSweepTimeRemaining(1_000, 220_999)).toBe(true)
    expect(hasModerationSweepTimeRemaining(1_000, 221_000)).toBe(false)
  })

  it("asks the database for ten stale reports with the current prompt version", async () => {
    const { rpc } = adminWithReports([{ id: "r-1" }])

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(rpc).toHaveBeenCalledWith(
      "get_danger_reports_for_moderation_sweep",
      expect.objectContaining({
        p_mode: "live",
        p_prompt_version: "v2",
        p_limit: 10,
      }),
    )
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

  it("counts an exhausted transition race as a conflict", async () => {
    adminWithReports([{ id: "r-raced" }])
    vi.mocked(getDangerModerationFallbackCount).mockResolvedValueOnce(3)
    vi.mocked(markDangerReportModerationFailed).mockResolvedValueOnce(null)

    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({
      processed: 1,
      conflict: 1,
      exhausted: 0,
      failed: 0,
    })
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

  it("does not count fallbacks or write exhausted state in shadow mode", async () => {
    adminWithReports([{ id: "r-shadow" }])
    vi.mocked(getDangerModerationMode).mockReturnValue("shadow")
    vi.mocked(moderateDangerReportRecord).mockResolvedValueOnce({
      outcome: "shadow",
    } as any)

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(getDangerModerationFallbackCount).not.toHaveBeenCalled()
    expect(markDangerReportModerationFailed).not.toHaveBeenCalled()
    expect(body.shadow).toBe(1)
  })

  it("reports conflict and retry outcomes so processed totals reconcile", async () => {
    adminWithReports([
      { id: "r-updated" },
      { id: "r-conflict" },
      { id: "r-retry" },
    ])
    vi.mocked(moderateDangerReportRecord)
      .mockResolvedValueOnce({ outcome: "updated" } as any)
      .mockResolvedValueOnce({ outcome: "conflict" } as any)
      .mockResolvedValueOnce({ outcome: "retry" } as any)

    const response = await GET(request())
    const body = await response.json()

    expect(body).toMatchObject({
      processed: 3,
      updated: 1,
      conflict: 1,
      retry: 1,
      shadow: 0,
      exhausted: 0,
      failed: 0,
    })
  })

  it("checks operational alert thresholds after sweeping", async () => {
    const { client } = adminWithReports([])

    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(monitorDangerModerationOperations).toHaveBeenCalledWith(client)
  })
})
