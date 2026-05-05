import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGetCurrentUserAdminStatus = vi.hoisted(() => vi.fn())

vi.mock("@/lib/admin-auth", () => ({
  getCurrentUserAdminStatus: mockGetCurrentUserAdminStatus,
}))

import { GET } from "@/app/api/auth/admin-status/route"

describe("app/api/auth/admin-status", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns the server-derived admin status without exposing admin emails", async () => {
    mockGetCurrentUserAdminStatus.mockResolvedValueOnce({
      isAuthenticated: true,
      isAdmin: true,
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(body).toEqual({
      isAuthenticated: true,
      isAdmin: true,
    })
  })
})
