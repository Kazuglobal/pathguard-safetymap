// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import { buildLineAuthorizeUrl, exchangeAndVerifyLineCode } from "@/lib/auth/line"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("LINE ログインで受け取る情報(UIUX改装 項目55・62)", () => {
  it("表示名・アイコン(profile)の許可を求めない", () => {
    const url = new URL(buildLineAuthorizeUrl({ channelId: "channel", redirectUri: "https://path-guardian.com/cb", state: "s", nonce: "n" }))

    expect(url.searchParams.get("scope")).toBe("openid email")
    expect(url.searchParams.get("scope")?.split(" ")).not.toContain("profile")
  })

  it("ID トークンに名前や写真が入っていても、LINE ユーザーIDとメールアドレスしか返さない", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.endsWith("/token")) return new Response(JSON.stringify({ id_token: "token" }), { status: 200 })
      return new Response(JSON.stringify({
        iss: "https://access.line.me",
        sub: "U-line-user",
        aud: "channel",
        nonce: "n",
        name: "はなこ",
        picture: "https://profile.line-scdn.net/a",
        email: "parent@example.com",
      }), { status: 200 })
    }))

    const profile = await exchangeAndVerifyLineCode({ code: "c", redirectUri: "https://path-guardian.com/cb", channelId: "channel", channelSecret: "secret", nonce: "n" })

    expect(profile).toEqual({ userId: "U-line-user", email: "parent@example.com" })
  })
})
