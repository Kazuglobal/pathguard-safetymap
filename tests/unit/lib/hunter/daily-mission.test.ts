import { describe, expect, it } from "vitest"

import { pickDailyMission } from "@/lib/hunter/daily-mission"

describe("pickDailyMission", () => {
  it("rotates the recommended learning mode from day to day", () => {
    const available = ["explore", "quiz", "safe"] as const
    const first = pickDailyMission(new Date(2026, 6, 20), available)
    const next = pickDailyMission(new Date(2026, 6, 21), available)

    expect(first?.mode).not.toBe(next?.mode)
  })

  it("only recommends modes that are available for the analyzed photo", () => {
    const mission = pickDailyMission(new Date(2026, 6, 20), ["quiz", "safe"])
    expect(["quiz", "safe"]).toContain(mission?.mode)
  })

  it("returns short actionable content that completes the learning loop", () => {
    const mission = pickDailyMission(new Date(2026, 6, 20), ["explore"])
    expect(mission).toMatchObject({ mode: "explore", minutes: 3 })
    expect(mission?.title.length).toBeGreaterThan(0)
    expect(mission?.detail).toContain("どう動く")
  })

  it("returns null when this photo has no playable mode", () => {
    expect(pickDailyMission(new Date(2026, 6, 20), [])).toBeNull()
  })
})
