import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockGenerateImage = vi.fn()
  const mockLogApiUsage = vi.fn()
  const mockCalculateImageGenerationCost = vi.fn(() => 0.01)
  const mockCalculateCost = vi.fn(() => 0)
  const mockSetContext = vi.fn()
  const mockAddBreadcrumb = vi.fn()
  const mockReadFileWithSentryContext = vi.fn(async () => new ArrayBuffer(4))

  return {
    mockGetUser,
    mockGenerateImage,
    mockLogApiUsage,
    mockCalculateImageGenerationCost,
    mockCalculateCost,
    mockSetContext,
    mockAddBreadcrumb,
    mockReadFileWithSentryContext,
  }
})

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.mockGetUser,
    },
  })),
}))

vi.mock("@/lib/gemini-image", () => ({
  generateImageWithGeminiWithModel: mocks.mockGenerateImage,
  FORCED_GEMINI_IMAGE_MODEL: "gemini-3.1-flash-lite-image",
}))

vi.mock("@/lib/api-usage-logger", () => ({
  logApiUsage: mocks.mockLogApiUsage,
}))

vi.mock("@/lib/api-cost-calculator", () => ({
  estimateImageGenerationCost: mocks.mockCalculateImageGenerationCost,
  calculateCost: mocks.mockCalculateCost,
}))

vi.mock("@/lib/sentry-upload-context", () => ({
  readFileWithSentryContext: mocks.mockReadFileWithSentryContext,
}))

vi.mock("@sentry/nextjs", () => ({
  setContext: mocks.mockSetContext,
  addBreadcrumb: mocks.mockAddBreadcrumb,
  captureException: vi.fn(),
}))

async function loadRoute() {
  vi.resetModules()
  return import("@/app/api/gemini/generate-image/route")
}

function buildMultipartRequest(generationMode: "standard" | "disaster") {
  const form = new FormData()
  form.append("prompt", "test prompt")
  form.append("generationMode", generationMode)
  return new Request("http://localhost/api/gemini/generate-image", {
    method: "POST",
    body: form,
  })
}

describe("app/api/gemini/generate-image route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })
    mocks.mockGenerateImage.mockResolvedValue({
      images: [],
      model: "gemini-3.1-flash-lite-image",
    })
  })

  it("always uses gemini-3.1-flash-lite-image when generationMode is standard", async () => {
    const { POST } = await loadRoute()
    const res = await POST(buildMultipartRequest("standard") as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.1-flash-lite-image" }),
    )
  })

  it("logs usage under the gemini provider without stale token fields", async () => {
    const { POST } = await loadRoute()
    await POST(buildMultipartRequest("standard") as any)

    expect(mocks.mockLogApiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        api_provider: "gemini",
        model_name: "gemini-3.1-flash-lite-image",
        success: true,
      }),
    )
    const loggedEntry = mocks.mockLogApiUsage.mock.calls[0][0]
    expect(loggedEntry.input_tokens).toBeUndefined()
    expect(loggedEntry.output_tokens).toBeUndefined()
  })

  it("always uses gemini-3.1-flash-lite-image when generationMode is disaster", async () => {
    const { POST } = await loadRoute()
    const res = await POST(buildMultipartRequest("disaster") as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.1-flash-lite-image" }),
    )
  })

  it("clears route timeout when generation fails before timeout fires", async () => {
    const originalSetTimeout = globalThis.setTimeout
    let timerHandle: ReturnType<typeof setTimeout> | undefined
    const setTimeoutSpy = vi
      .spyOn(globalThis, "setTimeout")
      .mockImplementation(((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
        const id = originalSetTimeout(handler as any, timeout as any, ...(args as any[]))
        timerHandle = id
        return id
      }) as any)
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout")

    mocks.mockGenerateImage.mockRejectedValueOnce(new Error("upstream failure"))

    const { POST } = await loadRoute()
    const res = await POST(buildMultipartRequest("standard") as any)

    expect(res.status).toBe(500)
    expect(timerHandle).toBeDefined()
    expect(
      clearTimeoutSpy.mock.calls.some(([id]) => id === timerHandle),
    ).toBe(true)

    setTimeoutSpy.mockRestore()
    clearTimeoutSpy.mockRestore()
  })

  it("always uses gemini-3.1-flash-lite-image when generationMode is omitted", async () => {
    const { POST } = await loadRoute()
    const form = new FormData()
    form.append("prompt", "test prompt")
    const request = new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    })
    const res = await POST(request as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.1-flash-lite-image" }),
    )
  })

  it("reads multipart image data through the Sentry context helper", async () => {
    const { POST } = await loadRoute()
    const file = {
      name: "input.png",
      type: "image/png",
      size: 4,
    }
    const request = {
      headers: new Headers({ "content-type": "multipart/form-data; boundary=test" }),
      formData: vi.fn(async () => ({
        get: (key: string) => key === "prompt" ? "test prompt" : key === "image" ? file : null,
      })),
    }

    const res = await POST(request as any)

    expect(res.status).toBe(200)
    expect(mocks.mockReadFileWithSentryContext).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/gemini/generate-image",
        fieldName: "image",
        file,
      }),
    )
  })
})
