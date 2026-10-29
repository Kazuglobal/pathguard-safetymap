// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  updateUserById: vi.fn(),
}))

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: async () => ({ auth: { exchangeCodeForSession: mocks.exchangeCodeForSession } }),
}))
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseAdmin: () => ({ auth: { admin: { updateUserById: mocks.updateUserById } } }),
}))

import { GET } from "@/app/auth/callback/route"

function callback(query = "code=abc&next=%2Froutes") {
  return GET(new Request(`https://path-guardian.com/auth/callback?${query}`))
}

const GOOGLE_METADATA = {
  iss: "https://accounts.google.com",
  email: "parent@example.com",
  name: "山田 花子",
  full_name: "山田 花子",
  avatar_url: "https://lh3.googleusercontent.com/a",
  picture: "https://lh3.googleusercontent.com/a",
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.updateUserById.mockResolvedValue({ data: {}, error: null })
})

describe("Google ログインのたびに名前・顔写真を消す(UIUX改装 項目55・62)", () => {
  it("セッションに交換したあと、user_metadata の名前・写真の URL を消してから戻る", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: GOOGLE_METADATA } }, error: null })

    const response = await callback()

    expect(response.headers.get("location")).toBe("https://path-guardian.com/routes")
    expect(mocks.updateUserById).toHaveBeenCalledWith("user-1", {
      user_metadata: { full_name: null, name: null, avatar_url: null, picture: null },
    })
  })

  it("消すものが無ければ更新を呼ばない", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: { email: "parent@example.com" } } }, error: null })

    await callback()

    expect(mocks.updateUserById).not.toHaveBeenCalled()
  })

  it("消すのに失敗してもログインは成立させる(エラー文に名前を出さない)", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: GOOGLE_METADATA } }, error: null })
    mocks.updateUserById.mockResolvedValue({ data: null, error: { message: "boom" } })
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const response = await callback()

    expect(response.headers.get("location")).toBe("https://path-guardian.com/routes")
    expect(consoleError).toHaveBeenCalledWith("OAuth login: failed to remove the provider name/icon from user metadata")
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("山田")
    consoleError.mockRestore()
  })

  it("コードの交換に失敗したら、消さずにログイン画面へ戻す", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ data: { user: null, session: null }, error: new Error("invalid") })
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    const response = await callback()

    expect(response.headers.get("location")).toBe("https://path-guardian.com/login?error=oauth_failed")
    expect(mocks.updateUserById).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
