import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import {
  createSafeSupabaseFetch,
  isAbortLikeFetchError,
} from "@/components/providers/supabase-provider"

describe("isAbortLikeFetchError", () => {
  it("returns true for DOM AbortError", () => {
    const error = new DOMException("signal is aborted without reason", "AbortError")
    expect(isAbortLikeFetchError(error)).toBe(true)
  })

  it("returns true for abort-like message", () => {
    const error = new Error("The operation was aborted")
    expect(isAbortLikeFetchError(error)).toBe(true)
  })

  it("returns false for generic errors", () => {
    const error = new Error("fetch failed")
    expect(isAbortLikeFetchError(error)).toBe(false)
  })
})

describe("createSafeSupabaseFetch", () => {
  const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

  beforeEach(() => {
    warnSpy.mockClear()
  })

  afterEach(() => {
    warnSpy.mockClear()
  })

  it("does not log and rethrows on abort", async () => {
    const abortError = new DOMException("signal is aborted without reason", "AbortError")
    const baseFetch = vi.fn().mockRejectedValue(abortError)
    const safeFetch = createSafeSupabaseFetch(baseFetch as unknown as typeof fetch)

    await expect(safeFetch("https://example.com")).rejects.toBe(abortError)
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it("logs and returns 503 response on non-abort fetch failures", async () => {
    const networkError = new TypeError("Failed to fetch")
    const baseFetch = vi.fn().mockRejectedValue(networkError)
    const safeFetch = createSafeSupabaseFetch(baseFetch as unknown as typeof fetch)

    const response = await safeFetch("https://example.com")
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: "network_error",
      message: "Supabase fetch failed",
    })
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })
})
