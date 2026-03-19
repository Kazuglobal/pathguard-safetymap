import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockGenerateDisasterPrompts = vi.fn()
  const mockLogApiUsage = vi.fn()
  const mockSetContext = vi.fn()
  const mockAddBreadcrumb = vi.fn()

  return {
    mockGetUser,
    mockGenerateDisasterPrompts,
    mockLogApiUsage,
    mockSetContext,
    mockAddBreadcrumb,
  }
})

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.mockGetUser,
    },
  })),
}))

vi.mock("@/lib/gemini-prompts", () => ({
  generateDisasterPrompts: mocks.mockGenerateDisasterPrompts,
}))

vi.mock("@/lib/api-usage-logger", () => ({
  logApiUsage: mocks.mockLogApiUsage,
}))

vi.mock("@sentry/nextjs", () => ({
  setContext: mocks.mockSetContext,
  addBreadcrumb: mocks.mockAddBreadcrumb,
  captureException: vi.fn(),
}))

async function loadRoute() {
  vi.resetModules()
  return import("@/app/api/gemini/generate-prompts/route")
}

describe("app/api/gemini/generate-prompts route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })
    mocks.mockGenerateDisasterPrompts.mockResolvedValue({
      riskObservation: { elements: [], tableMarkdown: "" },
      vizPrompt: "prompt",
      simulationPrompts: {},
    })
  })

  it("adds Sentry upload context before reading multipart image data", async () => {
    const { POST } = await loadRoute()
    const form = new FormData()
    form.append("image", new File(["abcd"], "prompt.png", { type: "image/png" }))

    const response = await POST(
      new Request("http://localhost/api/gemini/generate-prompts", {
        method: "POST",
        body: form,
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(mocks.mockSetContext).toHaveBeenCalledWith(
      "upload_file",
      expect.objectContaining({
        route: "/api/gemini/generate-prompts",
        fieldName: "image",
        fileName: expect.any(String),
      }),
    )
    expect(mocks.mockAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "upload.read",
      }),
    )
  })
})
