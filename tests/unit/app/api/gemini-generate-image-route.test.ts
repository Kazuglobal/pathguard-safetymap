import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockGenerateImage = vi.fn()
  const mockGetImageModel = vi.fn(() => "gemini-default-model")
  const mockLogApiUsage = vi.fn()
  const mockEstimateImageGenerationCost = vi.fn(() => 0.01)

  return {
    mockGetUser,
    mockGenerateImage,
    mockGetImageModel,
    mockLogApiUsage,
    mockEstimateImageGenerationCost,
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
  getImageModel: mocks.mockGetImageModel,
}))

vi.mock("@/lib/api-usage-logger", () => ({
  logApiUsage: mocks.mockLogApiUsage,
}))

vi.mock("@/lib/api-cost-calculator", () => ({
  estimateImageGenerationCost: mocks.mockEstimateImageGenerationCost,
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
  const originalStandardEnv = process.env.GEMINI_STANDARD_IMAGE_MODEL
  const originalDisasterEnv = process.env.GEMINI_DISASTER_IMAGE_MODEL

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })
    mocks.mockGenerateImage.mockResolvedValue({
      images: [],
      model: "gemini-3.1-flash-image-preview",
    })
    process.env.GEMINI_STANDARD_IMAGE_MODEL = "env-standard-model"
    process.env.GEMINI_DISASTER_IMAGE_MODEL = "env-disaster-model"
  })

  it("uses standard env model when generationMode is standard", async () => {
    const { POST } = await loadRoute()
    const res = await POST(buildMultipartRequest("standard") as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "env-standard-model" }),
    )
  })

  it("uses disaster env model when generationMode is disaster", async () => {
    const { POST } = await loadRoute()
    const res = await POST(buildMultipartRequest("disaster") as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "env-disaster-model" }),
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

  afterEach(() => {
    process.env.GEMINI_STANDARD_IMAGE_MODEL = originalStandardEnv
    process.env.GEMINI_DISASTER_IMAGE_MODEL = originalDisasterEnv
  })
})
