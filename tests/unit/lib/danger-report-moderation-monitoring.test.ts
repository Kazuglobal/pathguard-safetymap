import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/web-push", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(1),
}))

import {
  getDangerModerationAlertReasons,
  monitorDangerModerationOperations,
} from "@/lib/danger-report-moderation-monitoring"
import { sendPushToUser } from "@/lib/web-push"

function query(result: {
  data?: unknown
  error?: unknown
  count?: number | null
}) {
  const value = { data: null, error: null, count: null, ...result }
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    then<TResult1 = typeof value, TResult2 = never>(
      onfulfilled?:
        | ((value: typeof value) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null,
    ) {
      return Promise.resolve(value).then(onfulfilled, onrejected)
    },
  }
}

describe("getDangerModerationAlertReasons", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("alerts only when the 24-hour fallback rate is over 30 percent", () => {
    expect(
      getDangerModerationAlertReasons({
        totalLast24h: 10,
        fallbackLast24h: 3,
        pendingUnmoderated: 0,
      }),
    ).toEqual([])

    expect(
      getDangerModerationAlertReasons({
        totalLast24h: 10,
        fallbackLast24h: 4,
        pendingUnmoderated: 0,
      }),
    ).toEqual(["fallback_rate"])
  })

  it("alerts only when the unmoderated backlog is over 50 reports", () => {
    expect(
      getDangerModerationAlertReasons({
        totalLast24h: 0,
        fallbackLast24h: 0,
        pendingUnmoderated: 50,
      }),
    ).toEqual([])

    expect(
      getDangerModerationAlertReasons({
        totalLast24h: 0,
        fallbackLast24h: 0,
        pendingUnmoderated: 51,
      }),
    ).toEqual(["pending_backlog"])
  })

  it("reports both operational risks together", () => {
    expect(
      getDangerModerationAlertReasons({
        totalLast24h: 5,
        fallbackLast24h: 2,
        pendingUnmoderated: 60,
      }),
    ).toEqual(["fallback_rate", "pending_backlog"])
  })

  it("aggregates the operational metrics and notifies every admin", async () => {
    const total = query({ count: 10 })
    const fallback = query({ count: 4 })
    const pending = query({ count: 51 })
    const admins = query({
      data: [{ id: "admin-1" }, { id: "admin-2" }],
    })
    const queue = [total, fallback, pending, admins]
    const client = { from: vi.fn(() => queue.shift()) }

    const result = await monitorDangerModerationOperations(
      client,
      new Date("2026-07-18T12:00:00.000Z"),
    )

    expect(result).toMatchObject({
      alerted: true,
      adminCount: 2,
      metrics: {
        totalLast24h: 10,
        fallbackLast24h: 4,
        pendingUnmoderated: 51,
      },
      reasons: ["fallback_rate", "pending_backlog"],
    })
    expect(fallback.eq).toHaveBeenCalledWith("fallback", true)
    expect(pending.eq).toHaveBeenCalledWith("status", "pending")
    expect(pending.or).toHaveBeenCalledWith(
      "ai_moderation_status.is.null,ai_moderation_status.eq.pending",
    )
    expect(sendPushToUser).toHaveBeenCalledTimes(2)
    expect(sendPushToUser).toHaveBeenCalledWith(
      "admin-1",
      expect.objectContaining({
        tag: "danger-moderation-operational-alert",
      }),
      "danger_reports",
    )
  })
})
