import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(),
}))

vi.mock("@/lib/gemini-hazard", () => ({
  analyzeImagePipeline: vi.fn(),
}))

vi.mock("@/lib/api-usage-logger", () => ({
  logApiUsage: vi.fn(),
}))

vi.mock("@/lib/upstash-rate-limiter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/upstash-rate-limiter")>(
    "@/lib/upstash-rate-limiter",
  )
  return {
    ...actual,
    checkGeminiRateLimit: vi.fn().mockResolvedValue({ success: true }),
  }
})

import { createServerClient } from "@/lib/supabase-server"
import { analyzeImagePipeline } from "@/lib/gemini-hazard"
import { checkGeminiRateLimit } from "@/lib/upstash-rate-limiter"

const mockUser = { id: "user-1", email: "test@example.com" }

function mockAuth(user: typeof mockUser | null) {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as any)
}

function makeRequest() {
  return new NextRequest("http://localhost/api/hazard-game/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64: "data:image/png;base64,AAAA" }),
  })
}

/**
 * 従量課金の Vision 呼び出し + 成功時のポイント付与を伴うため、
 * 兄弟の /api/hunter/analyze と同じくユーザー単位のレート制限が要る。
 * (制限が無いと1アカウントでAPI課金とポイントを無制限に回せる)
 */
describe("POST /api/hazard-game/analyze のレート制限", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth(mockUser)
    vi.mocked(checkGeminiRateLimit).mockResolvedValue({ success: true })
  })

  it("制限超過時は 429 を返し、Vision パイプラインを呼ばない", async () => {
    vi.mocked(checkGeminiRateLimit).mockResolvedValue({ success: false, reset: Date.now() + 30_000 })
    const { POST } = await import("@/app/api/hazard-game/analyze/route")

    const res = await POST(makeRequest())

    expect(res.status).toBe(429)
    expect(analyzeImagePipeline).not.toHaveBeenCalled()
  })

  it("認証済みユーザーの id をキーに制限を掛ける", async () => {
    vi.mocked(analyzeImagePipeline).mockRejectedValue(new Error("stop after rate limit"))
    const { POST } = await import("@/app/api/hazard-game/analyze/route")

    await POST(makeRequest())

    expect(checkGeminiRateLimit).toHaveBeenCalledWith(mockUser.id)
  })

  it("未認証リクエストは 401 で、制限判定より前に弾く", async () => {
    mockAuth(null)
    const { POST } = await import("@/app/api/hazard-game/analyze/route")

    const res = await POST(makeRequest())

    expect(res.status).toBe(401)
    expect(checkGeminiRateLimit).not.toHaveBeenCalled()
  })
})
