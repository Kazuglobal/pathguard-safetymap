import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(),
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}))

vi.mock("@/lib/gemini-hazard", () => ({
  analyzeImagePipeline: vi.fn(),
}))

import { createServerClient } from "@/lib/supabase-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { analyzeImagePipeline } from "@/lib/gemini-hazard"

const mockUser = { id: "user-1", email: "test@example.com" }

function mockAuth(user: typeof mockUser | null) {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as any)
}

function makeJsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("safety quest API routes", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockAuth(mockUser)
  })

  it("GET /api/safety-quest/challenges requires auth", async () => {
    mockAuth(null)
    const { GET } = await import("@/app/api/safety-quest/challenges/route")

    const res = await GET(new NextRequest("http://localhost/api/safety-quest/challenges"))

    expect(res.status).toBe(401)
  })

  it("GET /api/safety-quest/challenges returns approved public report photos without coordinates", async () => {
    const order = vi.fn().mockReturnThis()
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: "report-1",
          title: "交差点",
          status: "approved",
          image_url: "https://example.com/route.jpg",
          processed_image_url: null,
          processed_image_urls: null,
          city: "福岡市",
          town: "中央区",
          prefecture: "福岡県",
          danger_type: "intersection",
          danger_level: 4,
          latitude: 33.59,
          longitude: 130.4,
        },
      ],
      error: null,
    })
    const not = vi.fn().mockReturnThis()
    const filter = vi.fn().mockReturnThis()
    const select = vi.fn().mockReturnValue({ in: filter, not, order, limit })
    filter.mockReturnValue({ not, order, limit })
    not.mockReturnValue({ order, limit })
    order.mockReturnValue({ limit })

    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
    } as any)

    const { GET } = await import("@/app/api/safety-quest/challenges/route")

    const res = await GET(new NextRequest("http://localhost/api/safety-quest/challenges"))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.challenges).toHaveLength(1)
    expect(body.challenges[0]).toMatchObject({
      id: "report-report-1",
      sourceType: "report",
      areaLabel: "福岡市 中央区",
    })
    expect(JSON.stringify(body.challenges[0])).not.toContain("latitude")
    expect(JSON.stringify(body.challenges[0])).not.toContain("longitude")
  })

  it("POST /api/safety-quest/attempts validates marker payloads", async () => {
    const { POST } = await import("@/app/api/safety-quest/attempts/route")

    const res = await POST(makeJsonRequest("http://localhost/api/safety-quest/attempts", {
      challengeId: "sample-crossing-1",
      mode: "hazard",
      userMarkers: [{ x: "bad" }],
    }))

    expect(res.status).toBe(400)
  })

  it("POST /api/safety-quest/attempts scores a sample challenge and persists an attempt when possible", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    vi.mocked(getSupabaseAdmin).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert }),
    } as any)
    const { POST } = await import("@/app/api/safety-quest/attempts/route")

    const res = await POST(makeJsonRequest("http://localhost/api/safety-quest/attempts", {
      challengeId: "sample-crossing-1",
      mode: "hazard",
      durationMs: 30_000,
      userMarkers: [
        { id: "m1", x: 0.23, y: 0.27, width: 0.16, height: 0.16, label: "hazard", category: "hazard", timestamp: 1 },
        { id: "m2", x: 0.64, y: 0.36, width: 0.16, height: 0.16, label: "hazard", category: "hazard", timestamp: 2 },
      ],
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.result.matches).toBeGreaterThan(0)
    expect(body.result.pointsAwarded).toBeGreaterThan(0)
    expect(insert).toHaveBeenCalled()
  })

  it("POST /api/safety-quest/private-practice analyzes private photos without publishing them", async () => {
    vi.mocked(analyzeImagePipeline).mockResolvedValue({
      vision: {
        safetyEquipment: [],
        hazards: [],
        traffic: [],
        obstructions: [],
        inferenceTimeMs: 100,
      },
      think: {
        contextualRisks: [],
        priorityImprovements: [],
        latentRisks: [],
        childPerspectiveRisks: [],
      },
      score: {
        score: 95,
        level: "safe",
        breakdown: [],
        detectionSummary: { safetyEquipmentCount: 0, hazardCount: 0, trafficCount: 0, obstructionCount: 0 },
        thinkSummary: { contextualRiskCount: 0, highSeverityCount: 0, mediumSeverityCount: 0, lowSeverityCount: 0 },
      },
      educationalTips: ["顔や住所が写る写真は使わないようにしましょう"],
      analysisTimestamp: "2026-05-07T00:00:00.000Z",
    } as any)

    const { POST } = await import("@/app/api/safety-quest/private-practice/route")

    const res = await POST(makeJsonRequest("http://localhost/api/safety-quest/private-practice", {
      imageBase64: "data:image/png;base64,abc",
      userMarkers: [],
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.private).toBe(true)
    expect(body.pointsAwarded).toBeLessThanOrEqual(120)
    expect(JSON.stringify(body)).not.toContain("published")
  })
})
