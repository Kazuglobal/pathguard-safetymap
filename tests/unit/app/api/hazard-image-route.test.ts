import { beforeEach, describe, expect, it, vi } from "vitest"

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
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: mockMaybeSingle,
                })),
              })),
            })),
          })),
        })),
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
