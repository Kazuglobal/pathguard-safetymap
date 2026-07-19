import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  slidingWindow: vi.fn(() => ({ kind: "sliding-window" })),
  limit: vi.fn(async () => ({ success: true, reset: Date.now() + 1_000 })),
}))

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class FakeRatelimit {
    static slidingWindow = mocks.slidingWindow
    limit = mocks.limit
  },
}))

vi.mock("@upstash/redis", () => ({
  Redis: class FakeRedis {},
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
