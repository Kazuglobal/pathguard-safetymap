import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  slidingWindow: vi.fn(() => ({ kind: "sliding-window" })),
  limit: vi.fn(async () => ({ success: true, reset: Date.now() + 1_000 })),
  eval: vi.fn(async () => [1, 1]),
}))

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class FakeRatelimit {
    static slidingWindow = mocks.slidingWindow
    limit = mocks.limit
  },
}))

vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {
    eval = mocks.eval
  },
}))

describe("checkImageGenerationRateLimit", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.UPSTASH_REDIS_REST_URL = "https://example.invalid"
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token"
  })

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.IMAGE_GENERATION_RATE_LIMIT_REQUESTS
    delete process.env.IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS
    delete process.env.AI_DAILY_RATE_LIMIT
    delete process.env.MAPBOX_DAILY_RATE_LIMIT
    delete process.env.IMAGE_PROCESS_DAILY_RATE_LIMIT
  })

  it("allows the image window to be adjusted through bounded environment settings", async () => {
    process.env.IMAGE_GENERATION_RATE_LIMIT_REQUESTS = "7"
    process.env.IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS = "120"
    const { checkImageGenerationRateLimit } = await import(
      "@/lib/upstash-rate-limiter"
    )

    await checkImageGenerationRateLimit("generate-image:user-1")

    expect(mocks.slidingWindow).toHaveBeenCalledWith(7, "120 s")
  })

  it("uses a 20 request sliding window so the 14-image batch can complete", async () => {
    const { checkImageGenerationRateLimit } = await import(
      "@/lib/upstash-rate-limiter"
    )

    await checkImageGenerationRateLimit("hazard-image:user-1")

    expect(mocks.slidingWindow).toHaveBeenCalledWith(20, "300 s")
    expect(mocks.limit).toHaveBeenCalledWith("hazard-image:user-1")
  })

  it("keeps the existing allow-all fallback when Upstash is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    const { checkImageGenerationRateLimit } = await import(
      "@/lib/upstash-rate-limiter"
    )

    await expect(checkImageGenerationRateLimit("user-1")).resolves.toEqual({
      success: true,
    })
    expect(mocks.limit).not.toHaveBeenCalled()
  })
})

describe("checkPaidApiRateLimit", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useRealTimers()
    process.env.UPSTASH_REDIS_REST_URL = "https://example.invalid"
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token"
    mocks.limit.mockResolvedValue({ success: true, reset: Date.now() + 60_000 })
    mocks.eval.mockResolvedValue([1, 1])
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.AI_DAILY_RATE_LIMIT
    delete process.env.MAPBOX_DAILY_RATE_LIMIT
    delete process.env.IMAGE_PROCESS_DAILY_RATE_LIMIT
  })

  it.each([
    ["ai", 10],
    ["mapbox", 60],
    ["image-processing", 10],
  ] as const)("uses the %s minute limit", async (kind, perMinute) => {
    const { checkPaidApiRateLimit } = await import("@/lib/upstash-rate-limiter")

    await checkPaidApiRateLimit(kind, "user-1")

    expect(mocks.slidingWindow).toHaveBeenCalledWith(perMinute, "60 s")
    expect(mocks.limit).toHaveBeenCalledWith("user-1", { rate: 1 })
  })

  it("charges weighted provider-call units to both windows", async () => {
    const { checkPaidApiRateLimit } = await import("@/lib/upstash-rate-limiter")

    await checkPaidApiRateLimit("mapbox", "user-1", 10)

    expect(mocks.limit).toHaveBeenCalledWith("user-1", { rate: 10 })
    expect(mocks.eval).toHaveBeenCalledWith(
      expect.any(String),
      [expect.stringMatching(/^paid:daily:mapbox:\d{4}-\d{2}-\d{2}:user-1$/)],
      ["10", "300", expect.stringMatching(/^\d+$/)],
    )
  })

  it("allows daily limits to be lowered but not raised", async () => {
    process.env.AI_DAILY_RATE_LIMIT = "7"
    process.env.MAPBOX_DAILY_RATE_LIMIT = "9999"
    const { checkPaidApiRateLimit } = await import("@/lib/upstash-rate-limiter")

    await checkPaidApiRateLimit("ai", "user-1")
    await checkPaidApiRateLimit("mapbox", "user-1")

    expect(mocks.eval).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.any(Array),
      ["1", "7", expect.any(String)],
    )
    expect(mocks.eval).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.any(Array),
      ["1", "300", expect.any(String)],
    )
  })

  it("keys daily usage to the JST calendar day and resets at the next JST midnight", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-04T14:59:59.000Z"))
    const { checkPaidApiRateLimit } = await import("@/lib/upstash-rate-limiter")

    await checkPaidApiRateLimit("ai", "user-1")

    expect(mocks.eval).toHaveBeenCalledWith(
      expect.any(String),
      ["paid:daily:ai:2026-09-04:user-1"],
      ["1", "30", String(Date.parse("2026-09-04T15:00:00.000Z"))],
    )
  })

  it("returns the JST reset without incrementing when the daily cap is exceeded", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-09-04T01:00:00.000Z"))
    mocks.eval.mockResolvedValue([0, 30])
    const { checkPaidApiRateLimit } = await import("@/lib/upstash-rate-limiter")

    await expect(checkPaidApiRateLimit("ai", "user-1")).resolves.toEqual({
      success: false,
      reset: Date.parse("2026-09-04T15:00:00.000Z"),
    })
  })

  it("does not touch the daily counter when the minute window rejects", async () => {
    mocks.limit.mockResolvedValue({ success: false, reset: Date.now() + 60_000 })
    const { checkPaidApiRateLimit } = await import("@/lib/upstash-rate-limiter")

    await expect(checkPaidApiRateLimit("ai", "user-1")).resolves.toMatchObject({ success: false })
    expect(mocks.eval).not.toHaveBeenCalled()
  })

  it('does not reset to the previous day when the minute check crosses midnight', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T14:59:59Z'))
    mocks.limit.mockImplementationOnce(async () => {
      vi.setSystemTime(new Date('2026-09-04T15:00:01Z'))
      return { success: true, reset: Date.now() + 60_000 }
    })
    const { checkPaidApiRateLimit } = await import('@/lib/upstash-rate-limiter')
    await checkPaidApiRateLimit('ai', 'user-1')
    expect(mocks.eval).toHaveBeenCalledWith(expect.any(String), ['paid:daily:ai:2026-09-05:user-1'],
      ['1', '30', String(Date.parse('2026-09-05T15:00:00Z'))])
  })

  it('preserves allow-all when unconfigured without invoking either backend', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    const { checkPaidApiRateLimit } = await import('@/lib/upstash-rate-limiter')
    expect(await checkPaidApiRateLimit('ai', 'user-1')).toEqual({ success: true })
    expect(mocks.limit).not.toHaveBeenCalled()
    expect(mocks.eval).not.toHaveBeenCalled()
  })

  it('does not call Redis for a batch larger than the entire daily budget', async () => {
    process.env.MAPBOX_DAILY_RATE_LIMIT = '3'
    const { checkPaidApiRateLimit } = await import('@/lib/upstash-rate-limiter')
    expect(await checkPaidApiRateLimit('mapbox', 'user-1', 4)).toMatchObject({ success: false })
    expect(mocks.limit).not.toHaveBeenCalled()
    expect(mocks.eval).not.toHaveBeenCalled()
  })

  it('returns positive Retry-After even for expired reset times', async () => {
    const { rateLimitedResponse } = await import('@/lib/upstash-rate-limiter')
    expect(rateLimitedResponse(Date.now() - 1000).headers.get('Retry-After')).toBe('1')
  })

  it("rejects invalid cost values supplied by callers", async () => {
    const { checkPaidApiRateLimit } = await import("@/lib/upstash-rate-limiter")

    await expect(checkPaidApiRateLimit("mapbox", "user-1", 0)).rejects.toThrow(RangeError)
    expect(mocks.limit).not.toHaveBeenCalled()
  })
})
