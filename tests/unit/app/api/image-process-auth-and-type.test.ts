import { beforeEach, describe, expect, it, vi } from "vitest"

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key"
})

const mocks = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockStorageUpload = vi.fn()
  const mockStorageGetPublicUrl = vi.fn()
  const mockStorageRemove = vi.fn()

  const mockDbMaybeSingle = vi.fn()
  const mockDbUpdate = vi.fn()
  const mockDbUpdateEq = vi.fn()

  const mockStorageFrom = vi.fn(() => ({
    upload: mockStorageUpload,
    getPublicUrl: mockStorageGetPublicUrl,
    remove: mockStorageRemove,
  }))

  const mockDbFrom = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: mockDbMaybeSingle,
      })),
    })),
    update: mockDbUpdate,
  }))

  mockDbUpdate.mockImplementation(() => ({
    eq: mockDbUpdateEq,
  }))

  const mockAdminClient = {
    storage: {
      from: mockStorageFrom,
    },
    from: mockDbFrom,
  }

  return {
    mockGetUser,
    mockStorageUpload,
    mockStorageGetPublicUrl,
    mockStorageRemove,
    mockDbMaybeSingle,
    mockDbUpdate,
    mockDbUpdateEq,
    mockStorageFrom,
    mockDbFrom,
    mockAdminClient,
  }
})

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.mockGetUser,
    },
  })),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => mocks.mockAdminClient),
}))

import { POST } from "@/app/api/image/process/route"

describe("app/api/image/process ownership + imageType", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.mockStorageUpload.mockResolvedValue({ error: null })
    mocks.mockStorageGetPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/danger-reports/${path}` },
    }))
    mocks.mockStorageRemove.mockResolvedValue({ error: null })
    mocks.mockDbUpdateEq.mockResolvedValue({ error: null })
  })

  it("returns 403 when report owner and requester do not match", async () => {
    mocks.mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "user1@example.com" } },
      error: null,
    })
    mocks.mockDbMaybeSingle.mockResolvedValueOnce({
      data: {
        user_id: "user-2",
        processed_image_urls: [],
        image_url: null,
      },
      error: null,
    })

    const formData = new FormData()
    formData.append("file", new File(["dummy"], "sample.png", { type: "image/png" }))
    formData.append("reportId", "report-123")

    const response = await POST(
      new Request("http://localhost/api/image/process", {
        method: "POST",
        body: formData,
      }),
    )
    expect(response.status).toBe(403)
    expect(mocks.mockStorageUpload).not.toHaveBeenCalled()
    expect(mocks.mockStorageRemove).not.toHaveBeenCalled()
  })

  it("updates image_url when imageType=original", async () => {
    mocks.mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "owner-1", email: "owner@example.com" } },
      error: null,
    })
    mocks.mockDbMaybeSingle.mockResolvedValueOnce({
      data: {
        user_id: "owner-1",
        processed_image_urls: ["https://example.com/old-processed.png"],
        image_url: null,
      },
      error: null,
    })

    const formData = new FormData()
    formData.append("file", new File(["dummy"], "original.png", { type: "image/png" }))
    formData.append("reportId", "report-999")
    formData.append("imageType", "original")

    const response = await POST(
      new Request("http://localhost/api/image/process", {
        method: "POST",
        body: formData,
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.mockStorageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^owner-1\/report-999\//),
      expect.any(Buffer),
      expect.any(Object),
    )
    expect(mocks.mockDbUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: expect.stringContaining("https://example.supabase.co/storage/v1/object/public/danger-reports/"),
      }),
    )
    expect(body).toEqual(
      expect.objectContaining({
        imageUrl: expect.stringContaining("https://example.supabase.co/storage/v1/object/public/danger-reports/"),
      }),
    )
  })

  it("returns 404 when report does not exist", async () => {
    mocks.mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "owner-1", email: "owner@example.com" } },
      error: null,
    })
    mocks.mockDbMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    })

    const formData = new FormData()
    formData.append("file", new File(["dummy"], "sample.png", { type: "image/png" }))
    formData.append("reportId", "missing-report")

    const response = await POST(
      new Request("http://localhost/api/image/process", {
        method: "POST",
        body: formData,
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body.message).toContain("missing-report")
    expect(mocks.mockStorageUpload).not.toHaveBeenCalled()
  })
})
