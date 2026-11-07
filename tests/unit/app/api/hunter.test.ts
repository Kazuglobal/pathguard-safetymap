import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/auth/actor", () => ({ getActor: vi.fn() }))

vi.mock("@/lib/db/repos/hunter.repo", () => ({
  saveHunterPhoto: vi.fn().mockResolvedValue(undefined),
  getHunterPhoto: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/lib/db/repos/gamification.repo", () => ({
  recordSafetyQuestAttemptAndAward: vi.fn().mockResolvedValue({ attemptId: "attempt-1", pointsAwarded: 5 }),
  applyMissionProgress: vi.fn().mockResolvedValue({ completed: [] }),
}))

vi.mock("@/lib/auth/service-actor", () => ({
  getServiceActor: () => ({ kind: "service" }),
}))

vi.mock("@/lib/hunter/hunter-ai", () => ({
  analyzeHunterImage: vi.fn(),
}))

vi.mock("@/lib/api-usage-logger", () => ({ logApiUsage: vi.fn() }))

vi.mock("@/lib/hunter/observability", () => ({
  logAnalyzeFallback: vi.fn(),
}))

vi.mock("@/lib/hunter/answer-cache", () => ({
  putAnswerKey: vi.fn().mockResolvedValue(undefined),
  getAnswerKey: vi.fn().mockResolvedValue(null),
  isAnswerCacheConfigured: vi.fn().mockReturnValue(false),
  claimSessionScore: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/traffic-accident/server", () => ({
  fetchNearbyAccidentStats: vi.fn().mockResolvedValue(null),
}))

vi.mock("@/lib/upstash-rate-limiter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/upstash-rate-limiter")>(
    "@/lib/upstash-rate-limiter",
  )
  return {
    ...actual,
    checkGeminiRateLimit: vi.fn().mockResolvedValue({ success: true }),
    checkApiRateLimit: vi.fn().mockResolvedValue({ success: true }),
  }
})

vi.mock("@/lib/hunter/storage", () => ({
  uploadMaskedPhoto: vi.fn().mockResolvedValue({ path: "user-1/photo-1/masked.webp" }),
  createPhotoSignedUrl: vi.fn().mockReturnValue("/api/media/private/hunter-photos/user-1/photo-1/masked.webp"),
  deletePhotoObjects: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/hunter/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import { getActor } from "@/lib/auth/actor"
import { getHunterPhoto } from "@/lib/db/repos/hunter.repo"
import { applyMissionProgress, recordSafetyQuestAttemptAndAward } from "@/lib/db/repos/gamification.repo"
import { analyzeHunterImage } from "@/lib/hunter/hunter-ai"
import { logAnalyzeFallback } from "@/lib/hunter/observability"
import { claimSessionScore, getAnswerKey, isAnswerCacheConfigured, putAnswerKey } from "@/lib/hunter/answer-cache"
import { checkApiRateLimit, checkGeminiRateLimit } from "@/lib/upstash-rate-limiter"
import { uploadMaskedPhoto, createPhotoSignedUrl } from "@/lib/hunter/storage"
import { writeAuditLog } from "@/lib/hunter/audit"
import { logApiUsage } from "@/lib/api-usage-logger"

const mockUser = { id: "user-1", email: "test@example.com" }

function mockAuth(user: typeof mockUser | null) {
  vi.mocked(getActor).mockResolvedValue(user
    ? { kind: "user", id: user.id, email: user.email, isAdmin: false }
    : { kind: "anon" })
}

function makeJsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const detectedHazard = {
  id: "sess-0",
  kind: "blind_corner",
  type: "見通しの悪い角",
  region: { x: 0.4, y: 0.5, w: 0.2, h: 0.2 },
  severity: "high",
  kidExplanation: "曲がってくる車から見えにくいよ",
  safeAction: "止まって左右を見よう",
  confidence: 0.9,
  accidentLink: "出会い頭",
}

const sampleQuiz = [
  {
    id: "q-choice-0",
    kind: "choice",
    theme: null,
    question: "どうする？",
    choices: [{ id: "c0", label: "止まる" }],
    correctChoiceId: "c0",
    explanation: "x",
    accidentLink: null,
  },
]

function exploreResult(hazards: unknown[]) {
  return {
    mode: "explore",
    hazards,
    quiz: sampleQuiz,
    safePoints: [],
    noHazardFollow: null,
    usedFallback: false,
    fallbackReason: null,
  }
}

function guideResult(reason: string) {
  return {
    mode: "guide",
    hazards: [],
    quiz: sampleQuiz,
    safePoints: [],
    noHazardFollow: "あんしんだね",
    usedFallback: true,
    fallbackReason: reason,
  }
}

const validBody = {
  imageBase64: "data:image/png;base64,abc",
  pin: { latitude: 33.59, longitude: 130.4 },
  consent: true,
}

describe("/api/hunter/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth(mockUser)
    vi.mocked(checkGeminiRateLimit).mockResolvedValue({ success: true })
  })

  it("requires auth", async () => {
    mockAuth(null)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(checkGeminiRateLimit).mockResolvedValue({ success: false, reset: Date.now() + 60_000 })
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBeTruthy()
  })

  it("rejects when third-party AI consent is missing", async () => {
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/analyze", {
        imageBase64: "data:image/png;base64,abc",
        pin: { latitude: 33.59, longitude: 130.4 },
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain("同意")
  })

  it("returns explore-mode hazards, quiz and an accident summary", async () => {
    vi.mocked(analyzeHunterImage).mockResolvedValue(exploreResult([detectedHazard]) as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.mode).toBe("explore")
    expect(body.hazards).toHaveLength(1)
    expect(body.hazards[0].region).toMatchObject({ x: 0.4, y: 0.5, w: 0.2, h: 0.2 })
    expect(body.quiz.length).toBeGreaterThan(0)
    expect(body.usedFallback).toBe(false)
    expect(body.accident.hasData).toBe(false)
    // 画像は保存しない: レスポンスに画像が含まれない
    expect(JSON.stringify(body)).not.toContain("base64")
  })

  it("logs every AI call with its real tokens so the admin cost page sees the hunter (Claude and Gemini)", async () => {
    vi.mocked(analyzeHunterImage).mockImplementation(async (_image, options) => {
      options.onUsage?.({ provider: "anthropic", model: "claude-haiku-5-5", inputTokens: 3000, outputTokens: 40, ok: false })
      options.onUsage?.({ provider: "gemini", inputTokens: 2000, outputTokens: 1000, ok: true })
      return exploreResult([detectedHazard]) as any
    })
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    expect(res.status).toBe(200)

    const entries = vi.mocked(logApiUsage).mock.calls.map(([entry]) => entry)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      api_provider: "anthropic", api_endpoint: "hunter-analyze", model_name: "claude-haiku-5-5",
      input_tokens: 3000, output_tokens: 40, success: false,
    })
    // $0.10 / $0.50 per 1M tokens
    expect(entries[0].estimated_cost_usd).toBeCloseTo(0.0003 + 0.00002, 10)
    expect(entries[1]).toMatchObject({
      api_provider: "gemini", api_endpoint: "hunter-analyze", model_name: "gemini-3.5-flash",
      input_tokens: 2000, output_tokens: 1000, success: true,
    })
    // gemini-3.5-flash: $1.50 / $9.00 per 1M tokens
    expect(entries[1].estimated_cost_usd).toBeCloseTo(0.003 + 0.009, 10)
  })

  it("issues a rules-2 answer key with kind and the hit box, and returns parent notes", async () => {
    const withZone = {
      ...detectedHazard,
      kind: "blind_corner",
      hitRegion: { x: 0.42, y: 0.52, w: 0.12, h: 0.12 },
      focusPoint: { x: 0.48, y: 0.58 },
    }
    vi.mocked(analyzeHunterImage).mockResolvedValue({
      ...exploreResult([withZone]),
      parentNotes: [{ hazardId: withZone.id, evidence: "角の へいが 車を かくす" }],
    } as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    const body = await res.json()

    expect(body.rules).toBe(2)
    expect(body.parentNotes).toEqual([{ hazardId: withZone.id, evidence: "角の へいが 車を かくす" }])
    const key = vi.mocked(putAnswerKey).mock.calls[0][1]
    expect(key.rules).toBe(2)
    expect(key.hazards[0]).toEqual({
      id: withZone.id, region: withZone.region, severity: "high", confidence: 0.9,
      kind: "blind_corner", hitRegion: withZone.hitRegion, focusPoint: withZone.focusPoint,
    })
    // 鍵には説明文を載せない
    expect(JSON.stringify(key)).not.toContain(withZone.kidExplanation)
  })

  it("returns 200 guide mode (not 502) when detection is empty", async () => {
    vi.mocked(analyzeHunterImage).mockResolvedValue(guideResult("empty") as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.mode).toBe("guide")
    expect(body.usedFallback).toBe(true)
    expect(body.fallbackReason).toBe("empty")
    expect(body.hazards).toEqual([])
    expect(body.quiz.length).toBeGreaterThan(0)
    expect(logAnalyzeFallback).toHaveBeenCalledWith("empty", expect.any(String))
  })

  it("returns 200 guide (not 502) when the AI fails", async () => {
    vi.mocked(analyzeHunterImage).mockResolvedValue(guideResult("ai_error") as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.mode).toBe("guide")
    expect(body.fallbackReason).toBe("ai_error")
    expect(logAnalyzeFallback).toHaveBeenCalledWith("ai_error", expect.any(String))
  })

  it("still returns 200 guide when analyzeHunterImage unexpectedly throws (belt)", async () => {
    vi.mocked(analyzeHunterImage).mockRejectedValue(new Error("boom"))
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.mode).toBe("guide")
    expect(body.usedFallback).toBe(true)
    expect(body.fallbackReason).toBe("ai_error")
    expect(logAnalyzeFallback).toHaveBeenCalledWith("ai_error", expect.any(String))
  })

  it("caches the guide-mode fallback quiz's answer key even on the unexpected-exception path (belt)", async () => {
    // トラスト境界の回帰テスト: この呼び出しを省略すると、Upstash 設定済み環境で
    // /api/hunter/session がこの sessionId を「キャッシュミス=改ざんの疑い」として
    // 409 で弾いてしまい、正しく回答しても採点0点になる。
    vi.mocked(analyzeHunterImage).mockRejectedValue(new Error("boom"))
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(putAnswerKey).toHaveBeenCalledWith(
      body.sessionId,
      expect.objectContaining({
        hazards: [],
        quiz: body.quiz.map((q: any) => ({
          id: q.id,
          kind: q.kind,
          correctChoiceId: q.correctChoiceId,
          answerRegion: q.answerRegion,
        })),
      }),
    )
  })

  it("does not save when save is omitted (Phase 0 backward compat)", async () => {
    vi.mocked(analyzeHunterImage).mockResolvedValue(exploreResult([detectedHazard]) as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(uploadMaskedPhoto).not.toHaveBeenCalled()
    expect(body.photoId).toBeUndefined()
    expect(body.signedUrl).toBeUndefined()
  })

  it("does not save in guide mode even when save=true", async () => {
    vi.mocked(analyzeHunterImage).mockResolvedValue(guideResult("empty") as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/analyze", { ...validBody, save: true }),
    )
    expect(res.status).toBe(200)
    expect(uploadMaskedPhoto).not.toHaveBeenCalled()
  })

  it("saves the masked photo and returns photoId + signedUrl when save=true", async () => {
    vi.mocked(analyzeHunterImage).mockResolvedValue(exploreResult([detectedHazard]) as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/analyze", { ...validBody, save: true }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(uploadMaskedPhoto).toHaveBeenCalledTimes(1)
    expect(uploadMaskedPhoto).toHaveBeenCalledWith(
      mockUser.id,
      expect.any(String),
      validBody.imageBase64,
    )
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "user", id: mockUser.id }),
      "analyze_save",
      expect.any(String),
    )
    expect(body.photoId).toEqual(expect.any(String))
    expect(body.signedUrl).toBe("/api/media/private/hunter-photos/user-1/photo-1/masked.webp")
    expect(body.savedError).toBe(false)
    expect(body.hazards).toHaveLength(1)
    expect(JSON.stringify(body)).not.toContain("base64")
  })

  it("stores the hit box and focus inside the region JSON so a replay judges the same way", async () => {
    const { saveHunterPhoto } = await import("@/lib/db/repos/hunter.repo")
    const withZone = {
      ...detectedHazard,
      hitRegion: { x: 0.42, y: 0.52, w: 0.12, h: 0.12 },
      focusPoint: { x: 0.48, y: 0.58 },
    }
    vi.mocked(analyzeHunterImage).mockResolvedValue(exploreResult([withZone]) as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    await POST(makeJsonRequest("http://localhost/api/hunter/analyze", { ...validBody, save: true }))
    const saved = vi.mocked(saveHunterPhoto).mock.calls[0][1] as { detections: Array<{ region: unknown }> }
    expect(saved.detections[0].region).toEqual({
      ...detectedHazard.region,
      hitRegion: withZone.hitRegion,
      focusPoint: withZone.focusPoint,
    })
  })

  it("keeps the game going (savedError) when storage upload fails", async () => {
    vi.mocked(analyzeHunterImage).mockResolvedValue(exploreResult([detectedHazard]) as any)
    vi.mocked(uploadMaskedPhoto).mockRejectedValueOnce(new Error("storage down"))
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/analyze", { ...validBody, save: true }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.savedError).toBe(true)
    expect(body.photoId).toBeNull()
    expect(body.signedUrl).toBeNull()
    expect(body.hazards).toHaveLength(1)
  })
})

describe("/api/hunter/session", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth(mockUser)
    vi.mocked(checkApiRateLimit).mockResolvedValue({ success: true })
    vi.mocked(isAnswerCacheConfigured).mockReturnValue(false)
    vi.mocked(getAnswerKey).mockResolvedValue(null)
    vi.mocked(getHunterPhoto).mockResolvedValue(null)
    vi.mocked(claimSessionScore).mockResolvedValue(true)
    // 実リポジトリと同じく、要求ポイント(0 or 5)をそのまま返す
    vi.mocked(recordSafetyQuestAttemptAndAward).mockImplementation(async (_actor, _service, input) => ({
      attemptId: "attempt-1",
      pointsAwarded: input.pointsAwarded ?? 0,
    }))
    vi.mocked(applyMissionProgress).mockResolvedValue({ completed: [] })
  })

  /** サーバ保持の正解鍵がある(=記録してよい)状態にする。 */
  function withServerKey(key: { hazards?: unknown[]; quiz?: unknown[]; rules?: number }) {
    vi.mocked(isAnswerCacheConfigured).mockReturnValue(true)
    vi.mocked(getAnswerKey).mockResolvedValue({ hazards: [], quiz: [], ...key } as any)
  }
  const exploreKey = {
    hazards: [{ id: "s-0-0", region: { x: 0.3, y: 0.3, w: 0.3, h: 0.3 }, severity: "high", confidence: 0.9 }],
  }

  const scoredHazard = {
    id: "s-0-0",
    type: "きけんなもの",
    region: { x: 0.3, y: 0.3, w: 0.3, h: 0.3 },
    severity: "high",
    kidExplanation: "あぶないよ",
    safeAction: "気をつけよう",
    confidence: 0.9,
  }
  const PHOTO_ID = "22222222-2222-4222-8222-222222222222"

  it("returns 429 when the session endpoint is rate limited", async () => {
    vi.mocked(checkApiRateLimit).mockResolvedValue({ success: false, reset: Date.now() + 60_000 })
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", { mode: "explore", hazards: [scoredHazard], taps: [] }),
    )
    expect(res.status).toBe(429)
  })

  it("records the play through the shared attempts/points contract and advances missions", async () => {
    withServerKey(exploreKey)
    vi.mocked(applyMissionProgress).mockResolvedValueOnce({
      completed: [{ missionId: 1, title: "写真ゲーム初回", rewardPoints: 50 }],
    })
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "explore",
        sessionId: "sess-1",
        hazards: [scoredHazard],
        taps: [{ x: 0.4, y: 0.4 }],
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.matches).toBe(1)
    expect(body.pointsAwarded).toBe(5)
    expect(body.persistError).toBe(false)
    expect(body.missionsCompleted).toEqual([{ title: "写真ゲーム初回", rewardPoints: 50 }])

    expect(recordSafetyQuestAttemptAndAward).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "user", id: mockUser.id }),
      { kind: "service" },
      expect.objectContaining({
        challengeId: "hunter-explore",
        mode: "private-practice",
        score: 100,
        accuracy: 100,
        pointsAwarded: 5,
        userMarkers: [{ x: 0.4, y: 0.4 }],
        answerPayload: expect.objectContaining({ source: "hunter", sessionId: "sess-1", photoId: null, foundIds: ["s-0-0"] }),
      }),
    )
    // 100% なので play と high_score の両方が進む
    expect(vi.mocked(applyMissionProgress).mock.calls.map((call) => call[2].targetType)).toEqual([
      "hazard_game_play",
      "hazard_game_high_score",
    ])
  })

  describe("rules v2 (虫めがね + 理由)", () => {
    // 当たり枠は鍵が持つ小さい枠。表示枠(region)の端は当たりにならない。
    const v2Key = {
      rules: 2,
      hazards: [{
        id: "s-0-0", region: { x: 0.3, y: 0.3, w: 0.3, h: 0.3 }, severity: "high", confidence: 0.9,
        kind: "blind_corner", hitRegion: { x: 0.4, y: 0.4, w: 0.12, h: 0.12 }, focusPoint: { x: 0.45, y: 0.45 },
      }],
    }
    async function post(taps: unknown[]) {
      const { POST } = await import("@/app/api/hunter/session/route")
      const res = await POST(
        makeJsonRequest("http://localhost/api/hunter/session", {
          mode: "explore", sessionId: "sess-v2", hazards: [scoredHazard], taps,
        }),
      )
      return { res, body: await res.json() }
    }

    it("records full credit only when the reason is right", async () => {
      withServerKey(v2Key)
      const { body } = await post([{ x: 0.45, y: 0.45, reason: "blind_corner" }])
      expect(body).toMatchObject({ rules: 2, matches: 1, understood: 1, accuracy: 100, budget: 4, misses: 0 })
      expect(body.discoveries).toEqual([{ hazardId: "s-0-0", understood: true }])
      expect(recordSafetyQuestAttemptAndAward).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          accuracy: 100,
          pointsAwarded: 5,
          answerPayload: expect.objectContaining({ rules: 2, understood: 1, budget: 4, misses: 0, ignoredTaps: 0 }),
        }),
      )
    })

    it("gives location-only credit (60) for a wrong reason", async () => {
      withServerKey(v2Key)
      const { body } = await post([{ x: 0.45, y: 0.45, reason: "flood_dip" }])
      expect(body).toMatchObject({ matches: 1, understood: 0, accuracy: 60 })
      expect(recordSafetyQuestAttemptAndAward).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ accuracy: 60, score: 60 }),
      )
    })

    it("does not count the edge of the big display box as a hit any more", async () => {
      withServerKey(v2Key)
      const { body } = await post([{ x: 0.31, y: 0.31 }])
      expect(body.matches).toBe(0)
      expect(body.misses).toBe(1)
    })

    it("ignores taps after the magnifiers run out", async () => {
      withServerKey(v2Key)
      const misses = Array.from({ length: 4 }, () => ({ x: 0.9, y: 0.1 }))
      const { body } = await post([...misses, { x: 0.45, y: 0.45, reason: "blind_corner" }])
      expect(body).toMatchObject({ matches: 0, misses: 4, ignoredTaps: 1, accuracy: 0 })
    })

    it("drops an invalid reason instead of rejecting the whole session", async () => {
      withServerKey(v2Key)
      const { res, body } = await post([{ x: 0.45, y: 0.45, reason: "not-a-kind" }])
      expect(res.status).toBe(200)
      expect(body).toMatchObject({ matches: 1, understood: 0 })
    })

    it("keeps scoring old keys (no rules) with the legacy rules", async () => {
      withServerKey(exploreKey)
      const { body } = await post([{ x: 0.31, y: 0.31 }])
      expect(body).toMatchObject({ rules: 1, matches: 1, understood: 1, accuracy: 100 })
    })
  })

  it("links the play to the photo only when the caller owns it", async () => {
    withServerKey(exploreKey)
    vi.mocked(getHunterPhoto).mockResolvedValueOnce({ id: PHOTO_ID } as any)
    const { POST } = await import("@/app/api/hunter/session/route")
    await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "explore", sessionId: "sess-1", hazards: [scoredHazard], taps: [{ x: 0.9, y: 0.9 }], photoId: PHOTO_ID,
      }),
    )
    expect(recordSafetyQuestAttemptAndAward).toHaveBeenLastCalledWith(
      expect.anything(), expect.anything(),
      expect.objectContaining({ pointsAwarded: 0, answerPayload: expect.objectContaining({ photoId: PHOTO_ID }) }),
    )

    vi.mocked(getHunterPhoto).mockRejectedValueOnce(new Error("Forbidden"))
    await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "explore", sessionId: "sess-2", hazards: [scoredHazard], taps: [{ x: 0.9, y: 0.9 }], photoId: PHOTO_ID,
      }),
    )
    expect(recordSafetyQuestAttemptAndAward).toHaveBeenLastCalledWith(
      expect.anything(), expect.anything(),
      expect.objectContaining({ answerPayload: expect.objectContaining({ photoId: null }) }),
    )
  })

  it("does not record anything for a guide session (no hazards in the server key)", async () => {
    vi.mocked(isAnswerCacheConfigured).mockReturnValue(true)
    vi.mocked(getAnswerKey).mockResolvedValueOnce({ hazards: [], quiz: [] })
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "explore", sessionId: "sess-guide", hazards: [scoredHazard], taps: [{ x: 0.4, y: 0.4 }],
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.total).toBe(0)
    expect(body.pointsAwarded).toBe(0)
    expect(recordSafetyQuestAttemptAndAward).not.toHaveBeenCalled()
    expect(applyMissionProgress).not.toHaveBeenCalled()
  })

  it("keeps the score when persistence fails and says so honestly", async () => {
    withServerKey({ quiz: [{ id: "q-choice-0", kind: "choice", correctChoiceId: "c0" }] })
    vi.mocked(recordSafetyQuestAttemptAndAward).mockRejectedValueOnce(new Error("D1 down"))
    vi.mocked(applyMissionProgress).mockRejectedValue(new Error("D1 down"))
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "quiz",
        sessionId: "sess-q",
        items: [{ id: "q-choice-0", kind: "choice", theme: null, question: "?", choices: [{ id: "c0", label: "a" }, { id: "c1", label: "b" }], correctChoiceId: "c0", explanation: "x" }],
        answers: [{ itemId: "q-choice-0", choiceId: "c0" }],
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.correct).toBe(1)
    expect(body.pointsAwarded).toBe(0)
    expect(body.persistError).toBe(true)
  })

  it("does not award persistent points when the server holds no answer key (client-supplied definitions)", async () => {
    vi.mocked(isAnswerCacheConfigured).mockReturnValue(false)
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "explore", hazards: [scoredHazard], taps: [{ x: 0.4, y: 0.4 }],
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.matches).toBe(1)
    expect(body.pointsAwarded).toBe(0)
    expect(body.persistSkipped).toBe("no-server-key")
    expect(recordSafetyQuestAttemptAndAward).not.toHaveBeenCalled()
    expect(applyMissionProgress).not.toHaveBeenCalled()
    expect(claimSessionScore).not.toHaveBeenCalled()
  })

  it("records the same session and mode only once (re-posting cannot inflate attempts or missions)", async () => {
    withServerKey(exploreKey)
    vi.mocked(claimSessionScore).mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const { POST } = await import("@/app/api/hunter/session/route")
    const payload = { mode: "explore", sessionId: "sess-1", hazards: [scoredHazard], taps: [{ x: 0.4, y: 0.4 }] }
    const first = await (await POST(makeJsonRequest("http://localhost/api/hunter/session", payload))).json()
    const second = await (await POST(makeJsonRequest("http://localhost/api/hunter/session", payload))).json()
    expect(first.pointsAwarded).toBe(5)
    expect(second.pointsAwarded).toBe(0)
    expect(second.persistSkipped).toBe("already-scored")
    expect(second.matches).toBe(1)
    expect(recordSafetyQuestAttemptAndAward).toHaveBeenCalledTimes(1)
    expect(claimSessionScore).toHaveBeenCalledWith("sess-1", "explore")
  })

  it("records a zero-tap finish as an attempt but does not advance the play mission", async () => {
    withServerKey(exploreKey)
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", { mode: "explore", sessionId: "sess-1", hazards: [scoredHazard], taps: [] }),
    )
    const body = await res.json()
    expect(body.pointsAwarded).toBe(0)
    expect(recordSafetyQuestAttemptAndAward).toHaveBeenCalledWith(
      expect.anything(), expect.anything(), expect.objectContaining({ pointsAwarded: 0, score: 0 }),
    )
    expect(applyMissionProgress).not.toHaveBeenCalled()
  })

  it("returns 409 with a machine-readable code when the server key is configured but missing", async () => {
    vi.mocked(isAnswerCacheConfigured).mockReturnValue(true)
    vi.mocked(getAnswerKey).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", { mode: "explore", sessionId: "gone", hazards: [scoredHazard], taps: [] }),
    )
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.code).toBe("session_expired")
    expect(recordSafetyQuestAttemptAndAward).not.toHaveBeenCalled()
  })

  it("requires auth", async () => {
    mockAuth(null)
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", { mode: "explore", hazards: [], taps: [] }),
    )
    expect(res.status).toBe(401)
  })

  it("re-scores taps server-side against provided hazards", async () => {
    const { POST } = await import("@/app/api/hunter/session/route")
    const hazard = {
      id: "s-0-0",
      type: "きけんなもの",
      region: { x: 0.3, y: 0.3, w: 0.3, h: 0.3 },
      severity: "high",
      kidExplanation: "あぶないよ",
      safeAction: "気をつけよう",
      confidence: 0.9,
    }
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "explore",
        hazards: [hazard],
        taps: [{ x: 0.4, y: 0.4 }],
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.matches).toBe(1)
    expect(body.score).toBeGreaterThan(0)
    expect(body.total).toBe(1)
  })

  it("re-scores a quiz session from client-supplied items", async () => {
    const { POST } = await import("@/app/api/hunter/session/route")
    const items = [
      {
        id: "q-place-0",
        kind: "place",
        theme: null,
        question: "「見通しの悪い角」は どこ？",
        answerHazardId: "s-0",
        answerRegion: { x: 0.3, y: 0.3, w: 0.3, h: 0.3 },
        explanation: "とまろう",
        accidentLink: null,
      },
    ]
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "quiz",
        items,
        answers: [{ itemId: "q-place-0", tap: { x: 0.4, y: 0.4 } }],
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.mode).toBe("quiz")
    expect(body.total).toBe(1)
    expect(body.correct).toBe(1)
  })

  it("re-scores quiz from the server cache, ignoring tampered client items", async () => {
    // サーバ保持の正解は c0。クライアントは correctChoiceId を c1 と偽り c1 を回答。
    vi.mocked(getAnswerKey).mockResolvedValueOnce({
      hazards: [],
      quiz: [{ id: "q-choice-0", kind: "choice", correctChoiceId: "c0" }],
    })
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "quiz",
        sessionId: "sess-1",
        items: [
          {
            id: "q-choice-0",
            kind: "choice",
            theme: null,
            question: "?",
            choices: [{ id: "c0", label: "a" }, { id: "c1", label: "b" }],
            correctChoiceId: "c1",
            explanation: "x",
          },
        ],
        answers: [{ itemId: "q-choice-0", choiceId: "c1" }],
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.correct).toBe(0) // サーバは c0 を正解とみなす
  })

  it("re-scores explore from the server cache, ignoring tampered hazards", async () => {
    // サーバ保持の hazard は左上。クライアントは別の場所に偽 hazard を主張。
    vi.mocked(getAnswerKey).mockResolvedValueOnce({
      hazards: [
        { id: "h0", region: { x: 0.3, y: 0.3, w: 0.2, h: 0.2 }, severity: "high", confidence: 0.9 },
      ],
      quiz: [],
    })
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "explore",
        sessionId: "sess-1",
        hazards: [
          {
            id: "fake",
            type: "x",
            region: { x: 0.7, y: 0.7, w: 0.2, h: 0.2 },
            severity: "high",
            kidExplanation: "",
            safeAction: "",
            confidence: 0.9,
          },
        ],
        taps: [{ x: 0.75, y: 0.75 }], // クライアント hazard には当たるが、キャッシュ hazard には当たらない
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.total).toBe(1) // キャッシュの1件
    expect(body.matches).toBe(0) // キャッシュ基準では miss
  })

  it("scores an explore session against an empty cache (guide-mode session) instead of trusting fabricated client hazards", async () => {
    // ガイドモード相当: サーバキャッシュは正当に hazards: [] (探索対象なし)。
    // 攻撃者はそのセッションIDへ、自分ででっちあげた hazard + それに当たる tap を送る。
    vi.mocked(isAnswerCacheConfigured).mockReturnValueOnce(true)
    vi.mocked(getAnswerKey).mockResolvedValueOnce({ hazards: [], quiz: [] })
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "explore",
        sessionId: "guide-sess-1",
        hazards: [
          {
            id: "fake",
            type: "x",
            region: { x: 0.3, y: 0.3, w: 0.2, h: 0.2 },
            severity: "high",
            kidExplanation: "",
            safeAction: "",
            confidence: 0.9,
          },
        ],
        taps: [{ x: 0.35, y: 0.35 }], // 自作 hazard には当たるが、サーバは空リストを権威とする
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.total).toBe(0) // キャッシュ側は0件(自作 hazard は無視される)
    expect(body.matches).toBe(0)
    expect(body.score).toBe(0)
  })

  it("rejects a quiz session with no items", async () => {
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", { mode: "quiz", answers: [] }),
    )
    expect(res.status).toBe(400)
  })

  it("rejects an explore session with no hazards (guide mis-entry guard)", async () => {
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", { mode: "explore", hazards: [], taps: [] }),
    )
    expect(res.status).toBe(400)
  })

  it("rejects a malformed body", async () => {
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", { mode: "battle", hazards: [], taps: [] }),
    )
    expect(res.status).toBe(400)
  })

  it("rejects quiz re-scoring instead of trusting raw client items when the answer cache is configured but misses", async () => {
    vi.mocked(isAnswerCacheConfigured).mockReturnValueOnce(true)
    // sessionId 省略/期限切れ相当: getAnswerKey は既定で null を返す
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "quiz",
        items: [
          {
            id: "q-choice-0",
            kind: "choice",
            theme: null,
            question: "?",
            choices: [{ id: "c0", label: "a" }, { id: "c1", label: "b" }],
            correctChoiceId: "c1",
            explanation: "x",
          },
        ],
        answers: [{ itemId: "q-choice-0", choiceId: "c1" }],
      }),
    )
    expect(res.status).toBe(409)
  })

  it("rejects explore re-scoring instead of trusting raw client hazards when the answer cache is configured but misses", async () => {
    vi.mocked(isAnswerCacheConfigured).mockReturnValueOnce(true)
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "explore",
        hazards: [
          {
            id: "fake",
            type: "x",
            region: { x: 0.3, y: 0.3, w: 0.2, h: 0.2 },
            severity: "high",
            kidExplanation: "",
            safeAction: "",
            confidence: 0.9,
          },
        ],
        taps: [{ x: 0.35, y: 0.35 }],
      }),
    )
    expect(res.status).toBe(409)
  })
})
