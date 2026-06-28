import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(),
}))

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: vi.fn(),
}))

vi.mock("@/lib/upstash-rate-limiter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/upstash-rate-limiter")>(
    "@/lib/upstash-rate-limiter",
  )
  return {
    ...actual,
    checkApiRateLimit: vi.fn().mockResolvedValue({ success: true }),
  }
})

import { POST } from "@/app/api/suspicious-alert/moderate/route"
import { createServerClient } from "@/lib/supabase-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { checkApiRateLimit } from "@/lib/upstash-rate-limiter"

const mockUser = { id: "user-1" }

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/suspicious-alert/moderate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function mockAuth(user: typeof mockUser | null = mockUser) {
  vi.mocked(createServerClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  } as any)
}

function makeFetchBuilder(report: Record<string, unknown> | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: report, error: null }),
  }
}

function makeUpdateBuilder(updatedReport: Record<string, unknown> | null) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: updatedReport, error: null }),
  }
}

function mockAdmin(report: Record<string, unknown> | null, updatedReport = report) {
  const fetchBuilder = makeFetchBuilder(report)
  const updateBuilder = makeUpdateBuilder(updatedReport)
  const from = vi.fn()
    .mockReturnValueOnce(fetchBuilder)
    .mockReturnValueOnce(updateBuilder)

  vi.mocked(getSupabaseAdmin).mockReturnValue({ from } as any)

  return { from, fetchBuilder, updateBuilder }
}

const baseReport = {
  id: "report-1",
  user_id: "user-1",
  danger_type: "suspicious",
  title: "不審者情報",
  description: "下校時間に声かけ事案がありました。",
  image_url: null,
  processed_image_urls: [],
  ai_moderation_status: "pending",
}

describe("/api/suspicious-alert/moderate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth()
    vi.mocked(checkApiRateLimit).mockResolvedValue({ success: true })
  })

  it("rate limits authenticated users", async () => {
    vi.mocked(checkApiRateLimit).mockResolvedValue({
      success: false,
      reset: Date.now() + 60_000,
    })

    const res = await POST(makeRequest({ reportId: "report-1" }))

    expect(res.status).toBe(429)
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it("does not re-moderate a finalized report", async () => {
    const { updateBuilder } = mockAdmin({
      ...baseReport,
      ai_moderation_status: "rejected",
    })

    const res = await POST(makeRequest({ reportId: "report-1" }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain("すでに審査済み")
    expect(updateBuilder.update).not.toHaveBeenCalled()
  })

  it("updates only null or pending moderation rows", async () => {
    const updatedReport = {
      ...baseReport,
      status: "approved",
      ai_moderation_status: "approved",
    }
    const { updateBuilder } = mockAdmin(baseReport, updatedReport)

    const res = await POST(makeRequest({ reportId: "report-1" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.verdict.status).toBe("approved")
    expect(updateBuilder.or).toHaveBeenCalledWith(
      "ai_moderation_status.is.null,ai_moderation_status.eq.pending",
    )
    expect(body.report.ai_moderation_status).toBe("approved")
  })

  it("returns a configuration error when the admin client is unavailable", async () => {
    vi.mocked(getSupabaseAdmin).mockImplementation(() => {
      throw new Error("missing env")
    })

    const res = await POST(makeRequest({ reportId: "report-1" }))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toContain("SUPABASE_SERVICE_ROLE_KEY")
  })
})
