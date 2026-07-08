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

// Push送信はモック(routeテストはpush_subscriptionsテーブルに依存させない)
vi.mock("@/lib/web-push", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(1),
}))

// AI審査はヒューリスティック相当の決定論的な実装に差し替える
// （routeテストはAPIキーやネットワークに依存させない）。
vi.mock("@/lib/suspicious-alert-moderation-ai", async () => {
  const heuristic = await vi.importActual<typeof import("@/lib/suspicious-alert-moderation")>(
    "@/lib/suspicious-alert-moderation",
  )
  return {
    moderateSuspiciousAlertWithAi: vi.fn(
      async (input: { text?: string | null; hasImage?: boolean }) =>
        heuristic.moderateSuspiciousAlert({ text: input.text, hasImage: input.hasImage }),
    ),
  }
})

import { POST } from "@/app/api/suspicious-alert/moderate/route"
import { createServerClient } from "@/lib/supabase-server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { moderateSuspiciousAlertWithAi } from "@/lib/suspicious-alert-moderation-ai"
import { checkApiRateLimit } from "@/lib/upstash-rate-limiter"
import { sendPushToUser } from "@/lib/web-push"

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

function mockAdmin(
  report: Record<string, unknown> | null,
  updatedReport = report,
  downloadResult: { data: unknown; error: unknown } = { data: null, error: new Error("not found") },
) {
  const fetchBuilder = makeFetchBuilder(report)
  const updateBuilder = makeUpdateBuilder(updatedReport)
  const from = vi.fn()
    .mockReturnValueOnce(fetchBuilder)
    .mockReturnValueOnce(updateBuilder)
  const download = vi.fn().mockResolvedValue(downloadResult)
  const storage = { from: vi.fn().mockReturnValue({ download }) }

  vi.mocked(getSupabaseAdmin).mockReturnValue({ from, storage } as any)

  return { from, fetchBuilder, updateBuilder, download }
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

  it("rejects unauthenticated requests", async () => {
    mockAuth(null)

    const res = await POST(makeRequest({ reportId: "report-1" }))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toContain("認証")
    expect(checkApiRateLimit).not.toHaveBeenCalled()
    expect(getSupabaseAdmin).not.toHaveBeenCalled()
  })

  it("forbids moderating another user's report", async () => {
    const { updateBuilder } = mockAdmin({
      ...baseReport,
      user_id: "someone-else",
    })

    const res = await POST(makeRequest({ reportId: "report-1" }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain("審査できません")
    expect(updateBuilder.update).not.toHaveBeenCalled()
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

  it("downloads attached images from storage and passes data URLs to the AI moderation", async () => {
    const imageUrl =
      "https://example.supabase.co/storage/v1/object/public/danger-reports/user-1/report-1/photo.jpg"
    const reportWithImage = {
      ...baseReport,
      image_url: imageUrl,
    }
    const blobLike = {
      size: 3,
      type: "image/jpeg",
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }
    const { download } = mockAdmin(reportWithImage, reportWithImage, {
      data: blobLike,
      error: null,
    })

    const res = await POST(makeRequest({ reportId: "report-1" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    // 画像付きは自動公開されない
    expect(body.verdict.status).toBe("needs_review")
    expect(download).toHaveBeenCalledWith("user-1/report-1/photo.jpg")
    expect(vi.mocked(moderateSuspiciousAlertWithAi)).toHaveBeenCalledWith(
      expect.objectContaining({
        hasImage: true,
        imageDataUrls: [expect.stringMatching(/^data:image\/jpeg;base64,/)],
      }),
    )
  })

  it("skips image download when the report has no attachments", async () => {
    const { download } = mockAdmin(baseReport)

    const res = await POST(makeRequest({ reportId: "report-1" }))

    expect(res.status).toBe(200)
    expect(download).not.toHaveBeenCalled()
    expect(vi.mocked(moderateSuspiciousAlertWithAi)).toHaveBeenCalledWith(
      expect.objectContaining({ hasImage: false, imageDataUrls: [] }),
    )
  })

  it("審査確定時に投稿者本人へ結果のPush通知を送る", async () => {
    const updatedReport = {
      ...baseReport,
      status: "approved",
      ai_moderation_status: "approved",
    }
    mockAdmin(baseReport, updatedReport)

    const res = await POST(makeRequest({ reportId: "report-1" }))

    expect(res.status).toBe(200)
    expect(vi.mocked(sendPushToUser)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(sendPushToUser)).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        tag: "moderation-result-report-1",
        data: expect.objectContaining({ type: "danger_reports" }),
      }),
      "danger_reports",
    )
  })

  it("Push送信が失敗しても審査結果の保存は成功として返す", async () => {
    const updatedReport = {
      ...baseReport,
      status: "approved",
      ai_moderation_status: "approved",
    }
    mockAdmin(baseReport, updatedReport)
    vi.mocked(sendPushToUser).mockRejectedValueOnce(new Error("push down"))

    const res = await POST(makeRequest({ reportId: "report-1" }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.verdict.status).toBe("approved")
  })

  it("すでに審査済み(update不成立)のときは通知を送らない", async () => {
    mockAdmin(baseReport, null)

    const res = await POST(makeRequest({ reportId: "report-1" }))

    expect(res.status).toBe(409)
    expect(vi.mocked(sendPushToUser)).not.toHaveBeenCalled()
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
