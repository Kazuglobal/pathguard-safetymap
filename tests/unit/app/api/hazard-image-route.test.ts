import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const eq = vi.fn()
  const maybeSingle = vi.fn()

  return {
    getUser: vi.fn(),
    from: vi.fn(),
    select: vi.fn(),
    eq,
    maybeSingle,
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
  }),
}))

vi.mock("@/lib/openai-image", () => ({
  FORCED_OPENAI_IMAGE_MODEL: "gpt-image-2",
  generateImageWithOpenAIWithModel: vi.fn(),
}))

vi.mock("@/lib/hazard-scenarios", () => ({
  buildHazardImagePrompt: () => "hazard prompt",
  formatDepthLabel: () => "1m",
  getHazardScenarioOptions: () => [{ key: "flooded-road" }],
}))

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
    }
    mocks.from.mockReturnValue(query)
    mocks.select.mockReturnValue(query)
    mocks.eq.mockReturnValue(query)
    mocks.maybeSingle.mockResolvedValue({
      data: {
        public_url: "https://example.com/openai.png",
        prompt_en: "hazard prompt",
        scenario_key: "flooded-road",
        generated_at: "2026-06-20T00:00:00.000Z",
      },
      error: null,
    })
  })

  it("isolates OpenAI cache lookups from legacy Gemini entries", async () => {
    const { POST } = await import("@/app/api/hazard/image/route")
    const response = await POST(
      new Request("http://localhost/api/hazard/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hazardType: "flood",
          riskLevel: 3,
          areaContext: "riverside",
          scenarioKey: "flooded-road",
        }),
      }) as any,
    )

    expect(response.status).toBe(200)
    expect(mocks.eq).toHaveBeenCalledWith("provider", "openai")
  })
})
