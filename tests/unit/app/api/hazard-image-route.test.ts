import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "node:crypto"

const mocks = vi.hoisted(() => {
  const mockGetUser = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockUpsert = vi.fn()
  const mockUpload = vi.fn()
  const mockGetPublicUrl = vi.fn()
  const mockGenerateImage = vi.fn()

  const storageFrom = vi.fn(() => ({
    upload: mockUpload,
    getPublicUrl: mockGetPublicUrl,
  }))

  const from = vi.fn((table: string) => {
    if (table === "hazard_image_cache") {
      const filters: Record<string, unknown> = {}
      const chain = {
        eq: vi.fn((column: string, value: unknown) => {
          filters[column] = value
          return chain
        }),
        maybeSingle: vi.fn(() => mockMaybeSingle(filters)),
      }

      return {
        select: vi.fn(() => chain),
        upsert: mockUpsert,
      }
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    mockGetUser,
    mockMaybeSingle,
    mockUpsert,
    mockUpload,
    mockGetPublicUrl,
    mockGenerateImage,
    from,
    storageFrom,
  }
})

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mocks.mockGetUser,
    },
  })),
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mocks.from,
    storage: {
      from: mocks.storageFrom,
    },
  })),
}))

vi.mock("@/lib/gemini-image", () => ({
  generateImageWithGeminiWithModel: mocks.mockGenerateImage,
}))

async function loadRoute() {
  vi.resetModules()
  return import("@/app/api/hazard/image/route")
}

function buildRequestBody(overrides?: Record<string, unknown>) {
  return {
    hazardType: "flood",
    riskLevel: 3,
    depthMinMeters: 0.5,
    depthMaxMeters: 3,
    areaContext: "residential-school-route",
    scenarioKey: "standard-residential",
    locationLabel: "residential school route in Japan",
    ...overrides,
  }
}

function createPromptSignature(value: string) {
  return createHash("md5").update(value).digest("hex")
}

describe("app/api/hazard/image route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    })
    mocks.mockGetPublicUrl.mockReturnValue({
      data: {
        publicUrl: "https://example.supabase.co/storage/v1/object/public/hazard-simulations/user-1/flood.png",
      },
    })
    mocks.mockUpload.mockResolvedValue({ error: null })
    mocks.mockUpsert.mockResolvedValue({ error: null })
    mocks.mockGenerateImage.mockResolvedValue({
      model: "gemini-3.1-flash-image-preview",
      images: [{ mimeType: "image/png", dataUrl: "data:image/png;base64,Zm9v" }],
    })
  })

  it("returns cached data without generating a new image", async () => {
    mocks.mockMaybeSingle.mockResolvedValue({
      data: {
        public_url: "https://example.supabase.co/storage/v1/object/public/hazard-simulations/cached.png",
        prompt_en: "cached prompt",
        scenario_key: "standard-residential",
        generated_at: "2026-03-07T00:00:00.000Z",
      },
      error: null,
    })

    const { POST } = await loadRoute()
    const res = await POST(
      new Request("http://localhost/api/hazard/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody()),
      }) as any,
    )

    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.cached).toBe(true)
    expect(body.imageUrl).toContain("cached.png")
    expect(mocks.mockGenerateImage).not.toHaveBeenCalled()
  })

  it("does not reuse cache entries for a different prompt signature", async () => {
    const cachedPrompt = "cached prompt for shallow flooding"
    const cachedSignature = createPromptSignature(cachedPrompt)

    mocks.mockMaybeSingle.mockImplementation(async (filters?: Record<string, unknown>) => {
      if (!filters?.prompt_signature || filters.prompt_signature === cachedSignature) {
        return {
          data: {
            public_url:
              "https://example.supabase.co/storage/v1/object/public/hazard-simulations/cached.png",
            prompt_en: cachedPrompt,
            scenario_key: "standard-residential",
            generated_at: "2026-03-07T00:00:00.000Z",
          },
          error: null,
        }
      }

      return { data: null, error: null }
    })

    const { POST } = await loadRoute()
    const res = await POST(
      new Request("http://localhost/api/hazard/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildRequestBody({
            depthMinMeters: 2,
            depthMaxMeters: 5,
            locationLabel: "deep flood zone in Japan",
          }),
        ),
      }) as any,
    )

    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.cached).toBe(false)
    expect(mocks.mockGenerateImage).toHaveBeenCalledTimes(1)
  })

  it("generates, uploads, and caches when no cached image exists", async () => {
    mocks.mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    })

    const { POST } = await loadRoute()
    const res = await POST(
      new Request("http://localhost/api/hazard/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildRequestBody()),
      }) as any,
    )

    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.cached).toBe(false)
    expect(mocks.mockGenerateImage).toHaveBeenCalled()
    expect(mocks.mockUpload).toHaveBeenCalled()
    expect(mocks.mockUpsert).toHaveBeenCalled()
  })
})
