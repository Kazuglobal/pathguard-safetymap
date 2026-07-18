import { describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

vi.mock("@/lib/danger-report-moderation-handler", () => ({
  handleDangerReportModeration: vi.fn(async () =>
    NextResponse.json({ delegated: true }),
  ),
}))

import { POST } from "@/app/api/suspicious-alert/moderate/route"
import { handleDangerReportModeration } from "@/lib/danger-report-moderation-handler"

describe("POST /api/suspicious-alert/moderate compatibility route", () => {
  it("delegates to generic moderation while requiring danger_type=suspicious", async () => {
    const request = new NextRequest(
      "http://localhost/api/suspicious-alert/moderate",
      {
        method: "POST",
        body: JSON.stringify({ reportId: "report-1" }),
      },
    )

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(handleDangerReportModeration).toHaveBeenCalledWith(request, {
      requiredDangerType: "suspicious",
      rateLimitPrefix: "suspicious-moderate",
    })
  })
})
