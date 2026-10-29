import { render, screen } from "@testing-library/react"
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockRedirect, mockRethrow } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`)
  }),
  mockRethrow: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: mockRedirect,
  unstable_rethrow: mockRethrow,
}))

vi.mock("@/lib/supabase-server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

vi.mock("@/components/safety-quest/hunter/hunter-game", () => ({
  HunterGame: ({ userId }: { userId: string }) => <div data-testid="hunter-game">{userId}</div>,
}))

import HunterPage from "@/app/safety-quest/hunter/page"

const LOGIN_WITH_NEXT = "/login?next=%2Fsafety-quest%2Fhunter"
const RETRY_MESSAGE = "つながりにくいみたい。もういちど ためしてね"

async function renderRetryScreen() {
  const element = await HunterPage()
  render(element)
  expect(screen.getByRole("alert")).toHaveTextContent(RETRY_MESSAGE)
  expect(screen.getByRole("button", { name: /もういちど よみこむ/ })).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /ホームに もどる/ })).toHaveAttribute("href", "/landing")
  expect(screen.queryByTestId("hunter-game")).not.toBeInTheDocument()
}

describe("きけんハンターのページのログイン確認", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // /login は next が無いとログイン済みの人を /map へ送るため、ゲームではなく地図に着いていた
  it("セッションが無いときは、ここへ戻る next をつけてログインへ送る", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new AuthSessionMissingError() })

    await expect(HunterPage()).rejects.toThrow("NEXT_REDIRECT")

    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith(LOGIN_WITH_NEXT)
  })

  it("エラーが無くユーザーもいないときも、next をつけてログインへ送る", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null })

    await expect(HunterPage()).rejects.toThrow("NEXT_REDIRECT")

    expect(mockRedirect).toHaveBeenCalledWith(LOGIN_WITH_NEXT)
  })

  // 通信エラーでログインへ送ると、/login が Cookie のセッションを見てここへ戻し、往復が止まらない
  it("通信エラーのときはログインへ送らず、読み込み直しの画面を出す", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new AuthRetryableFetchError("fetch failed", 0),
    })

    await renderRetryScreen()

    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("期限切れ・無効なセッション(4xx の認証エラー)はログインへ送る(ログイン画面が getUser で確かめ直すので往復しない)", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new AuthApiError("invalid JWT", 403, "bad_jwt"),
    })

    await expect(HunterPage()).rejects.toThrow("NEXT_REDIRECT")

    expect(mockRedirect).toHaveBeenCalledWith(LOGIN_WITH_NEXT)
  })

  it("認証サーバーの 5xx は確かめられなかった扱いで、読み込み直しの画面を出す", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new AuthApiError("upstream unavailable", 503, "unexpected_failure"),
    })

    await renderRetryScreen()

    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("getUser が例外を投げても読み込み直しの画面を出し、Next.js 内部の例外は投げ直しに回す", async () => {
    const thrown = new TypeError("network down")
    mockGetUser.mockRejectedValueOnce(thrown)

    await renderRetryScreen()

    expect(mockRethrow).toHaveBeenCalledWith(thrown)
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it("ログイン済みならゲームを出す", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-1" } }, error: null })

    const element = await HunterPage()
    render(element)

    expect(mockRedirect).not.toHaveBeenCalled()
    expect(screen.getByTestId("hunter-game")).toHaveTextContent("user-1")
  })
})
