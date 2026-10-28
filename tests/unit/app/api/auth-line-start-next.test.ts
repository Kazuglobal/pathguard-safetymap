// @vitest-environment node
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/line", () => ({
  getLineCredentials: () => ({ channelId: "channel", channelSecret: "secret" }),
  buildLineAuthorizeUrl: () => "https://access.line.me/oauth2/v2.1/authorize?mock=1",
}))

import { GET } from "@/app/api/auth/line/start/route"

function nextCookie(response: Response): string | undefined {
  const header = response.headers.get("set-cookie") ?? ""
  const match = header.match(/pg_line_next=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : undefined
}

describe("LINEログイン開始時の戻り先", () => {
  it("アプリ内の戻り先を Cookie に保存する", async () => {
    const response = await GET(new Request("https://path-guardian.com/api/auth/line/start?next=%2Froutes"))

    expect(response.status).toBe(307)
    expect(nextCookie(response)).toBe("/routes")
  })

  it("アプリ外への戻り先は保存せず既定の画面にする(open redirect 防止)", async () => {
    const response = await GET(
      new Request("https://path-guardian.com/api/auth/line/start?next=%2F%2Fevil.example.com"),
    )

    expect(nextCookie(response)).toBe("/map")
  })
})
