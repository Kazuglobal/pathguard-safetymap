import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/danger-report-moderation-ai", () => ({
  moderateDangerReportWithAi: vi.fn(),
}))

vi.mock("@/lib/danger-report-moderation-images", () => ({
  collectDangerReportImageDataUrls: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/web-push", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(1),
}))

import { moderateDangerReportWithAi } from "@/lib/danger-report-moderation-ai"
import {
  moderateDangerReportRecord,
  type DangerReportModerationMode,
} from "@/lib/danger-report-moderation-service"

const report = {
  id: "report-1",
  user_id: "user-1",
  title: "見通しの悪い交差点",
  description: "左右が見えません",
  danger_type: "traffic",
  danger_level: 3,
  latitude: 35.68,
  longitude: 139.76,
  geocode_confidence: 0.9,
  prefecture: "東京都",
  city: "千代田区",
  image_url: null,
  processed_image_urls: [],
  status: "pending",
  ai_moderation_status: "pending",
}

function builder(
  result: { data?: unknown; error?: unknown; count?: number | null },
) {
  const calls: Array<[string, ...unknown[]]> = []
  const value = {
    calls,
    select(...args: unknown[]) {
      calls.push(["select", ...args])
      return this
    },
    eq(...args: unknown[]) {
      calls.push(["eq", ...args])
      return this
    },
    neq(...args: unknown[]) {
      calls.push(["neq", ...args])
      return this
    },
    gte(...args: unknown[]) {
      calls.push(["gte", ...args])
      return this
    },
    or(...args: unknown[]) {
      calls.push(["or", ...args])
      return this
    },
    is(...args: unknown[]) {
      calls.push(["is", ...args])
      return this
    },
    update(...args: unknown[]) {
      calls.push(["update", ...args])
      return this
    },
    insert(...args: unknown[]) {
      calls.push(["insert", ...args])
      return this
    },
    maybeSingle() {
      calls.push(["maybeSingle"])
      return Promise.resolve(result)
    },
    then(resolve: (value: unknown) => unknown) {
      return Promise.resolve(result).then(resolve)
    },
  }
  return value
}

function adminFor(mode: DangerReportModerationMode) {
  const recent = builder({ data: null, count: 1, error: null })
  const nearby = builder({ data: [], error: null })
  const rejected = builder({ data: null, count: 0, error: null })
  const log = builder({ data: null, error: null })
  const update = builder({
    data: mode === "live" ? { ...report, status: "approved" } : null,
    error: null,
  })
  const queue = [recent, nearby, rejected, log, update]
  const from = vi.fn(() => queue.shift())
  return {
    client: { from, storage: { from: vi.fn() } } as any,
    recent,
    nearby,
    rejected,
    log,
    update,
    from,
  }
}

describe("moderateDangerReportRecord", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(moderateDangerReportWithAi).mockResolvedValue({
      status: "approved",
      reason: "AI審査で公開可能と判定",
      score: 0.1,
      aiExecuted: true,
      heuristicStatus: "approved",
      aiVerdict: {
        verdict: "approve",
        risk: "low",
        confidence: 0.95,
        needs_human_review: false,
        categories: [],
        reason: "問題なし",
      },
      fallback: false,
      model: "gemini-test",
      promptVersion: "v1",
      latencyMs: 12,
    })
  })

  it("logs shadow decisions without updating danger_reports", async () => {
    const admin = adminFor("shadow")

    const result = await moderateDangerReportRecord({
      supabaseAdmin: admin.client,
      report,
      mode: "shadow",
      now: new Date("2026-07-18T00:00:00.000Z"),
    })

    expect(result.outcome).toBe("shadow")
    expect(admin.from).toHaveBeenCalledTimes(4)
    expect(admin.log.calls).toContainEqual([
      "insert",
      expect.objectContaining({ mode: "shadow", report_id: "report-1" }),
    ])
  })

  it("uses status and moderation guards for a live approval", async () => {
    const admin = adminFor("live")

    const result = await moderateDangerReportRecord({
      supabaseAdmin: admin.client,
      report,
      mode: "live",
      now: new Date("2026-07-18T00:00:00.000Z"),
    })

    expect(result.outcome).toBe("updated")
    expect(admin.update.calls).toContainEqual(["eq", "status", "pending"])
    expect(admin.update.calls).toContainEqual([
      "or",
      "ai_moderation_status.is.null,ai_moderation_status.eq.pending",
    ])
    expect(admin.update.calls).toContainEqual(["is", "image_url", null])
    expect(admin.update.calls).toContainEqual([
      "or",
      "processed_image_urls.is.null,processed_image_urls.eq.{}",
    ])
  })

  it("returns a conflict when the conditional update affects no row", async () => {
    const admin = adminFor("live")
    admin.update.maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    }) as any

    const result = await moderateDangerReportRecord({
      supabaseAdmin: admin.client,
      report,
      mode: "live",
      now: new Date("2026-07-18T00:00:00.000Z"),
    })

    expect(result.outcome).toBe("conflict")
  })
})
