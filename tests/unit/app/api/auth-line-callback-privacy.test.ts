// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  cookieValues: new Map<string, string>(),
  createUser: vi.fn(),
  generateLink: vi.fn(),
  updateUserById: vi.fn(),
  verifyOtp: vi.fn(),
  exchangeAndVerifyLineCode: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (mocks.cookieValues.has(name) ? { value: mocks.cookieValues.get(name) } : undefined),
    delete: (name: string) => { mocks.cookieValues.delete(name) },
  }),
}))
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({
    auth: { admin: { createUser: mocks.createUser, generateLink: mocks.generateLink, updateUserById: mocks.updateUserById } },
  }),
}))
vi.mock("@/lib/supabase-server", () => ({
  createServerClient: async () => ({ auth: { verifyOtp: mocks.verifyOtp } }),
}))
vi.mock("@/lib/auth/line", () => ({
  getLineCredentials: () => ({ channelId: "channel", channelSecret: "secret" }),
  syntheticLineEmail: () => "line-synthetic@line.auth.local",
  exchangeAndVerifyLineCode: mocks.exchangeAndVerifyLineCode,
}))

import { GET } from "@/app/api/auth/line/callback/route"

const LINE_USER_ID = "U-line-user"

function callback() {
  return GET(new Request("https://path-guardian.com/api/auth/line/callback?code=abc&state=state-1"))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.cookieValues = new Map([
    ["pg_line_state", "state-1"],
    ["pg_line_nonce", "nonce-1"],
    ["pg_line_next", "/routes"],
  ])
  mocks.exchangeAndVerifyLineCode.mockResolvedValue({ userId: LINE_USER_ID })
  mocks.generateLink.mockResolvedValue({ data: { user: { user_metadata: { provider: "line", line_user_id: LINE_USER_ID } }, properties: { hashed_token: "hash" } }, error: null })
  mocks.updateUserById.mockResolvedValue({ data: {}, error: null })
})

describe("LINE ログインは表示名・アイコンを預からない(UIUX改装 項目55・62)", () => {
  it("新しいユーザーは LINE ユーザーIDだけを持つ(名前・アイコンを入れない)", async () => {
    mocks.createUser.mockResolvedValue({ error: null })
    mocks.verifyOtp.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: { provider: "line", line_user_id: LINE_USER_ID } } }, error: null })

    const response = await callback()

    expect(response.headers.get("location")).toBe("https://path-guardian.com/routes")
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      user_metadata: { provider: "line", line_user_id: LINE_USER_ID },
    }))
    // 消すものが無いので更新は呼ばない
    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it("以前のログインで保存した表示名・アイコンは、次のログインで消す(LINE ユーザーIDは残す)", async () => {
    const oldMetadata = { provider: "line", line_user_id: LINE_USER_ID, name: "はなこ", full_name: "はなこ", avatar_url: "https://profile.line-scdn.net/a" }
    mocks.createUser.mockResolvedValue({ error: { code: "email_exists", message: "already registered" } })
    mocks.generateLink.mockResolvedValue({ data: { user: { user_metadata: oldMetadata }, properties: { hashed_token: "hash" } }, error: null })
    mocks.verifyOtp.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: oldMetadata } }, error: null })

    const response = await callback()

    expect(response.headers.get("location")).toBe("https://path-guardian.com/routes")
    expect(mocks.updateUserById).toHaveBeenCalledWith("user-1", {
      user_metadata: { provider: "line", line_user_id: LINE_USER_ID, name: null, full_name: null, avatar_url: null },
    })
  })

  it("消すのに失敗してもログインは成立させる", async () => {
    const oldMetadata = { provider: "line", line_user_id: LINE_USER_ID, name: "はなこ" }
    mocks.createUser.mockResolvedValue({ error: { code: "email_exists", message: "already registered" } })
    mocks.generateLink.mockResolvedValue({ data: { user: { user_metadata: oldMetadata }, properties: { hashed_token: "hash" } }, error: null })
    mocks.verifyOtp.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: oldMetadata } }, error: null })
    mocks.updateUserById.mockRejectedValue(new Error("network"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const response = await callback()

    expect(response.headers.get("location")).toBe("https://path-guardian.com/routes")
    expect(consoleError).toHaveBeenCalledWith("LINE login: failed to remove stored profile name/icon")
    consoleError.mockRestore()
  })
})
