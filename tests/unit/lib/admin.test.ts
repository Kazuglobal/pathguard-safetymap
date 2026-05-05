import { afterEach, describe, expect, it } from "vitest"

import { isAdminEmail, isAdminUser } from "@/lib/admin"

describe("admin helpers", () => {
  afterEach(() => {
    delete process.env.ADMIN_EMAILS
  })

  it("authorizes only configured admin emails", () => {
    process.env.ADMIN_EMAILS = "globalbunny77@gmail.com, second@example.com"

    expect(isAdminEmail("globalbunny77@gmail.com")).toBe(true)
    expect(isAdminEmail("SECOND@example.com")).toBe(true)
    expect(isAdminEmail("member@example.com")).toBe(false)
  })

  it("does not treat caller-controlled role values as admin authority", () => {
    process.env.ADMIN_EMAILS = "globalbunny77@gmail.com"
    const callerControlledProfile = {
      email: "member@example.com",
      role: "admin",
    }

    expect(isAdminUser(callerControlledProfile)).toBe(false)
    expect(isAdminUser({ email: "globalbunny77@gmail.com" })).toBe(true)
  })
})
