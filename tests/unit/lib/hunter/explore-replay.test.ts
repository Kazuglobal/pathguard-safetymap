import { describe, expect, it } from "vitest"

import {
  discoveryAccuracy,
  HUNTER_RULES_VERSION,
  LOCATION_SHARE,
  MAGNIFIER_EXTRA,
  magnifierBudget,
  REASON_POINTS,
  replayExplore,
  scoreExploreSession,
} from "@/lib/hunter/explore-replay"
import { scoreSession, SEVERITY_POINTS } from "@/lib/hunter/scoring"
import type { HunterHazard, HunterTap } from "@/lib/hunter/types"

function hazard(id: string, x: number, y: number, extra: Partial<HunterHazard> = {}): HunterHazard {
  const region = { x, y, w: 0.12, h: 0.12 }
  return {
    id,
    type: "t",
    region,
    hitRegion: region,
    focusPoint: { x: x + 0.06, y: y + 0.06 },
    severity: "high",
    kidExplanation: "x",
    safeAction: "y",
    confidence: 0.8,
    kind: "blind_corner",
    ...extra,
  }
}

const A = hazard("A", 0.1, 0.1)
const B = hazard("B", 0.7, 0.7, { kind: "turning_car", severity: "medium" })
const C = hazard("C", 0.1, 0.7, { kind: "other", severity: "low" })
const HAZARDS = [A, B, C]

const onA: HunterTap = { x: 0.16, y: 0.16 }
const onB: HunterTap = { x: 0.76, y: 0.76 }
const onC: HunterTap = { x: 0.16, y: 0.76 }
const nowhere: HunterTap = { x: 0.5, y: 0.45 }

describe("magnifierBudget", () => {
  it("gives hazards + 3", () => {
    expect(MAGNIFIER_EXTRA).toBe(3)
    expect(magnifierBudget(3)).toBe(6)
    expect(magnifierBudget(0)).toBe(3)
  })
})

describe("replayExplore (rules v2)", () => {
  it("hit + correct reason: location points with combo + reason points, full credit, no magnifier used", () => {
    const r = replayExplore([{ ...onA, reason: "blind_corner" }], HAZARDS)
    expect(r.outcomes[0]).toMatchObject({ result: "hit", hazardId: "A", reasonCorrect: true })
    expect(r.score).toBe(SEVERITY_POINTS.high + REASON_POINTS.high)
    expect(r).toMatchObject({ matches: 1, understood: 1, misses: 0 })
    expect(r.discoveries).toEqual([{ hazardId: "A", understood: true }])
  })

  it("hit + wrong or missing reason: location points only, partial credit", () => {
    const wrong = replayExplore([{ ...onA, reason: "flood_dip" }], HAZARDS)
    const missing = replayExplore([onA], HAZARDS)
    for (const r of [wrong, missing]) {
      expect(r.score).toBe(SEVERITY_POINTS.high)
      expect(r).toMatchObject({ matches: 1, understood: 0, misses: 0 })
      expect(r.outcomes[0].reasonCorrect).toBe(false)
    }
    expect(wrong.accuracy).toBe(Math.round((LOCATION_SHARE / 3) * 100))
  })

  it("hit on a hazard whose kind cannot be asked (other): full credit automatically", () => {
    const r = replayExplore([onC], HAZARDS)
    expect(r.outcomes[0]).toMatchObject({ result: "hit", reasonCorrect: true })
    expect(r.score).toBe(SEVERITY_POINTS.low + REASON_POINTS.low)
    expect(r.understood).toBe(1)
  })

  it("combo multiplies the location points only", () => {
    const r = replayExplore([{ ...onA, reason: "blind_corner" }, { ...onB, reason: "turning_car" }], HAZARDS)
    expect(r.comboMax).toBe(2)
    expect(r.score).toBe(
      SEVERITY_POINTS.high + REASON_POINTS.high + Math.round(SEVERITY_POINTS.medium * 1.1) + REASON_POINTS.medium,
    )
  })

  it("near/miss uses a magnifier and resets the combo", () => {
    const r = replayExplore([onA, nowhere, onB], HAZARDS)
    expect(r.misses).toBe(1)
    expect(r.comboMax).toBe(1)
    expect(r.outcomes[1].result).not.toBe("hit")
  })

  it("tapping an already-found zone is free and keeps the combo", () => {
    const r = replayExplore([onA, onA, onB], HAZARDS)
    expect(r.outcomes[1]).toMatchObject({ alreadyFound: true })
    expect(r.misses).toBe(0)
    expect(r.comboMax).toBe(2)
  })

  it("stops counting when the magnifiers run out", () => {
    const misses = Array.from({ length: magnifierBudget(3) }, () => nowhere)
    const r = replayExplore([...misses, onA, onB], HAZARDS)
    expect(r.misses).toBe(6)
    expect(r.matches).toBe(0)
    expect(r.ignoredTaps).toBe(2)
    expect(r.outcomes).toHaveLength(8)
    expect(r.outcomes[7]).toMatchObject({ ignored: true, points: 0 })
  })

  it("ignores taps after everything is found", () => {
    const r = replayExplore([onA, onB, onC, nowhere, nowhere], HAZARDS)
    expect(r.matches).toBe(3)
    expect(r.misses).toBe(0)
    expect(r.ignoredTaps).toBe(2)
  })

  it("a 200-tap spam run cannot find everything and ends with ignored taps", () => {
    let seed = 99
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }
    const spam = Array.from({ length: 200 }, () => ({ x: next(), y: next() }))
    const r = replayExplore(spam, HAZARDS)
    expect(r.misses).toBe(magnifierBudget(3))
    expect(r.ignoredTaps).toBeGreaterThan(150)
    // 理由を答えていないので、「わかった」になるのは理由を問わない C(other)だけ
    expect(r.understood).toBe(r.discoveries.filter((d) => d.hazardId === "C").length)
    expect(r.accuracy).toBeLessThan(100)
  })

  it("does not mutate its inputs", () => {
    const taps = Object.freeze([Object.freeze({ ...onA }), Object.freeze({ ...nowhere })])
    const hazards = Object.freeze([...HAZARDS])
    expect(() => replayExplore(taps, hazards)).not.toThrow()
  })
})

describe("discoveryAccuracy", () => {
  it("weights understood 1.0 and location-only LOCATION_SHARE", () => {
    expect(discoveryAccuracy(3, 3, 3)).toBe(100)
    expect(discoveryAccuracy(3, 0, 3)).toBe(60)
    expect(discoveryAccuracy(2, 1, 4)).toBe(40)
    expect(discoveryAccuracy(0, 0, 0)).toBe(0)
    // 壊れた入力でも 0..100 と「わかった ≤ みつけた」を守る
    expect(discoveryAccuracy(1, 5, 2)).toBe(50)
    expect(discoveryAccuracy(9, 9, 2)).toBe(100)
  })
})

describe("scoreExploreSession", () => {
  it("uses v2 only for rules 2", () => {
    const taps = [{ ...onA, reason: "blind_corner" as const }, nowhere, onB]
    const v2 = scoreExploreSession(taps, HAZARDS, HUNTER_RULES_VERSION)
    expect(v2.rules).toBe(2)
    expect(v2.budget).toBe(6)
    expect(v2.understood).toBe(1)
  })

  it("keeps the legacy scoring unchanged for keys without a rules version", () => {
    const taps = [onA, nowhere, onB]
    const legacy = scoreExploreSession(taps, HAZARDS, undefined)
    const old = scoreSession(taps, HAZARDS)
    expect(legacy).toMatchObject({ rules: 1, score: old.score, matches: old.matches, comboMax: old.comboMax })
    expect(legacy.understood).toBe(old.matches)
    expect(legacy.accuracy).toBe(67)
    expect(legacy.budget).toBe(0)
    expect(legacy.discoveries).toEqual([
      { hazardId: "A", understood: true },
      { hazardId: "B", understood: true },
    ])
  })
})
