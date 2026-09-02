import { describe, expect, it, vi } from "vitest"

import {
  classifySessionFailure,
  postHunterSession,
  SESSION_FAILURE_COPY,
  toSessionSummary,
} from "@/lib/hunter/session-client"

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

describe("hunter session client", () => {
  it("maps explore and quiz bodies onto one summary shape with safe defaults", () => {
    expect(toSessionSummary({ score: 250, matches: 2, total: 3, comboMax: 2, pointsAwarded: 5, persistError: false, missionsCompleted: [{ title: "写真ゲーム初回", rewardPoints: 50 }, { title: "", rewardPoints: 1 }, null] }, 9)).toEqual({
      score: 250, matches: 2, total: 3, comboMax: 2, pointsAwarded: 5, persistError: false,
      missionsCompleted: [{ title: "写真ゲーム初回", rewardPoints: 50 }],
    })
    expect(toSessionSummary({ score: 100, correct: 1, total: 1 }, 4)).toMatchObject({ matches: 1, total: 1, pointsAwarded: 0 })
    expect(toSessionSummary(null, 4)).toEqual({ score: 0, matches: 0, total: 4, comboMax: 0, pointsAwarded: 0, persistError: false, missionsCompleted: [] })
  })

  it("classifies 409/session_expired, network, and other failures with kid copy", () => {
    expect(classifySessionFailure(409, { error: "x" })).toMatchObject({ kind: "expired", message: SESSION_FAILURE_COPY.expired })
    expect(classifySessionFailure(500, { code: "session_expired" })).toMatchObject({ kind: "expired" })
    expect(classifySessionFailure(0, null)).toMatchObject({ kind: "network" })
    expect(classifySessionFailure(500, null)).toMatchObject({ kind: "server" })
  })

  it("never fabricates a 0-point result: failures come back as ok:false", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response(200, { score: 150, matches: 1, total: 1, comboMax: 1, pointsAwarded: 5 }))
      .mockResolvedValueOnce(response(409, { error: "expired", code: "session_expired" }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))

    const ok = await postHunterSession({ mode: "explore" }, 1, fetchImpl as unknown as typeof fetch)
    expect(ok).toEqual({ ok: true, result: expect.objectContaining({ matches: 1, pointsAwarded: 5 }) })
    expect(fetchImpl).toHaveBeenCalledWith("/api/hunter/session", expect.objectContaining({ method: "POST" }))

    const expired = await postHunterSession({ mode: "explore" }, 1, fetchImpl as unknown as typeof fetch)
    expect(expired).toMatchObject({ ok: false, failure: { kind: "expired" } })
    expect(expired.result).toBeUndefined()

    const offline = await postHunterSession({ mode: "quiz" }, 2, fetchImpl as unknown as typeof fetch)
    expect(offline).toMatchObject({ ok: false, failure: { kind: "network" } })
  })
})
