import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(),
}))

vi.mock("@/lib/gemini-hazard", () => ({
  analyzeImagePipeline: vi.fn(),
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
  }
})

vi.mock("@/lib/hunter/storage", () => ({
  uploadMaskedPhoto: vi.fn().mockResolvedValue({ path: "user-1/photo-1/masked.webp" }),
  createPhotoSignedUrl: vi.fn().mockResolvedValue("https://signed.example/masked.webp"),
}))

vi.mock("@/lib/hunter/audit", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import { createServerClient } from "@/lib/supabase-server"
import { analyzeImagePipeline } from "@/lib/gemini-hazard"
import { checkGeminiRateLimit } from "@/lib/upstash-rate-limiter"
import { uploadMaskedPhoto, createPhotoSignedUrl } from "@/lib/hunter/storage"
import { writeAuditLog } from "@/lib/hunter/audit"

const mockUser = { id: "user-1", email: "test@example.com" }

function mockAuth(user: typeof mockUser | null) {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    rpc: vi.fn(),
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as any)
}

function makeJsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function emptyVisionAnalysis(hazards: unknown[] = []) {
  return {
    vision: {
      safetyEquipment: [],
      hazards,
      traffic: [],
      obstructions: [],
      inferenceTimeMs: 50,
    },
    think: { contextualRisks: [], priorityImprovements: [], latentRisks: [], childPerspectiveRisks: [] },
    score: { score: 80 },
    educationalTips: [],
    analysisTimestamp: "2026-06-26T00:00:00.000Z",
  }
}

const detectedHazard = {
  category: "hazards",
  label: "blind_corner",
  description: "見通しの悪い角だよ",
  count: 1,
  confidence: 0.9,
  coverageRatio: 0.04,
  positions: [{ x: 0.4, y: 0.5, width: 0.2, height: 0.2 }],
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

  it("maps detected hazards and returns an accident summary", async () => {
    vi.mocked(analyzeImagePipeline).mockResolvedValue(emptyVisionAnalysis([detectedHazard]) as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.hazards).toHaveLength(1)
    expect(body.hazards[0].region).toMatchObject({ x: 0.4, y: 0.5, w: 0.2, h: 0.2 })
    expect(body.usedFallback).toBe(false)
    expect(body.accident.hasData).toBe(false)
    // 画像は保存しない: レスポンスに画像が含まれない
    expect(JSON.stringify(body)).not.toContain("base64")
  })

  it("falls back to generic hazards when detection is empty (double-empty)", async () => {
    vi.mocked(analyzeImagePipeline).mockResolvedValue(emptyVisionAnalysis([]) as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.usedFallback).toBe(true)
    expect(body.hazards.length).toBeGreaterThan(0)
  })

  it("returns 502 when the pipeline throws", async () => {
    vi.mocked(analyzeImagePipeline).mockRejectedValue(new Error("boom"))
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    expect(res.status).toBe(502)
  })

  it("does not save when save is omitted (Phase 0 backward compat)", async () => {
    vi.mocked(analyzeImagePipeline).mockResolvedValue(emptyVisionAnalysis([detectedHazard]) as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(makeJsonRequest("http://localhost/api/hunter/analyze", validBody))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(uploadMaskedPhoto).not.toHaveBeenCalled()
    expect(body.photoId).toBeUndefined()
    expect(body.signedUrl).toBeUndefined()
  })

  it("saves the masked photo and returns photoId + signedUrl when save=true", async () => {
    vi.mocked(analyzeImagePipeline).mockResolvedValue(emptyVisionAnalysis([detectedHazard]) as any)
    const { POST } = await import("@/app/api/hunter/analyze/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/analyze", { ...validBody, save: true }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(uploadMaskedPhoto).toHaveBeenCalledTimes(1)
    expect(vi.mocked(uploadMaskedPhoto).mock.calls[0][1]).toBe(mockUser.id)
    expect(vi.mocked(uploadMaskedPhoto).mock.calls[0][3]).toBe(validBody.imageBase64)
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      mockUser.id,
      "analyze_save",
      expect.any(String),
    )
    expect(body.photoId).toEqual(expect.any(String))
    expect(body.signedUrl).toBe("https://signed.example/masked.webp")
    expect(body.savedError).toBe(false)
    // 検出結果は通常どおり返る
    expect(body.hazards).toHaveLength(1)
    // 未マスク画像はレスポンスに含めない
    expect(JSON.stringify(body)).not.toContain("base64")
  })

  it("keeps the game going (savedError) when storage upload fails", async () => {
    vi.mocked(analyzeImagePipeline).mockResolvedValue(emptyVisionAnalysis([detectedHazard]) as any)
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

  it("re-scores a quiz session server-side", async () => {
    const { POST } = await import("@/app/api/hunter/session/route")
    const hazard = {
      id: "s-0-0",
      type: "車に注意",
      region: { x: 0.3, y: 0.3, w: 0.3, h: 0.3 },
      severity: "high",
      kidExplanation: "あぶないよ",
      safeAction: "気をつけよう",
      confidence: 0.9,
    }
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", {
        mode: "quiz",
        hazards: [hazard],
        accident: {
          hasData: true,
          riskScore: 50,
          riskLevel: "high",
          riskLabel: "危険",
          riskEmoji: "🟠",
          totalAccidents: 5,
          childInvolved: 1,
          topAccidentType: "出会い頭",
          peakTimeSlot: null,
          kidMessage: "気をつけよう",
        },
        answers: [{ itemId: "q-place-0", tap: { x: 0.4, y: 0.4 } }],
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.mode).toBe("quiz")
    expect(body.total).toBeGreaterThan(0)
    expect(body.correct).toBe(1)
  })

  it("rejects a malformed body", async () => {
    const { POST } = await import("@/app/api/hunter/session/route")
    const res = await POST(
      makeJsonRequest("http://localhost/api/hunter/session", { mode: "battle", hazards: [], taps: [] }),
    )
    expect(res.status).toBe(400)
  })
})
