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

  // ドット区間で解決後に "//evil.com"(プロトコル相対URL)になる値も拒否する(2026-10-29 レビュー指摘)
  it.each(["/.//evil.example.com", "/a/..//evil.example.com"])(
    "rejects a dot-segment value that resolves to another site: %s",
    (value) => {
      const result = getSafeNextPath(value)
      expect(result.startsWith("//")).toBe(false)
      expect(result).toBe("/map")
    },
  )

  it("uses the first value when Next.js supplies an array", () => {
    expect(getSafeNextPath(["/report", "/map"])).toBe("/report")
  })
})
