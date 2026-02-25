import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockGetRoadData: vi.fn(),
  mockGetTrafficData: vi.fn(),
}))

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.mockGetUser,
    },
  })),
}))

vi.mock("@/lib/api/xroad", () => ({
  getRoadData: mocks.mockGetRoadData,
  getTrafficData: mocks.mockGetTrafficData,
}))

import { GET } from "@/app/api/xroad/route"

describe("xroad route server proxy origin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
      error: null,
    })
  })

  it("passes request origin to getRoadData via proxyOrigin option", async () => {
    mocks.mockGetRoadData.mockResolvedValue({ type: "FeatureCollection", features: [] })

    const req = new NextRequest(
      "http://localhost/api/xroad?method=getRoadData&latitude=35.68&longitude=139.76&radius=1200",
    )
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ type: "FeatureCollection", features: [] })
    expect(mocks.mockGetRoadData).toHaveBeenCalledTimes(1)
    expect(mocks.mockGetRoadData).toHaveBeenCalledWith(
      35.68,
      139.76,
      1200,
      expect.any(String),
      "3",
      { proxyOrigin: "http://localhost" },
    )
  })
})
