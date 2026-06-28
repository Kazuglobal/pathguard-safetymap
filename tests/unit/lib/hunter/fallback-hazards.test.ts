import { describe, expect, it } from "vitest"

import type { HunterHazard } from "@/lib/hunter/types"
import {
  GENERIC_HUNTER_HAZARDS,
  resolveExploreTargets,
} from "@/lib/hunter/fallback-hazards"

function hazard(overrides: Partial<HunterHazard> = {}): HunterHazard {
  return {
    id: "det-0-0",
    type: "車のかげ",
    region: { x: 0.1, y: 0.1, w: 0.2, h: 0.2 },
    severity: "medium",
    kidExplanation: "ここに気をつけよう",
    safeAction: "とまってかくにんしよう",
    confidence: 0.8,
    ...overrides,
  }
}

describe("GENERIC_HUNTER_HAZARDS", () => {
  it("contains 3 to 4 generic hazards", () => {
    expect(GENERIC_HUNTER_HAZARDS.length).toBeGreaterThanOrEqual(3)
    expect(GENERIC_HUNTER_HAZARDS.length).toBeLessThanOrEqual(4)
  })

  it("has unique ids of the form generic-N", () => {
    const ids = GENERIC_HUNTER_HAZARDS.map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
    ids.forEach((id, index) => {
      expect(id).toBe(`generic-${index}`)
    })
  })

  it("keeps every region within the 0..1 unit square", () => {
    for (const { region } of GENERIC_HUNTER_HAZARDS) {
      expect(region.x).toBeGreaterThanOrEqual(0)
      expect(region.y).toBeGreaterThanOrEqual(0)
      expect(region.w).toBeGreaterThan(0)
      expect(region.h).toBeGreaterThan(0)
      expect(region.x).toBeLessThanOrEqual(1)
      expect(region.y).toBeLessThanOrEqual(1)
      expect(region.x + region.w).toBeLessThanOrEqual(1)
      expect(region.y + region.h).toBeLessThanOrEqual(1)
    }
  })

  it("uses non-overlapping regions", () => {
    const regions = GENERIC_HUNTER_HAZARDS.map((h) => h.region)
    for (let i = 0; i < regions.length; i += 1) {
      for (let j = i + 1; j < regions.length; j += 1) {
        const a = regions[i]
        const b = regions[j]
        const overlapsX = a.x < b.x + b.w && b.x < a.x + a.w
        const overlapsY = a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlapsX && overlapsY).toBe(false)
      }
    }
  })

  it("provides kid-friendly copy and a moderate confidence", () => {
    for (const h of GENERIC_HUNTER_HAZARDS) {
      expect(h.kidExplanation.length).toBeGreaterThan(0)
      expect(h.safeAction.length).toBeGreaterThan(0)
      expect(h.confidence).toBeGreaterThan(0)
      expect(h.confidence).toBeLessThan(1)
    }
  })
})

describe("resolveExploreTargets", () => {
  it("returns the generic fallback when no hazards were detected", () => {
    expect(resolveExploreTargets([])).toBe(GENERIC_HUNTER_HAZARDS)
  })

  it("returns the detected hazards unchanged when present", () => {
    const detected = [hazard({ id: "det-0-0" }), hazard({ id: "det-0-1" })]
    const result = resolveExploreTargets(detected)
    expect(result).toBe(detected)
    expect(result).toEqual(detected)
  })
})
