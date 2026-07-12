import { describe, expect, it } from "vitest"
import { getSafeNextPath } from "@/lib/auth/safe-next"

describe("getSafeNextPath", () => {
  it("keeps an internal path with its query", () => {
    expect(getSafeNextPath("/admin/reports?status=pending")).toBe("/admin/reports?status=pending")
  })

  it.each(["https://example.com", "//example.com", "/\\example.com", "dashboard"])(
    "rejects unsafe next value %s",
    (value) => {
      expect(getSafeNextPath(value)).toBe("/map")
    },
  )

  it("uses the first value when Next.js supplies an array", () => {
    expect(getSafeNextPath(["/report", "/map"])).toBe("/report")
  })
})
