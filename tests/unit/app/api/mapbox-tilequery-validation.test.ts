import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(),
}))

vi.mock("@/lib/upstash-rate-limiter", () => ({
  checkApiRateLimit: vi.fn(),
  rateLimitedResponse: vi.fn(),
}))

vi.mock("@/lib/routing/tilequery", () => ({
  tilequeryService: {
    queryMapFeatures: vi.fn(),
    findNearbyPOIs: vi.fn(),
    analyzeRoutePOIs: vi.fn(),
    findEmergencyServices: vi.fn(),
    analyzeTransportation: vi.fn(),
    findSafetyFeatures: vi.fn(),
    batchQueryFeatures: vi.fn(),
  },
}))

import { createServerClient } from "@/lib/supabase-server"
import { checkApiRateLimit } from "@/lib/upstash-rate-limiter"
import { tilequeryService } from "@/lib/routing/tilequery"

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/api/mapbox/tilequery", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("mapbox tilequery route validation", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.mocked(createServerClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as any)
    vi.mocked(checkApiRateLimit).mockResolvedValue({
      success: true,
      reset: Date.now() + 1000,
    } as any)
  })

  it("rejects unbounded radius and limit before calling Mapbox", async () => {
    const { POST } = await import("@/app/api/mapbox/tilequery/route")

    const res = await POST(makePostRequest({
      type: "findNearbyPOIs",
      location: [139.6917, 35.6895],
      radius: 999999,
      limit: 999,
    }))

    expect(res.status).toBe(400)
    expect(tilequeryService.findNearbyPOIs).not.toHaveBeenCalled()
  })

  it("passes only normalized GET tilequery options to the service", async () => {
    vi.mocked(tilequeryService.queryMapFeatures).mockResolvedValue({
      success: true,
      data: { type: "FeatureCollection", features: [] },
    } as any)
    const { GET } = await import("@/app/api/mapbox/tilequery/route")

    const res = await GET(
      new NextRequest(
        "http://localhost/api/mapbox/tilequery?coordinates=139.6917,35.6895&radius=5000&limit=50&layers=road,poi&geometry=point",
      ),
    )

    expect(res.status).toBe(200)
    expect(tilequeryService.queryMapFeatures).toHaveBeenCalledWith({
      coordinates: [139.6917, 35.6895],
      radius: 5000,
      layers: ["road", "poi"],
      limit: 50,
      dedupe: true,
      geometry: "point",
    })
  })

  it("rejects oversized route geometry before calling Mapbox", async () => {
    const { POST } = await import("@/app/api/mapbox/tilequery/route")
    const coordinates = Array.from({ length: 101 }, (_, index) => [
      139 + index * 0.001,
      35,
    ])

    const res = await POST(makePostRequest({
      type: "analyzeRoutePOIs",
      routeGeometry: { type: "LineString", coordinates },
      buffer: 500,
    }))

    expect(res.status).toBe(400)
    expect(tilequeryService.analyzeRoutePOIs).not.toHaveBeenCalled()
  })
})
