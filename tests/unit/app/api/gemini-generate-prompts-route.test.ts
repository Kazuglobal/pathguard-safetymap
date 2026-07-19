// @vitest-environment node
// API ルート（runtime = "nodejs"）の multipart/form-data 解析には undici ネイティブの
// File/Request/formData() が必要。jsdom 環境では req.formData() が例外を投げ、ルートの
// フォールバック分岐に落ちて Sentry コンテキスト設定まで到達しないため node 環境で実行する。
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockGenerateDisasterPrompts = vi.fn()
  const mockLogApiUsage = vi.fn()
  const mockSetContext = vi.fn()
  const mockAddBreadcrumb = vi.fn()
  const mockCheckApiRateLimit = vi.fn()
  const mockGetHazardGateMode = vi.fn()
  const mockQueryHazardGate = vi.fn()
  const mockLogHazardGateVerdict = vi.fn()
  const mockFetchNearbyAccidentStats = vi.fn()
  const mockBuildAccidentPromptContext = vi.fn()
  const mockIsAccidentImageContextEnabled = vi.fn()
  const mockAdmin = { from: vi.fn(), rpc: vi.fn() }

  return {
    mockGetUser,
    mockGenerateDisasterPrompts,
    mockLogApiUsage,
    mockSetContext,
    mockAddBreadcrumb,
    mockCheckApiRateLimit,
    mockGetHazardGateMode,
    mockQueryHazardGate,
    mockLogHazardGateVerdict,
    mockFetchNearbyAccidentStats,
    mockBuildAccidentPromptContext,
    mockIsAccidentImageContextEnabled,
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

vi.mock("@/lib/gemini-prompts", () => ({
  generateDisasterPrompts: mocks.mockGenerateDisasterPrompts,
}))

vi.mock("@/lib/api-usage-logger", () => ({
  logApiUsage: mocks.mockLogApiUsage,
}))

vi.mock("@/lib/upstash-rate-limiter", () => ({
  checkApiRateLimit: mocks.mockCheckApiRateLimit,
  rateLimitedResponse: () =>
    Response.json({ error: "rate limited" }, { status: 429 }),
}))

vi.mock("@/lib/hazard-zone-gate", () => ({
  getHazardGateMode: mocks.mockGetHazardGateMode,
  queryHazardGate: mocks.mockQueryHazardGate,
  logHazardGateVerdict: mocks.mockLogHazardGateVerdict,
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => mocks.mockAdmin,
}))

vi.mock("@/lib/traffic-accident/server", () => ({
  fetchNearbyAccidentStats: mocks.mockFetchNearbyAccidentStats,
}))

vi.mock("@/lib/accident-prompt-context", () => ({
  buildAccidentPromptContext: mocks.mockBuildAccidentPromptContext,
  isAccidentImageContextEnabled: mocks.mockIsAccidentImageContextEnabled,
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
    mocks.mockCheckApiRateLimit.mockResolvedValue({ success: true })
    mocks.mockGetHazardGateMode.mockReturnValue("off")
    mocks.mockQueryHazardGate.mockResolvedValue({ kind: "outside" })
    mocks.mockLogHazardGateVerdict.mockResolvedValue(undefined)
    mocks.mockFetchNearbyAccidentStats.mockResolvedValue(null)
    mocks.mockBuildAccidentPromptContext.mockReturnValue(null)
    mocks.mockIsAccidentImageContextEnabled.mockReturnValue(false)
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

  it("rate limits prompt generation per authenticated user", async () => {
    mocks.mockCheckApiRateLimit.mockResolvedValue({ success: false })
    const { POST } = await loadRoute()
    const form = new FormData()
    form.append("image", new File(["abcd"], "prompt.png", { type: "image/png" }))

    const response = await POST(
      new Request("http://localhost/api/gemini/generate-prompts", {
        method: "POST",
        body: form,
      }) as any,
    )

    expect(response.status).toBe(429)
    expect(mocks.mockCheckApiRateLimit).toHaveBeenCalledWith(
      "generate-prompts:user-1",
    )
    expect(mocks.mockGenerateDisasterPrompts).not.toHaveBeenCalled()
  })

  it("evaluates and logs flood availability from supplied coordinates in log mode", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("log")
    const { POST } = await loadRoute()

    const response = await POST(
      new Request("http://localhost/api/gemini/generate-prompts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64: "AAAA",
          longitude: 140.74,
          latitude: 40.82,
        }),
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(mocks.mockQueryHazardGate).toHaveBeenCalledWith(
      mocks.mockAdmin,
      { longitude: 140.74, latitude: 40.82 },
      "flood",
      { toleranceMeters: 0 },
    )
    expect(mocks.mockLogHazardGateVerdict).toHaveBeenCalledWith(
      mocks.mockAdmin,
      expect.objectContaining({
        route: "generate-prompts",
        mode: "log",
        situation: "flood",
        verdict: { kind: "outside" },
      }),
    )
  })

  it("returns a null flood prompt outside the mapped zone in enforce mode", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    mocks.mockQueryHazardGate.mockResolvedValue({ kind: "outside" })
    mocks.mockGenerateDisasterPrompts.mockResolvedValue({
      riskObservation: { elements: [], tableMarkdown: "" },
      vizPrompt: "viz prompt",
      simulationPrompts: {
        earthquake: "earthquake prompt",
        typhoon: "typhoon prompt",
        flood: "flood prompt",
        fire: "fire prompt",
      },
    })
    const { POST } = await loadRoute()

    const response = await POST(
      new Request("http://localhost/api/gemini/generate-prompts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64: "AAAA",
          longitude: 140.74,
          latitude: 40.82,
        }),
      }) as any,
    )

    expect(response.status).toBe(200)
    expect((await response.json()).prompts.simulationPrompts).toEqual({
      earthquake: "earthquake prompt",
      typhoon: "typhoon prompt",
      flood: null,
      fire: "fire prompt",
    })
  })

  it("adds the official-zone fact while preserving the shallow flood depiction cap", async () => {
    mocks.mockGetHazardGateMode.mockReturnValue("enforce")
    mocks.mockQueryHazardGate.mockResolvedValue({
      kind: "inside",
      zone: {
        zoneId: "zone-1",
        hazardType: "flood",
        sourceLayer: "A31",
        riskLevel: 2,
        depthMinMeters: 0.5,
        depthMaxMeters: 3,
        areaContext: "urban",
      },
    })
    mocks.mockGenerateDisasterPrompts.mockResolvedValue({
      riskObservation: { elements: [], tableMarkdown: "" },
      vizPrompt: "viz prompt",
      simulationPrompts: {
        earthquake: "earthquake prompt",
        typhoon: "typhoon prompt",
        flood: "base flood prompt",
        fire: "fire prompt",
      },
    })
    const { POST } = await loadRoute()

    const response = await POST(
      new Request("http://localhost/api/gemini/generate-prompts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64: "AAAA",
          longitude: 140.74,
          latitude: 40.82,
        }),
      }) as any,
    )

    expect(response.status).toBe(200)
    const floodPrompt = (await response.json()).prompts.simulationPrompts.flood
    expect(floodPrompt).toContain("base flood prompt")
    expect(floodPrompt).toContain("official flood inundation zone")
    expect(floodPrompt).toContain("15–20 cm")
    expect(floodPrompt).toContain("Do not depict the official maximum depth")
  })

  it("injects server-fetched accident context when enabled and coordinates are supplied", async () => {
    mocks.mockIsAccidentImageContextEnabled.mockReturnValue(true)
    const accidentStats = { total_accidents: 12 }
    mocks.mockFetchNearbyAccidentStats.mockResolvedValue(accidentStats)
    mocks.mockBuildAccidentPromptContext.mockReturnValue("objective accident context")
    const { POST } = await loadRoute()

    const response = await POST(
      new Request("http://localhost/api/gemini/generate-prompts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64: "AAAA",
          longitude: 140.74,
          latitude: 40.82,
        }),
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(mocks.mockFetchNearbyAccidentStats).toHaveBeenCalledWith(
      expect.anything(),
      { longitude: 140.74, latitude: 40.82 },
      { radiusMeters: 300, years: 5 },
    )
    expect(mocks.mockBuildAccidentPromptContext).toHaveBeenCalledWith(accidentStats)
    expect(mocks.mockGenerateDisasterPrompts).toHaveBeenCalledWith(
      "AAAA",
      expect.objectContaining({ accidentContext: "objective accident context" }),
    )
  })

  it("continues prompt generation without enrichment when accident stats are unavailable", async () => {
    mocks.mockIsAccidentImageContextEnabled.mockReturnValue(true)
    mocks.mockFetchNearbyAccidentStats.mockResolvedValue(null)
    const { POST } = await loadRoute()

    const response = await POST(
      new Request("http://localhost/api/gemini/generate-prompts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64: "AAAA",
          longitude: 140.74,
          latitude: 40.82,
        }),
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(mocks.mockGenerateDisasterPrompts).toHaveBeenCalledWith(
      "AAAA",
      expect.objectContaining({ accidentContext: undefined }),
    )
  })
})
