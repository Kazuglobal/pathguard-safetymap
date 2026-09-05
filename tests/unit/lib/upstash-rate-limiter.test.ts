import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  slidingWindow: vi.fn(() => ({ kind: "sliding-window" })),
  limit: vi.fn(async () => ({ success: true, reset: Date.now() + 1_000 })),
  eval: vi.fn(async () => [1, 1]),
  moduleError: null as Error | null,
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}))

vi.mock("@upstash/ratelimit", () => ({
  get Ratelimit() {
    if (mocks.moduleError) throw mocks.moduleError
    return class FakeRatelimit {
      static slidingWindow = mocks.slidingWindow
      limit = mocks.limit
    }
  },
}))

vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {
    eval = mocks.eval
  },
}))

vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.captureException,
  captureMessage: mocks.captureMessage,
}))

describe("checkImageGenerationRateLimit", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.UPSTASH_REDIS_REST_URL = "https://example.invalid"
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token"
    mocks.moduleError = null
  })

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.IMAGE_GENERATION_RATE_LIMIT_REQUESTS
    delete process.env.IMAGE_GENERATION_RATE_LIMIT_WINDOW_SECONDS
    delete process.env.AI_DAILY_RATE_LIMIT
    delete process.env.MAPBOX_DAILY_RATE_LIMIT
    delete process.env.IMAGE_PROCESS_DAILY_RATE_LIMIT
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
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

  it("keeps allow-all outside production when Upstash is not configured and reports it", async () => {
    vi.stubEnv("NODE_ENV", "development")
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const { checkImageGenerationRateLimit } = await import(
      "@/lib/upstash-rate-limiter"
    )

    await expect(checkImageGenerationRateLimit("user-1")).resolves.toEqual({
      success: true,
    })
    expect(mocks.limit).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(mocks.captureMessage).toHaveBeenCalledTimes(1))
    consoleError.mockRestore()
  })

  it("fails closed for every limiter in production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production")
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    const {
      checkApiRateLimit,
      checkGeminiRateLimit,
      checkImageGenerationRateLimit,
      checkPaidApiRateLimit,
    } = await import("@/lib/upstash-rate-limiter")

    await expect(checkApiRateLimit("api:user-1")).resolves.toEqual({ success: false })
    await expect(checkGeminiRateLimit("gemini:user-1")).resolves.toEqual({ success: false })
    await expect(checkImageGenerationRateLimit("image:user-1")).resolves.toEqual({ success: false })
    await expect(checkPaidApiRateLimit("ai", "user-1")).resolves.toEqual({ success: false })
  })

  it.each([
    ['UPSTASH_REDIS_REST_URL', '   '],
    ['UPSTASH_REDIS_REST_TOKEN', '\t'],
  ])('fails closed in production when %s is blank', async (name, value) => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env[name] = value
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { checkApiRateLimit } = await import('@/lib/upstash-rate-limiter')

    await expect(checkApiRateLimit('api:user-1')).resolves.toEqual({ success: false })
    expect(mocks.limit).not.toHaveBeenCalled()
  })

  it("fails closed and reports once when an Upstash SDK import fails in production", async () => {
    vi.stubEnv("NODE_ENV", "production")
    mocks.moduleError = new Error("simulated module load failure")
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const { checkApiRateLimit } = await import("@/lib/upstash-rate-limiter")

    await expect(checkApiRateLimit("api:user-1")).resolves.toEqual({ success: false })
    await expect(checkApiRateLimit("api:user-2")).resolves.toEqual({ success: false })

    expect(consoleError).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(mocks.captureException).toHaveBeenCalledTimes(1))
    consoleError.mockRestore()
  })

  it("fails open and reports when an Upstash SDK import fails outside production", async () => {
    vi.stubEnv('NODE_ENV', 'development')
    mocks.moduleError = new Error('simulated module load failure')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { checkApiRateLimit } = await import('@/lib/upstash-rate-limiter')

    await expect(checkApiRateLimit('api:user-1')).resolves.toEqual({ success: true })
    expect(consoleError).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(mocks.captureException).toHaveBeenCalledTimes(1))
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
    mocks.moduleError = null
  })

  afterEach(() => {
    vi.useRealTimers()
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.AI_DAILY_RATE_LIMIT
    delete process.env.MAPBOX_DAILY_RATE_LIMIT
    delete process.env.IMAGE_PROCESS_DAILY_RATE_LIMIT
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
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

  it('preserves allow-all outside production when unconfigured without invoking either backend', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    delete process.env.UPSTASH_REDIS_REST_URL
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
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
