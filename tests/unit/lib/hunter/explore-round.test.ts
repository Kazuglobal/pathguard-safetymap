import { describe, expect, it } from "vitest"

import {
  answerReason,
  canAcceptTap,
  INITIAL_EXPLORE_ROUND,
  summarizeRound,
  TAP_DEBOUNCE_MS,
  tapRound,
  type ExploreRoundState,
} from "@/lib/hunter/explore-round"
import { replayExplore } from "@/lib/hunter/explore-replay"
import { buildReasonChoices } from "@/lib/hunter/reason-choices"
import type { HunterHazard } from "@/lib/hunter/types"

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
const B = hazard("B", 0.7, 0.7, { kind: "other" })
const HAZARDS = [A, B]
const onA = { x: 0.16, y: 0.16 }
const onB = { x: 0.76, y: 0.76 }
const nowhere = { x: 0.5, y: 0.45 }

/** 間をあけてタップする(連打よけに当たらない)。 */
function tapAt(state: ExploreRoundState, tap: { x: number; y: number }, at: number) {
  return tapRound(state, tap, at, HAZARDS)
}

describe("tapRound", () => {
  it("asks for a reason after a hit and blocks taps until it is answered", () => {
    const s1 = tapAt(INITIAL_EXPLORE_ROUND, onA, 1000)
    expect(s1.pendingReasonHazardId).toBe("A")
    expect(s1.lastOutcome).toMatchObject({ result: "hit", hazardId: "A" })
    const blocked = tapAt(s1, onB, 5000)
    expect(blocked).toBe(s1)
    expect(canAcceptTap(s1, HAZARDS, 5000)).toBe(false)

    const s2 = answerReason(s1, "blind_corner", HAZARDS)
    expect(s2.pendingReasonHazardId).toBeNull()
    expect(s2.lastReason).toEqual({ hazardId: "A", reason: "blind_corner", correct: true })
    expect(s2.taps).toEqual([{ ...onA, reason: "blind_corner" }])
    // 理由を答えても lastOutcome は作り直さない(画面の効果を二重に動かさない)
    expect(s2.lastOutcome).toBe(s1.lastOutcome)
    expect(summarizeRound(s2, HAZARDS).understoodIds).toEqual(["A"])
  })

  it("does not ask for a reason on a hazard whose kind cannot be asked", () => {
    const s = tapAt(INITIAL_EXPLORE_ROUND, onB, 1000)
    expect(s.pendingReasonHazardId).toBeNull()
    expect(summarizeRound(s, HAZARDS).understoodIds).toEqual(["B"])
  })

  it("records a wrong reason honestly", () => {
    const s = answerReason(tapAt(INITIAL_EXPLORE_ROUND, onA, 1000), "flood_dip", HAZARDS)
    expect(s.lastReason).toMatchObject({ correct: false })
    expect(summarizeRound(s, HAZARDS)).toMatchObject({ foundIds: ["A"], understoodIds: [] })
  })

  it("ignores a second tap within the debounce window", () => {
    const s1 = tapAt(INITIAL_EXPLORE_ROUND, nowhere, 1000)
    expect(tapAt(s1, nowhere, 1000 + TAP_DEBOUNCE_MS - 1)).toBe(s1)
    expect(tapAt(s1, nowhere, 1000 + TAP_DEBOUNCE_MS).taps).toHaveLength(2)
  })

  it("marks rapid misses as not deliberate (they do not advance the hints)", () => {
    const s1 = tapAt(INITIAL_EXPLORE_ROUND, nowhere, 1000)
    expect(s1.lastOutcome?.deliberate).toBe(true)
    const s2 = tapAt(s1, nowhere, 1500)
    expect(s2.lastOutcome?.deliberate).toBe(false)
    const s3 = tapAt(s2, nowhere, 4000)
    expect(s3.lastOutcome?.deliberate).toBe(true)
  })

  it("does not send taps on an already-found zone", () => {
    const s1 = tapAt(INITIAL_EXPLORE_ROUND, onB, 1000)
    const s2 = tapAt(s1, onB, 3000)
    expect(s2.taps).toHaveLength(1)
    expect(s2.lastOutcome).toMatchObject({ alreadyFound: true })
    expect(summarizeRound(s2, HAZARDS).magnifiersLeft).toBe(5)
  })

  it("ends the round when the magnifiers run out", () => {
    let s = INITIAL_EXPLORE_ROUND
    for (let i = 0; i < 5; i += 1) s = tapAt(s, nowhere, 1000 + i * 2000)
    const summary = summarizeRound(s, HAZARDS)
    expect(summary).toMatchObject({ budget: 5, magnifiersLeft: 0, outOfMagnifiers: true, allFound: false })
    expect(tapAt(s, onA, 60_000)).toBe(s)
  })

  it("never mutates the previous state", () => {
    const s1 = Object.freeze(tapAt(INITIAL_EXPLORE_ROUND, onA, 1000))
    const s2 = answerReason(s1, "blind_corner", HAZARDS)
    expect(s1.taps).toEqual([onA])
    expect(s2).not.toBe(s1)
  })

  it("always agrees with the server replay (200 random play sequences)", () => {
    let seed = 42
    const r = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let run = 0; run < 200; run += 1) {
      let s = INITIAL_EXPLORE_ROUND
      let at = 0
      for (let step = 0; step < 15; step += 1) {
        at += r() < 0.3 ? 100 : 2000
        s = tapAt(s, r() < 0.4 ? (r() < 0.5 ? onA : onB) : { x: r(), y: r() }, at)
        if (s.pendingReasonHazardId) {
          const choices = buildReasonChoices({ id: s.pendingReasonHazardId, kind: "blind_corner" }, HAZARDS)
          s = answerReason(s, choices![Math.floor(r() * choices!.length)].kind, HAZARDS)
        }
      }
      const client = summarizeRound(s, HAZARDS).replay
      const server = replayExplore(JSON.parse(JSON.stringify(s.taps)), HAZARDS)
      expect(client).toEqual(server)
      expect(s.taps.length).toBeLessThanOrEqual(HAZARDS.length + summarizeRound(s, HAZARDS).budget)
    }
  })
})
