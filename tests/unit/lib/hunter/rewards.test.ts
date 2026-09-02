import { describe, expect, it } from "vitest"

import {
  buildHunterAttempt,
  HUNTER_ATTEMPT_MODE,
  HUNTER_PLAY_POINTS,
  missionTargetsFor,
  normalizedAccuracy,
  summarizeHunterPlays,
  wasAttempted,
} from "@/lib/hunter/rewards"

describe("hunter rewards — attempts/points contract", () => {
  it("normalizes matches/total into a 0..100 integer (CHECK-safe)", () => {
    expect(normalizedAccuracy(0, 0)).toBe(0)
    expect(normalizedAccuracy(1, 3)).toBe(33)
    expect(normalizedAccuracy(3, 3)).toBe(100)
    expect(normalizedAccuracy(5, 3)).toBe(100) // 上振れは 100 にクランプ
    expect(normalizedAccuracy(-1, 3)).toBe(0)
  })

  it("does not record guide mode (total 0) at all — no fake credit", () => {
    expect(
      buildHunterAttempt({ mode: "explore", matches: 0, total: 0, rawScore: 0, comboMax: 0, sessionId: "s", photoId: null }),
    ).toBeNull()
  })

  it("awards the flat play points only when the child found or answered something", () => {
    const found = buildHunterAttempt({
      mode: "explore", matches: 2, total: 3, rawScore: 450, comboMax: 2,
      sessionId: "sess-1", photoId: "photo-1", foundIds: ["a", "b"], taps: [{ x: 0.1, y: 0.2 }],
    })
    expect(found).toMatchObject({
      challengeId: "hunter-explore",
      mode: HUNTER_ATTEMPT_MODE,
      score: 67,
      accuracy: 67,
      durationMs: null,
      pointsAwarded: HUNTER_PLAY_POINTS,
      userMarkers: [{ x: 0.1, y: 0.2 }],
    })
    expect(found?.answerPayload).toMatchObject({
      source: "hunter", mode: "explore", sessionId: "sess-1", photoId: "photo-1",
      rawScore: 450, comboMax: 2, matches: 2, total: 3, foundIds: ["a", "b"],
    })

    const nothing = buildHunterAttempt({
      mode: "quiz", matches: 0, total: 2, rawScore: 0, comboMax: 0, sessionId: null, photoId: null,
    })
    expect(nothing).toMatchObject({ challengeId: "hunter-quiz", pointsAwarded: 0, score: 0, userMarkers: [] })
  })

  it("advances the play mission only when the child actually tapped/answered, high-score from 80%", () => {
    expect(missionTargetsFor(79, true)).toEqual(["hazard_game_play"])
    expect(missionTargetsFor(80, true)).toEqual(["hazard_game_play", "hazard_game_high_score"])
    expect(missionTargetsFor(0, false)).toEqual([])
    expect(wasAttempted({ taps: [{ x: 0.1, y: 0.1 }] })).toBe(true)
    expect(wasAttempted({ answered: 2 })).toBe(true)
    expect(wasAttempted({ taps: [], answered: 0 })).toBe(false)
    expect(wasAttempted({})).toBe(false)
  })

  it("summarizes plays per photo, keeping the best explore result and ignoring junk rows", () => {
    const plays = summarizeHunterPlays([
      { createdAt: "2026-09-02T10:00:00Z", answerPayload: { source: "hunter", mode: "explore", photoId: "p1", matches: 1, total: 3 } },
      { createdAt: "2026-09-01T10:00:00Z", answerPayload: { source: "hunter", mode: "explore", photoId: "p1", matches: 3, total: 3 } },
      { createdAt: "2026-08-31T10:00:00Z", answerPayload: { source: "hunter", mode: "quiz", photoId: "p1", matches: 2, total: 2 } },
      { createdAt: "2026-08-30T10:00:00Z", answerPayload: { source: "other", photoId: "p1" } },
      { createdAt: "2026-08-29T10:00:00Z", answerPayload: null },
      { createdAt: "2026-08-28T10:00:00Z", answerPayload: { source: "hunter", mode: "explore", photoId: 42 } },
    ])
    expect(plays.get("p1")).toEqual({ count: 3, bestFound: 3, bestTotal: 3, lastPlayedAt: "2026-09-02T10:00:00Z" })
    expect(plays.size).toBe(1)
  })
})
