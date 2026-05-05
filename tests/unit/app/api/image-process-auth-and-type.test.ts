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
  const mockSetContext = vi.fn()
  const mockAddBreadcrumb = vi.fn()
  const mockReadFileWithSentryContext = vi.fn()

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
    mockSetContext,
    mockAddBreadcrumb,
    mockReadFileWithSentryContext,
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

vi.mock("@sentry/nextjs", () => ({
  setContext: mocks.mockSetContext,
  addBreadcrumb: mocks.mockAddBreadcrumb,
  captureException: vi.fn(),
}))

vi.mock("@/lib/sentry-upload-context", () => ({
  readFileWithSentryContext: mocks.mockReadFileWithSentryContext,
}))

import { POST } from "@/app/api/image/process/route"

async function expectResponseStatus(response: Response, expectedStatus: number) {
  expect(response.status, await response.clone().text()).toBe(expectedStatus)
}

function createTestFile(fileName: string, type = "image/png"): File {
  return { name: fileName, type } as File
}

function createMultipartRequest(fields: Record<string, FormDataEntryValue | null>): Request {
  return {
    formData: vi.fn(async () => ({
      get: (key: string) => fields[key] ?? null,
    })),
  } as unknown as Request
}

describe("app/api/image/process ownership + imageType", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.mockStorageUpload.mockResolvedValue({ error: null })
    mocks.mockStorageGetPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/danger-reports/${path}` },
    }))
    mocks.mockStorageRemove.mockResolvedValue({ error: null })
    mocks.mockDbUpdateEq.mockResolvedValue({ error: null })
    mocks.mockReadFileWithSentryContext.mockResolvedValue(new ArrayBuffer(5))
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

    const response = await POST(createMultipartRequest({
      file: createTestFile("sample.png"),
      reportId: "report-123",
    }))
    await expectResponseStatus(response, 403)
    expect(mocks.mockStorageUpload).not.toHaveBeenCalled()
    expect(mocks.mockStorageRemove).not.toHaveBeenCalled()
  })

  it("does not trust caller-controlled user_metadata role for cross-user updates", async () => {
    mocks.mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-1",
          email: "user1@example.com",
          user_metadata: { role: "admin" },
        },
      },
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

    const response = await POST(createMultipartRequest({
      file: createTestFile("sample.png"),
      reportId: "report-123",
    }))

    await expectResponseStatus(response, 403)
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

    const response = await POST(createMultipartRequest({
      file: createTestFile("original.png"),
      reportId: "report-999",
      imageType: "original",
    }))
    await expectResponseStatus(response, 200)
    const body = await response.json()

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

    const response = await POST(createMultipartRequest({
      file: createTestFile("sample.png"),
      reportId: "missing-report",
    }))
    await expectResponseStatus(response, 404)
    const body = await response.json()

    expect(body.message).toContain("missing-report")
    expect(mocks.mockStorageUpload).not.toHaveBeenCalled()
  })

  it("delegates multipart image reads with route context", async () => {
    mocks.mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "owner-1", email: "owner@example.com" } },
      error: null,
    })
    mocks.mockDbMaybeSingle.mockResolvedValueOnce({
      data: {
        user_id: "owner-1",
        processed_image_urls: [],
        image_url: null,
      },
      error: null,
    })

    const response = await POST(createMultipartRequest({
      file: createTestFile("instrumented.png"),
      reportId: "report-ctx",
    }))

    await expectResponseStatus(response, 200)
    expect(mocks.mockReadFileWithSentryContext).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/image/process",
        fieldName: "file",
        file: expect.objectContaining({
          name: "instrumented.png",
        }),
      }),
    )
  })
})
