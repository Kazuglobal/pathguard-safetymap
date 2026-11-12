import { describe, expect, it } from "vitest"

import { effectiveCoverage, MAX_HIT_COVERAGE } from "@/lib/hunter/hit-zone"
import {
  answerSafeReason,
  INITIAL_SAFE_ROUND,
  summarizeSafeRound,
  tapSafeRound,
  type SafeRoundState,
} from "@/lib/hunter/safe-round"
import { MAX_SAFE_POINTS, sanitizeSafePoints } from "@/lib/hunter/sanitize"
import type { HunterSafePoint } from "@/lib/hunter/types"

function point(id: string, x: number, y: number, extra: Partial<HunterSafePoint> = {}): HunterSafePoint {
  const region = { x, y, w: 0.12, h: 0.12 }
  return { id, type: "t", region, hitRegion: region, focusPoint: { x: x + 0.06, y: y + 0.06 }, whyGood: "w", safeKind: "guardrail", ...extra }
}

const G = point("g", 0.1, 0.1)
const M = point("m", 0.7, 0.7, { safeKind: "curve_mirror" })
const O = point("o", 0.1, 0.7, { safeKind: "other" })
const POINTS = [G, M, O]
const onG = { x: 0.16, y: 0.16 }
const onM = { x: 0.76, y: 0.76 }
const onO = { x: 0.16, y: 0.76 }
const nowhere = { x: 0.5, y: 0.45 }

function tap(state: SafeRoundState, t: { x: number; y: number }, at: number) {
  return tapSafeRound(state, t, at, POINTS)
}

describe("safe round", () => {
  it("asks 「どうして あんしん？」 after a hit and only counts 'understood' with the right reason", () => {
    const s1 = tap(INITIAL_SAFE_ROUND, onG, 1000)
    expect(s1.pendingId).toBe("g")
    expect(tap(s1, onM, 5000)).toBe(s1) // 答え待ちの間はタップを受け付けない
    const right = answerSafeReason(s1, "guardrail", POINTS)
    expect(summarizeSafeRound(right, POINTS).understoodIds).toEqual(["g"])
    const wrong = answerSafeReason(s1, "street_light", POINTS)
    expect(summarizeSafeRound(wrong, POINTS)).toMatchObject({ foundIds: ["g"], understoodIds: [] })
    expect(wrong.lastReason).toEqual({ pointId: "g", reason: "street_light", correct: false })
    expect(wrong.lastOutcome).toBe(s1.lastOutcome)
  })

  it("does not ask for an unknown kind (other)", () => {
    const s = tap(INITIAL_SAFE_ROUND, onO, 1000)
    expect(s.pendingId).toBeNull()
    expect(summarizeSafeRound(s, POINTS).understoodIds).toEqual(["o"])
  })

  it("spends a magnifier on a miss and stops accepting taps when they run out", () => {
    let s = INITIAL_SAFE_ROUND
    for (let i = 0; i < 6; i += 1) s = tap(s, nowhere, 1000 + i * 2000)
    expect(summarizeSafeRound(s, POINTS)).toMatchObject({ budget: 6, magnifiersLeft: 0, outOfMagnifiers: true })
    expect(tap(s, onG, 60_000)).toBe(s)
  })

  it("keeps already-found taps free, debounces rapid taps and marks rapid misses as not deliberate", () => {
    const s1 = tap(INITIAL_SAFE_ROUND, onO, 1000)
    const s2 = tap(s1, onO, 3000)
    expect(s2.lastOutcome).toMatchObject({ alreadyFound: true })
    expect(s2.misses).toBe(0)
    expect(tap(s2, nowhere, 3100)).toBe(s2)
    const s3 = tap(s2, nowhere, 3500)
    expect(s3.lastOutcome?.deliberate).toBe(false)
    const s4 = tap(s3, nowhere, 6000)
    expect(s4.lastOutcome?.deliberate).toBe(true)
  })

  it("a 200-tap spam run cannot find everything", () => {
    let seed = 7
    const r = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    let s = INITIAL_SAFE_ROUND
    for (let i = 0; i < 200; i += 1) {
      s = tap(s, { x: r(), y: r() }, 1000 + i * 400)
      if (s.pendingId) s = answerSafeReason(s, "traffic_signal", POINTS) // 理由も適当に選ぶ
    }
    const summary = summarizeSafeRound(s, POINTS)
    expect(summary.outOfMagnifiers || summary.allFound).toBe(true)
    // 理由を適当に選ぶと、理由を問う工夫は「わかった」にならない
    expect(summary.understoodIds.filter((id) => id !== "o")).toEqual([])
    expect(summary.accuracy).toBeLessThan(100)
  })

  it("never mutates the previous state", () => {
    const s1 = Object.freeze(tap(INITIAL_SAFE_ROUND, onG, 1000))
    const s2 = answerSafeReason(s1, "guardrail", POINTS)
    expect(s1.discoveries).toEqual([{ hazardId: "g", understood: false }])
    expect(s2).not.toBe(s1)
  })
})

describe("sanitizeSafePoints hit zones", () => {
  it("gives every safe point a focus-centered hit zone and keeps the union under the cap", () => {
    const raw = [
      { kidType: "歩道", region: { x: 0, y: 0.4, w: 0.6, h: 0.6 }, whyGood: "あるける。" }, // 0.36(旧: ほぼ当たり)
      { kidType: "ガードレール", region: { x: 0, y: 0.75, w: 1, h: 0.25 }, focus: { x: 0.8, y: 0.85 }, whyGood: "まもる。" },
      { kidType: "カーブミラー", region: { x: 0.7, y: 0.05, w: 0.2, h: 0.3 }, whyGood: "みえる。" },
    ]
    const points = sanitizeSafePoints(raw, { sessionId: "s" })
    expect(points).toHaveLength(Math.min(MAX_SAFE_POINTS, raw.length))
    // 表示枠のままなら写真の大半が当たりになる
    expect(effectiveCoverage(points.map((p) => p.region))).toBeGreaterThan(0.5)
    expect(effectiveCoverage(points.map((p) => p.hitRegion!))).toBeLessThanOrEqual(MAX_HIT_COVERAGE + 1e-9)
    expect(points.map((p) => p.safeKind)).toEqual(["sidewalk", "guardrail", "curve_mirror"])
    const rail = points[1]
    expect(rail.hitRegion!.x).toBeLessThanOrEqual(0.8)
    expect(rail.hitRegion!.x + rail.hitRegion!.w).toBeGreaterThanOrEqual(0.8)
  })
})
