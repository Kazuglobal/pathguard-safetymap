import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const eq = vi.fn()
  const maybeSingle = vi.fn()
  const upsert = vi.fn()
  const upload = vi.fn()
  const getPublicUrl = vi.fn()

  return {
    getUser: vi.fn(),
    from: vi.fn(),
    select: vi.fn(),
    eq,
    maybeSingle,
    upsert,
    upload,
    getPublicUrl,
    generateImage: vi.fn(),
  }
})

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: async () => ({
    auth: { getUser: mocks.getUser },
  }),
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    from: mocks.from,
    storage: {
      from: () => ({
        upload: mocks.upload,
        getPublicUrl: mocks.getPublicUrl,
      }),
    },
  }),
}))

vi.mock("@/lib/gemini-image", () => ({
  FORCED_GEMINI_IMAGE_MODEL: "gemini-3.1-flash-lite-image",
  generateImageWithGeminiWithModel: mocks.generateImage,
}))

vi.mock("@/lib/hazard-scenarios", () => ({
  buildHazardImagePrompt: () => "hazard prompt",
  formatDepthLabel: () => "1m",
  getHazardScenarioOptions: () => [{ key: "flooded-road" }],
}))

function buildRequest() {
  return new Request("http://localhost/api/hazard/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hazardType: "flood",
      riskLevel: 3,
      areaContext: "riverside",
      scenarioKey: "flooded-road",
    }),
  }) as any
}

describe("app/api/hazard/image route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })

    const query = {
      select: mocks.select,
      eq: mocks.eq,
      maybeSingle: mocks.maybeSingle,
      upsert: mocks.upsert,
    }
    mocks.from.mockReturnValue(query)
    mocks.select.mockReturnValue(query)
    mocks.eq.mockReturnValue(query)
    mocks.upsert.mockResolvedValue({ error: null })
    mocks.upload.mockResolvedValue({ error: null })
    mocks.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/gemini-new.png" },
    })
  })

  it("isolates Gemini cache lookups from legacy OpenAI entries", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        public_url: "https://example.com/gemini.png",
        prompt_en: "hazard prompt",
        scenario_key: "flooded-road",
        generated_at: "2026-06-20T00:00:00.000Z",
      },
      error: null,
    })

    const { POST } = await import("@/app/api/hazard/image/route")
    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mocks.eq).toHaveBeenCalledWith("provider", "gemini")
  })

  it("writes the gemini provider on a cache miss", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })
    mocks.generateImage.mockResolvedValue({
      images: [{ dataUrl: "data:image/png;base64,AAAA", mimeType: "image/png" }],
      model: "gemini-3.1-flash-lite-image",
    })

    const { POST } = await import("@/app/api/hazard/image/route")
    const response = await POST(buildRequest())

    expect(response.status).toBe(200)
    expect(mocks.generateImage).toHaveBeenCalled()
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "gemini" }),
      expect.anything(),
    )
  })
})
