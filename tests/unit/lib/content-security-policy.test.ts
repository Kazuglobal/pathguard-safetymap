import { describe, expect, it } from "vitest"

import { buildContentSecurityPolicy } from "@/lib/content-security-policy.mjs"

describe("buildContentSecurityPolicy", () => {
  it("allows MLIT hazard tiles in connect-src and img-src", () => {
    const policy = buildContentSecurityPolicy()

    expect(policy).toContain("img-src 'self' data: blob: https://disaportaldata.gsi.go.jp")
    expect(policy).toContain("connect-src 'self' https://disaportaldata.gsi.go.jp")
  })
})
