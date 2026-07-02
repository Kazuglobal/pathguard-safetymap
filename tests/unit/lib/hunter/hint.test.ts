import { describe, expect, it } from "vitest"

import { HINT_THRESHOLDS, computeHintLevel, selectHintTarget } from "@/lib/hunter/hint"
import type { HunterHazard, HunterRegion } from "@/lib/hunter/types"

function makeHazard(id: string, region: HunterRegion): HunterHazard {
  return {
    id,
    type: `type-${id}`,
    region,
    severity: "high",
    kidExplanation: "x",
    safeAction: "y",
    confidence: 0.8,
  }
}

const A = makeHazard("A", { x: 0.1, y: 0.1, w: 0.2, h: 0.2 }) // 中心(0.2,0.2)
const B = makeHazard("B", { x: 0.6, y: 0.6, w: 0.2, h: 0.2 }) // 中心(0.7,0.7)
const hazards = [A, B]

describe("HINT_THRESHOLDS", () => {
  it("has the expected staged thresholds", () => {
    expect(HINT_THRESHOLDS).toEqual({
      lv1Miss: 2,
      lv1Ms: 8000,
      lv2Miss: 4,
      lv2Ms: 16000,
      lv3Miss: 6,
      lv3Ms: 26000,
    })
  })
})

describe("computeHintLevel", () => {
  it("returns 0 below all thresholds", () => {
    expect(computeHintLevel(0, 0, 5)).toBe(0)
    expect(computeHintLevel(1, 7999, 5)).toBe(0)
  })

  it("returns 1 at the Lv1 boundary (missStreak or idle)", () => {
    expect(computeHintLevel(2, 0, 5)).toBe(1)
    expect(computeHintLevel(0, 8000, 5)).toBe(1)
  })

  it("returns 2 at the Lv2 boundary", () => {
    expect(computeHintLevel(4, 0, 5)).toBe(2)
    expect(computeHintLevel(0, 16000, 5)).toBe(2)
    expect(computeHintLevel(3, 15999, 5)).toBe(1)
  })

  it("returns 3 at the Lv3 boundary", () => {
    expect(computeHintLevel(6, 0, 5)).toBe(3)
    expect(computeHintLevel(0, 26000, 5)).toBe(3)
  })

  it("escalates to Lv3 earlier when only one hazard remains", () => {
    expect(computeHintLevel(4, 0, 1)).toBe(3) // remaining<=1 + Lv2 threshold
    expect(computeHintLevel(4, 0, 2)).toBe(2) // not last → stays Lv2
    expect(computeHintLevel(0, 16000, 1)).toBe(3)
    expect(computeHintLevel(2, 0, 1)).toBe(1) // below Lv2 even when last
  })
})

describe("selectHintTarget", () => {
  const none: ReadonlySet<string> = new Set<string>()

  it("returns null when every hazard is found", () => {
    expect(selectHintTarget(null, hazards, new Set(["A", "B"]))).toBeNull()
    expect(selectHintTarget({ x: 0.2, y: 0.2 }, hazards, new Set(["A", "B"]))).toBeNull()
  })

  it("returns the nearest unfound hazard to the last tap", () => {
    const target = selectHintTarget({ x: 0.68, y: 0.68 }, hazards, none)
    expect(target?.id).toBe("B")
  })

  it("returns the first unfound hazard when there is no last tap", () => {
    const target = selectHintTarget(null, hazards, none)
    expect(target?.id).toBe("A")
  })

  it("excludes already-found hazards from selection", () => {
    const target = selectHintTarget({ x: 0.2, y: 0.2 }, hazards, new Set(["A"]))
    expect(target?.id).toBe("B")
  })
})
