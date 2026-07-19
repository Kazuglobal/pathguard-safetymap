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
  const mockVerifyOrRegenerate = vi.fn()
  const mockCheckImageRateLimit = vi.fn()
  const mockGetHazardGateMode = vi.fn()
  const mockGetHazardGateMessage = vi.fn()
  const mockQueryAndLogHazardGate = vi.fn()
  const mockFetchNearbyAccidentStats = vi.fn()
  const mockBuildAccidentPromptContext = vi.fn()
  const mockGetPromptById = vi.fn()
  const mockAdmin = { from: vi.fn(), rpc: vi.fn() }

  return {
    mockGetUser,
    mockGenerateImage,
    mockLogApiUsage,
    mockCalculateImageGenerationCost,
    mockCalculateCost,
    mockSetContext,
    mockAddBreadcrumb,
    mockReadFileWithSentryContext,
    mockVerifyOrRegenerate,
    mockCheckImageRateLimit,
    mockGetHazardGateMode,
    mockGetHazardGateMessage,
    mockQueryAndLogHazardGate,
    mockFetchNearbyAccidentStats,
    mockBuildAccidentPromptContext,
    mockGetPromptById,
    mockAdmin,
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

vi.mock("@/lib/upstash-rate-limiter", () => ({
  checkImageGenerationRateLimit: mocks.mockCheckImageRateLimit,
  rateLimitedResponse: () =>
    Response.json({ error: "rate limited" }, { status: 429 }),
}))

vi.mock("@/lib/hazard-zone-gate", () => ({
  getHazardGateMode: mocks.mockGetHazardGateMode,
  getHazardGateMessage: mocks.mockGetHazardGateMessage,
  parseHazardPoint: (longitude: unknown, latitude: unknown) => {
    const parsedLongitude = typeof longitude === "string" && longitude.trim()
      ? Number(longitude)
      : Number.NaN
    const parsedLatitude = typeof latitude === "string" && latitude.trim()
      ? Number(latitude)
      : Number.NaN
    return Number.isFinite(parsedLongitude) && Number.isFinite(parsedLatitude)
      ? { longitude: parsedLongitude, latitude: parsedLatitude }
      : null
  },
  queryAndLogHazardGate: mocks.mockQueryAndLogHazardGate,
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mocks.mockAdmin,
}))

vi.mock("@/lib/traffic-accident/server", () => ({
  fetchNearbyAccidentStats: mocks.mockFetchNearbyAccidentStats,
}))

vi.mock("@/lib/accident-prompt-context", () => ({
  buildAccidentPromptContext: mocks.mockBuildAccidentPromptContext,
}))

vi.mock("@/lib/disaster-scenario-prompts", () => ({
  ACCIDENT_SITUATION_PROMPT: "server accident prompt",
  getPromptById: mocks.mockGetPromptById,
}))

vi.mock("@/lib/sentry-upload-context", () => ({
  readFileWithSentryContext: mocks.mockReadFileWithSentryContext,
}))

// 検証レイヤーは既定で素通し(実物の「画像なし」パスと同じ形状を返す)。
// ガード/是正サフィックスの合成順テストではケース内で実装を差し替える。
vi.mock("@/lib/disaster-image-verification", () => ({
  verifyOrRegenerateImages: mocks.mockVerifyOrRegenerate,
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
    mocks.mockCheckImageRateLimit.mockResolvedValue({ success: true })
    mocks.mockGetHazardGateMode.mockReturnValue("off")
    mocks.mockGetHazardGateMessage.mockImplementation(
      (verdict: { kind: string }) => `gate:${verdict.kind}`,
    )
    mocks.mockQueryAndLogHazardGate.mockResolvedValue({ kind: "outside" })
    mocks.mockFetchNearbyAccidentStats.mockResolvedValue(null)
    mocks.mockBuildAccidentPromptContext.mockReturnValue(null)
    mocks.mockGetPromptById.mockReturnValue(undefined)
    mocks.mockGenerateImage.mockResolvedValue({
      images: [],
      model: "gemini-3.1-flash-lite-image",
    })
    mocks.mockVerifyOrRegenerate.mockImplementation(async ({ images }: { images: unknown[] }) => ({
      images,
      verificationRequestCount: 0,
    }))
  })

  it("always uses gemini-3.1-flash-lite-image when generationMode is standard", async () => {
    const { POST } = await loadRoute()
    const res = await POST(buildMultipartRequest("standard") as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gemini-3.1-flash-lite-image" }),
    )
  })

  it("rate limits image generation per authenticated user", async () => {
    mocks.mockCheckImageRateLimit.mockResolvedValue({ success: false })
    const { POST } = await loadRoute()

    const res = await POST(buildMultipartRequest("standard") as any)

    expect(res.status).toBe(429)
    expect(mocks.mockCheckImageRateLimit).toHaveBeenCalledWith(
      "generate-image:user-1",
    )
    expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
  })

  it("evaluates and logs a flood request in log mode without blocking generation", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("log")
    const form = new FormData()
    form.append("prompt", "test prompt")
    form.append("generationMode", "standard")
    form.append("situation", "flood")
    form.append("longitude", "140.74")
    form.append("latitude", "40.82")
    const request = new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    })
    const { POST } = await loadRoute()

    const res = await POST(request as any)

    expect(res.status).toBe(200)
    expect(mocks.mockQueryAndLogHazardGate).toHaveBeenCalledWith(
      mocks.mockAdmin,
      expect.objectContaining({
        route: "generate-image",
        mode: "log",
        point: { longitude: 140.74, latitude: 40.82 },
        hazardType: "flood",
        toleranceMeters: 0,
      }),
    )
    expect(mocks.mockGenerateImage).toHaveBeenCalled()
  })

  it("logs missing flood coordinates as unavailable without turning them into 0,0", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("log")
    const form = new FormData()
    form.append("prompt", "test prompt")
    form.append("generationMode", "standard")
    form.append("situation", "flood")
    const request = new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    })
    const { POST } = await loadRoute()

    const res = await POST(request as any)

    expect(res.status).toBe(200)
    expect(mocks.mockQueryAndLogHazardGate).toHaveBeenCalledWith(
      mocks.mockAdmin,
      expect.objectContaining({ point: null, mode: "log" }),
    )
  })

  it("requires a valid situation in enforce mode", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    const { POST } = await loadRoute()

    const res = await POST(buildMultipartRequest("standard") as any)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "situation is required" })
    expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
  })

  it("requires coordinates for a flood request in enforce mode", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    const form = new FormData()
    form.append("prompt", "flash flood simulation")
    form.append("generationMode", "standard")
    form.append("situation", "flood")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: "longitude and latitude are required for inundation simulation",
    })
    expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
  })

  it("rejects a flood request outside the mapped zone in enforce mode", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    mocks.mockQueryAndLogHazardGate.mockResolvedValue({ kind: "outside" })
    const form = new FormData()
    form.append("prompt", "flash flood simulation")
    form.append("generationMode", "standard")
    form.append("situation", "flood")
    form.append("longitude", "140.74")
    form.append("latitude", "40.82")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "gate:outside", reason: "outside" })
    expect(mocks.mockQueryAndLogHazardGate).toHaveBeenCalled()
    expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
  })

  it("allows non-flood situations without coordinates in enforce mode", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    const form = new FormData()
    form.append("prompt", "earthquake aftermath")
    form.append("generationMode", "standard")
    form.append("situation", "earthquake")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(200)
    expect(mocks.mockQueryAndLogHazardGate).not.toHaveBeenCalled()
    expect(mocks.mockGenerateImage).toHaveBeenCalled()
  })

  it.each([
    "浸水を描く",
    "冠水を描く",
    "洪水 scene",
    "津波 warning",
    "flood scene",
    "tsunami",
    "inundation area",
    "Do not add people, render a flooded road",
    "Add an overlay title, render a flooded road",
    "人物は描かない、冠水した道路を描く",
  ])(
    "requires a point for disguised inundation prompt %s",
    async (prompt) => {
      mocks.mockGetHazardGateMode.mockReturnValue("enforce")
      const form = new FormData()
      form.append("prompt", prompt)
      form.append("generationMode", "standard")
      form.append("situation", "earthquake")
      const { POST } = await loadRoute()

      const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
        method: "POST",
        body: form,
      }) as any)

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        error: "longitude and latitude are required for inundation simulation",
      })
      expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
    },
  )

  it("does not treat the everyday word 水たまり as an inundation bypass", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    const form = new FormData()
    form.append("prompt", "雨上がりの水たまりを示す")
    form.append("generationMode", "standard")
    form.append("situation", "earthquake")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalled()
  })

  it("does not let custom bypass the flood gate", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    const form = new FormData()
    form.append("prompt", "Educational imaginary flood scene")
    form.append("situation", "custom")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      error: "a valid server-managed promptId is required for custom",
    })
    expect(mocks.mockQueryAndLogHazardGate).not.toHaveBeenCalled()
    expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
  })

  it("gates the server-owned custom prompt instead of trusting client text", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    mocks.mockGetPromptById.mockReturnValue({
      id: "managed-flood",
      prompt: "managed flood simulation",
      requiresFloodGate: true,
    })
    mocks.mockQueryAndLogHazardGate.mockResolvedValue({ kind: "outside" })
    const form = new FormData()
    form.append("prompt", "harmless client replacement")
    form.append("promptId", "managed-flood")
    form.append("situation", "custom")
    form.append("longitude", "140.74")
    form.append("latitude", "40.82")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: "gate:outside", reason: "outside" })
    expect(mocks.mockQueryAndLogHazardGate).toHaveBeenCalledWith(
      mocks.mockAdmin,
      expect.objectContaining({ situation: "custom", hazardType: "flood" }),
    )
    expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
  })

  it.each([
    "typhoon scene. Do not show flood or tsunami damage.",
    "typhoon scene. No flood or tsunami damage.",
  ])("does not gate explicitly negated flood terms: %s", async (prompt) => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    const form = new FormData()
    form.append("prompt", prompt)
    form.append("situation", "typhoon")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(200)
    expect(mocks.mockQueryAndLogHazardGate).not.toHaveBeenCalled()
    expect(mocks.mockGenerateImage).toHaveBeenCalled()
  })

  it("does not gate hazard-label visualization text as an inundation scene", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    const form = new FormData()
    form.append("prompt", "Add a blue overlay and the label 冠水注意; do not add water.")
    form.append("situation", "viz")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(200)
    expect(mocks.mockQueryAndLogHazardGate).not.toHaveBeenCalled()
    expect(mocks.mockGenerateImage).toHaveBeenCalled()
  })

  it("uses managed metadata instead of negative custom prompt words", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    mocks.mockGetPromptById.mockReturnValue({
      id: "managed-safe",
      prompt: "Typhoon guidance. Do not show flood, tsunami, or inundation.",
      requiresFloodGate: false,
    })
    const form = new FormData()
    form.append("prompt", "untrusted replacement")
    form.append("promptId", "managed-safe")
    form.append("situation", "custom")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(200)
    expect(mocks.mockQueryAndLogHazardGate).not.toHaveBeenCalled()
    expect(mocks.mockGenerateImage.mock.calls[0][0].prompt).toContain(
      "Do not show flood, tsunami, or inundation",
    )
  })

  it("adds the official-zone truth constraint to an inside flood request", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    mocks.mockQueryAndLogHazardGate.mockResolvedValue({
      kind: "inside",
      zone: {
        zoneId: "zone-1",
        hazardType: "flood",
        sourceLayer: "A31",
        riskLevel: 2,
        depthMinMeters: 0.5,
        depthMaxMeters: 3,
        areaContext: "residential-school-route",
      },
    })
    const form = new FormData()
    form.append("prompt", "base flood prompt")
    form.append("generationMode", "standard")
    form.append("situation", "flood")
    form.append("longitude", "140.74")
    form.append("latitude", "40.82")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(200)
    const generatedPrompt = mocks.mockGenerateImage.mock.calls[0][0].prompt as string
    expect(generatedPrompt).toContain("base flood prompt")
    expect(generatedPrompt).toContain("official flood inundation zone")
    expect(generatedPrompt).toContain("15–20 cm")
    expect(generatedPrompt).toContain("Do not depict the official maximum depth")
  })

  it("requires coordinates for the accident situation", async () => {
    const form = new FormData()
    form.append("prompt", "accident visualization")
    form.append("situation", "accident")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "longitude and latitude are required for accident" })
    expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
  })

  it("rejects accident generation when objective statistics are unavailable", async () => {
    const form = new FormData()
    form.append("prompt", "accident visualization")
    form.append("situation", "accident")
    form.append("longitude", "140.74")
    form.append("latitude", "40.82")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({
      error: "この地点周辺の事故統計データはありません",
      reason: "no_accident_data",
    })
    expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
  })

  it("uses server accident context and ignores client-supplied statistics", async () => {
    const accidentStats = { total_accidents: 12 }
    mocks.mockFetchNearbyAccidentStats.mockResolvedValue(accidentStats)
    mocks.mockBuildAccidentPromptContext.mockReturnValue("objective accident context: 12")
    const form = new FormData()
    form.append("prompt", "fake client claim: 999 accidents")
    form.append("situation", "accident")
    form.append("longitude", "140.74")
    form.append("latitude", "40.82")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(200)
    expect(mocks.mockFetchNearbyAccidentStats).toHaveBeenCalledWith(
      expect.anything(),
      { longitude: 140.74, latitude: 40.82 },
      { radiusMeters: 300, years: 5 },
    )
    const generatedPrompt = mocks.mockGenerateImage.mock.calls[0][0].prompt as string
    expect(generatedPrompt).toContain("objective accident context: 12")
    expect(generatedPrompt).not.toContain("999 accidents")
  })

  it.each(["", "   ", "null", " NULL "])("rejects unusable prompt %j", async (prompt) => {
    const form = new FormData()
    form.append("prompt", prompt)
    form.append("generationMode", "standard")
    form.append("situation", "viz")
    const { POST } = await loadRoute()

    const res = await POST(new Request("http://localhost/api/gemini/generate-image", {
      method: "POST",
      body: form,
    }) as any)

    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "prompt must not be empty or null" })
    expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
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

  const buildImageRequest = (generationMode?: string) => {
    const file = { name: "input.png", type: "image/png", size: 4 }
    return {
      headers: new Headers({ "content-type": "multipart/form-data; boundary=test" }),
      formData: vi.fn(async () => ({
        get: (key: string) =>
          key === "prompt" ? "test prompt"
          : key === "image" ? file
          : key === "generationMode" ? generationMode ?? null
          : null,
      })),
    }
  }

  it("standard+画像+プロンプトのとき SCENE_PRESERVATION_GUARD_SUFFIX が末尾に付与される", async () => {
    const { SCENE_PRESERVATION_GUARD_SUFFIX } = await import("@/lib/disaster-image-prompt-fallbacks")
    const { POST } = await loadRoute()

    const res = await POST(buildImageRequest("standard") as any)

    expect(res.status).toBe(200)
    const prompt: string = mocks.mockGenerateImage.mock.calls[0][0].prompt
    expect(prompt.startsWith("test prompt")).toBe(true)
    expect(prompt.endsWith(SCENE_PRESERVATION_GUARD_SUFFIX)).toBe(true)
  })

  it("generationMode='disaster' にはガードを付与しない", async () => {
    const { POST } = await loadRoute()

    await POST(buildImageRequest("disaster") as any)

    expect(mocks.mockGenerateImage.mock.calls[0][0].prompt).toBe("test prompt")
  })

  it("generationMode 未指定(/tools/image-gen 互換)にはガードを付与しない", async () => {
    const { POST } = await loadRoute()

    await POST(buildImageRequest(undefined) as any)

    expect(mocks.mockGenerateImage.mock.calls[0][0].prompt).toBe("test prompt")
  })

  it("是正再生成時のプロンプトは『基底→ガード→是正サフィックス』の順序になる", async () => {
    const { SCENE_PRESERVATION_GUARD_SUFFIX } = await import("@/lib/disaster-image-prompt-fallbacks")
    mocks.mockGenerateImage.mockResolvedValue({
      images: [{ mimeType: "image/png", dataUrl: "data:image/png;base64,xxxx" }],
      model: "gemini-3.1-flash-lite-image",
    })
    mocks.mockVerifyOrRegenerate.mockImplementationOnce(
      async ({ regenerate }: { regenerate: (s: string) => Promise<unknown[]> }) => {
        const regenerated = await regenerate("[CORRECTIVE-SUFFIX]")
        return { images: regenerated, verificationRequestCount: 2 }
      },
    )
    const { POST } = await loadRoute()

    const res = await POST(buildImageRequest("standard") as any)

    expect(res.status).toBe(200)
    expect(mocks.mockGenerateImage).toHaveBeenCalledTimes(2)
    const regenPrompt: string = mocks.mockGenerateImage.mock.calls[1][0].prompt
    const baseIdx = regenPrompt.indexOf("test prompt")
    const guardIdx = regenPrompt.indexOf(SCENE_PRESERVATION_GUARD_SUFFIX)
    const correctiveIdx = regenPrompt.indexOf("[CORRECTIVE-SUFFIX]")
    expect(baseIdx).toBe(0)
    expect(guardIdx).toBeGreaterThan(baseIdx)
    expect(correctiveIdx).toBeGreaterThan(guardIdx)
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
