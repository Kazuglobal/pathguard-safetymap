import { describe, expect, it } from "vitest"

import {
  anchorOf,
  clampFocus,
  deriveHitRegion,
  effectiveCoverage,
  fitHitZones,
  hitZoneOf,
  MAX_HIT_AREA,
  MAX_HIT_COVERAGE,
  MIN_HIT_SIDE,
  SAFE_HIT_PROFILE,
} from "@/lib/hunter/hit-zone"
import { judgeTap } from "@/lib/hunter/scoring"
import { MAX_AREA, MAX_HAZARDS } from "@/lib/hunter/sanitize"
import { SPATIAL_TAP_MARGIN } from "@/lib/hunter/spatial-hit"
import type { HunterHazard, HunterRegion } from "@/lib/hunter/types"

const EPS = 1e-9

/** 種を固定した乱数(mulberry32)。 */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** sanitize を通った後に来うる表示枠(辺 0.12 以上・面積 MAX_AREA 以下)。 */
function randomRegion(r: () => number): HunterRegion {
  const w = 0.12 + r() * 0.6
  const h = Math.max(0.12, Math.min(0.9, (0.004 + r() * (MAX_AREA - 0.004)) / w))
  return { x: r() * (1 - w), y: r() * (1 - h), w, h }
}

function inside(inner: HunterRegion, outer: HunterRegion): boolean {
  return (
    inner.x >= outer.x - EPS &&
    inner.y >= outer.y - EPS &&
    inner.x + inner.w <= outer.x + outer.w + EPS &&
    inner.y + inner.h <= outer.y + outer.h + EPS
  )
}

function contains(region: HunterRegion, p: { x: number; y: number }): boolean {
  return (
    p.x >= region.x - EPS && p.x <= region.x + region.w + EPS && p.y >= region.y - EPS && p.y <= region.y + region.h + EPS
  )
}

function hazard(id: string, region: HunterRegion, extra: Partial<HunterHazard> = {}): HunterHazard {
  return { id, type: "t", region, severity: "high", kidExplanation: "x", safeAction: "y", confidence: 0.8, ...extra }
}

describe("hit-zone constants", () => {
  it("guarantees the coverage cap is reachable without dropping hazards", () => {
    // 最小サイズの当たり枠が MAX_HAZARDS 個、離れて並んでも上限に収まる(= 縮めれば必ず収まる)。
    const minWithMargin = MIN_HIT_SIDE + 2 * SPATIAL_TAP_MARGIN
    expect(MAX_HAZARDS * minWithMargin * minWithMargin).toBeLessThanOrEqual(MAX_HIT_COVERAGE)
    expect(MIN_HIT_SIDE * MIN_HIT_SIDE).toBeLessThanOrEqual(MAX_HIT_AREA)
  })
})

describe("deriveHitRegion", () => {
  it("keeps a small display box as the hit box", () => {
    const region = { x: 0.4, y: 0.5, w: 0.2, h: 0.2 }
    const zone = deriveHitRegion(region)
    expect(zone.hitRegion).toEqual(region)
    expect(zone.focusPoint).toEqual({ x: 0.5, y: 0.6 })
  })

  it("shrinks a big box around the focus, inside the box, with finger-sized sides", () => {
    const region = { x: 0.1, y: 0.1, w: 0.47, h: 0.47 } // 面積 0.22(旧ルールではこの全部が当たり)
    const zone = deriveHitRegion(region, { x: 0.15, y: 0.5 })
    const r = zone.hitRegion
    expect(r.w * r.h).toBeLessThanOrEqual(MAX_HIT_AREA + EPS)
    expect(r.w).toBeGreaterThanOrEqual(MIN_HIT_SIDE - EPS)
    expect(r.h).toBeGreaterThanOrEqual(MIN_HIT_SIDE - EPS)
    expect(inside(r, region)).toBe(true)
    expect(contains(r, zone.focusPoint)).toBe(true)
  })

  it("handles a long thin box (sidewalk) without exceeding the area cap", () => {
    const region = { x: 0.05, y: 0.05, w: 0.15, h: 0.9 }
    const r = deriveHitRegion(region, { x: 0.12, y: 0.8 }).hitRegion
    expect(r.w * r.h).toBeLessThanOrEqual(MAX_HIT_AREA + EPS)
    expect(r.w).toBeGreaterThanOrEqual(MIN_HIT_SIDE - EPS)
    expect(inside(r, region)).toBe(true)
    expect(contains(r, { x: 0.12, y: 0.8 })).toBe(true)
  })

  it("pulls a focus that is outside the box back inside", () => {
    const region = { x: 0.2, y: 0.2, w: 0.3, h: 0.3 }
    expect(clampFocus(region, { x: 0.9, y: 0.05 })).toEqual({ x: 0.5, y: 0.2 })
    expect(clampFocus(region, null)).toEqual({ x: 0.35, y: 0.35 })
    expect(clampFocus(region, { x: Number.NaN, y: 0.3 })).toEqual({ x: 0.35, y: 0.35 })
  })
})

describe("effectiveCoverage", () => {
  it("measures one box with the finger margin, clipped to the photo", () => {
    expect(effectiveCoverage([{ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }], 0)).toBeCloseTo(0.04, 10)
    expect(effectiveCoverage([{ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }], 0.05)).toBeCloseTo(0.09, 10)
    // 左上の角は写真の外にはみ出たぶんを数えない
    expect(effectiveCoverage([{ x: 0, y: 0, w: 0.2, h: 0.2 }], 0.05)).toBeCloseTo(0.0625, 10)
  })

  it("counts overlap only once", () => {
    const a = { x: 0, y: 0, w: 0.5, h: 0.5 }
    expect(effectiveCoverage([a, a], 0)).toBeCloseTo(0.25, 10)
    expect(effectiveCoverage([a, { x: 0.25, y: 0, w: 0.5, h: 0.5 }], 0)).toBeCloseTo(0.375, 10)
    expect(effectiveCoverage([], 0)).toBe(0)
  })
})

describe("fitHitZones", () => {
  it("brings the worst case (5 big boxes spread over the photo) under the cap", () => {
    const regions: HunterRegion[] = [
      { x: 0, y: 0, w: 0.47, h: 0.47 },
      { x: 0.53, y: 0, w: 0.47, h: 0.47 },
      { x: 0, y: 0.53, w: 0.47, h: 0.47 },
      { x: 0.53, y: 0.53, w: 0.47, h: 0.47 },
      { x: 0.3, y: 0.3, w: 0.4, h: 0.4 },
    ]
    // 旧ルール(表示枠そのまま + 指先補正)では写真の大半が当たりだった
    expect(effectiveCoverage(regions)).toBeGreaterThan(0.85)
    const zones = fitHitZones(regions.map((region) => ({ region })))
    expect(zones).toHaveLength(5)
    expect(effectiveCoverage(zones.map((z) => z.hitRegion))).toBeLessThanOrEqual(MAX_HIT_COVERAGE + EPS)
  })

  it("holds the invariants on 500 seeded random photos", () => {
    const r = rng(20261107)
    for (let photo = 0; photo < 500; photo += 1) {
      const count = 1 + Math.floor(r() * MAX_HAZARDS)
      const inputs = Array.from({ length: count }, () => {
        const region = randomRegion(r)
        const focus = r() < 0.8 ? { x: r(), y: r() } : null
        return { region, focus }
      })
      const zones = fitHitZones(inputs)
      expect(zones).toHaveLength(count)
      expect(effectiveCoverage(zones.map((z) => z.hitRegion))).toBeLessThanOrEqual(MAX_HIT_COVERAGE + EPS)
      zones.forEach((zone, i) => {
        expect(inside(zone.hitRegion, inputs[i].region)).toBe(true)
        expect(contains(zone.hitRegion, zone.focusPoint)).toBe(true)
        expect(zone.hitRegion.w * zone.hitRegion.h).toBeLessThanOrEqual(MAX_HIT_AREA + EPS)
      })
      // 同じ入力なら同じ出力
      expect(fitHitZones(inputs)).toEqual(zones)
    }
  })

  it("keeps a random tap's chance of hitting anything at or under 25% (Monte Carlo through judgeTap)", () => {
    const r = rng(7)
    let taps = 0
    let hits = 0
    for (let photo = 0; photo < 200; photo += 1) {
      const count = 1 + Math.floor(r() * MAX_HAZARDS)
      const regions = Array.from({ length: count }, () => randomRegion(r))
      const zones = fitHitZones(regions.map((region) => ({ region, focus: { x: r(), y: r() } })))
      const hazards = regions.map((region, i) =>
        hazard(`p${photo}-${i}`, region, { hitRegion: zones[i].hitRegion, focusPoint: zones[i].focusPoint }),
      )
      for (let t = 0; t < 200; t += 1) {
        taps += 1
        if (judgeTap({ x: r(), y: r() }, hazards, new Set()).result === "hit") hits += 1
      }
    }
    expect(hits / taps).toBeLessThanOrEqual(MAX_HIT_COVERAGE)
  })
})

describe("SAFE_HIT_PROFILE (安全の工夫は物: 細長い物は帯)", () => {
  it("keeps the full length of a long guardrail and thins only the short side", () => {
    const rail = deriveHitRegion({ x: 0, y: 0.7, w: 1, h: 0.2 }, { x: 0.2, y: 0.8 }, SAFE_HIT_PROFILE).hitRegion
    expect(rail.x).toBeCloseTo(0, 10)
    expect(rail.w).toBeCloseTo(1, 10)
    expect(rail.h).toBeCloseTo(0.16, 10)
    // 縦長(電柱ぞいの歩道など)も同じ
    const tall = deriveHitRegion({ x: 0.4, y: 0, w: 0.15, h: 0.9 }, null, SAFE_HIT_PROFILE).hitRegion
    expect(tall.h).toBeCloseTo(0.9, 10)
    expect(tall.w).toBeCloseTo(0.15, 10)
    // 危険の当たり枠は今までどおり focus のまわりだけ
    const danger = deriveHitRegion({ x: 0, y: 0.7, w: 1, h: 0.2 }, { x: 0.2, y: 0.8 }).hitRegion
    expect(danger.w * danger.h).toBeLessThanOrEqual(MAX_HIT_AREA + EPS)
  })

  it("shrinks square-ish objects to the safe area cap", () => {
    const walk = deriveHitRegion({ x: 0, y: 0.4, w: 0.6, h: 0.6 }, { x: 0.3, y: 0.7 }, SAFE_HIT_PROFILE).hitRegion
    expect(walk.w * walk.h).toBeLessThanOrEqual(SAFE_HIT_PROFILE.maxArea + EPS)
  })

  it("still keeps the union under the cap and inside each box on 500 seeded random photos", () => {
    const r = rng(1107)
    for (let photo = 0; photo < 500; photo += 1) {
      const count = 1 + Math.floor(r() * 3)
      const inputs = Array.from({ length: count }, () => {
        const long = r() < 0.5
        const w = long ? 0.5 + r() * 0.5 : 0.12 + r() * 0.5
        const h = long ? 0.12 + r() * 0.12 : 0.12 + r() * 0.5
        return { region: { x: r() * (1 - w), y: r() * (1 - h), w, h }, focus: { x: r(), y: r() } }
      })
      const zones = fitHitZones(inputs, SAFE_HIT_PROFILE)
      expect(effectiveCoverage(zones.map((z) => z.hitRegion))).toBeLessThanOrEqual(MAX_HIT_COVERAGE + EPS)
      zones.forEach((zone, i) => {
        expect(inside(zone.hitRegion, inputs[i].region)).toBe(true)
        expect(contains(zone.hitRegion, zone.focusPoint)).toBe(true)
      })
    }
  })
})

describe("hitZoneOf / anchorOf", () => {
  it("falls back to the display box and its center for legacy hazards", () => {
    const legacy = hazard("a", { x: 0.2, y: 0.2, w: 0.4, h: 0.2 })
    expect(hitZoneOf(legacy)).toEqual(legacy.region)
    const a = anchorOf(legacy)
    expect(a.x).toBeCloseTo(0.4, 10)
    expect(a.y).toBeCloseTo(0.3, 10)
  })

  it("prefers the hit box and the focus point", () => {
    const h = hazard("a", { x: 0, y: 0, w: 0.5, h: 0.5 }, {
      hitRegion: { x: 0.1, y: 0.1, w: 0.12, h: 0.12 },
      focusPoint: { x: 0.15, y: 0.15 },
    })
    expect(hitZoneOf(h)).toEqual({ x: 0.1, y: 0.1, w: 0.12, h: 0.12 })
    expect(anchorOf(h)).toEqual({ x: 0.15, y: 0.15 })
  })
})
