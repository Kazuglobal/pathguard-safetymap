import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockCheckLimit: vi.fn(),
}))

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.mockGetUser,
    },
  })),
}))

vi.mock("@/lib/rate-limiter", () => ({
  apiRateLimiter: {
    checkLimit: mocks.mockCheckLimit,
  },
}))

import { GET } from "@/app/api/xroad-proxy/route"

describe("xroad-proxy whitelist forwarding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
      error: null,
    })
    mocks.mockCheckLimit.mockResolvedValue({
      allowed: true,
      remainingRequests: 59,
      resetTime: Date.now() + 60_000,
    })
  })

  it("forwards allowed params including typeNames and drops unknown params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    })
    vi.stubGlobal("fetch", fetchMock)

    const req = new Request(
      "http://localhost/api/xroad-proxy?service=WFS&request=GetFeature&typeNames=t_travospublic_measure_5m&outputFormat=application/json&hack=1",
    )
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [calledUrl] = fetchMock.mock.calls[0] as [string, RequestInit]
    const url = new URL(calledUrl)
    expect(url.searchParams.get("typeNames")).toBe("t_travospublic_measure_5m")
    expect(url.searchParams.get("service")).toBe("WFS")
    expect(url.searchParams.get("hack")).toBeNull()
  })
})
