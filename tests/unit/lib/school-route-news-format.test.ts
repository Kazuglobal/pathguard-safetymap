import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { formatNewsDate } from "@/lib/school-route-news"

describe("formatNewsDate", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("formats recent timestamps as absolute dates instead of relative freshness labels", () => {
    vi.setSystemTime(new Date("2026-03-08T12:00:00+09:00"))

    expect(formatNewsDate("2026-03-08T11:30:00+09:00")).toBe("2026.03.08")
  })
})
