import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetUser, mockRedirect, mockCreateServerClient } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockRedirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
  mockCreateServerClient: vi.fn(),
}))

vi.mock("next/navigation", () => ({ redirect: mockRedirect }))
vi.mock("@/lib/supabase-server", () => ({ createServerClient: mockCreateServerClient }))
vi.mock("@/components/auth/login-form", () => ({
  default: ({ nextPath }: { nextPath: string }) => <div data-testid="login-form" data-next={nextPath} />,
}))

import LoginPage from "@/app/login/page"
import { PRODUCT_FACTS } from "@/lib/product-facts"

const renderPage = async (params: Record<string, string>) => {
  const ui = await LoginPage({ searchParams: Promise.resolve(params) })
  return render(ui)
}

describe("ログイン画面", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateServerClient.mockResolvedValue({ auth: { getUser: mockGetUser } })
  })

  it("ログイン済みと確かめられたら戻り先へ移す", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null })

    await expect(renderPage({ next: "/routes" })).rejects.toThrow("NEXT_REDIRECT:/routes")
  })

  it("確かめられないとき(通信エラー)は戻さずフォームを出す(行ったり来たりのリダイレクトを防ぐ)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "fetch failed" } })

    await renderPage({ next: "/routes" })

    expect(mockRedirect).not.toHaveBeenCalled()
    expect(screen.getByTestId("login-form")).toHaveAttribute("data-next", "/routes")
  })

  it("自分でログアウトしてきたら「ログアウトしました」を出す", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth session missing!" } })

    await renderPage({ loggedOut: "1" })

    expect(screen.getByRole("status")).toHaveTextContent("ログアウトしました")
  })

  it("ロゴ・「PathGuardianとは」(紹介HPへ)・1行の紹介・「無料・インストール不要」・ルペ・共通のフッターを出す(項目1・15・32)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth session missing!" } })

    await renderPage({})

    expect(screen.getByRole("heading", { level: 1, name: "ログイン" })).toBeInTheDocument()
    // ヘッダーとフッターの両方にロゴ
    expect(screen.getAllByTestId("brand-logo")[0]).toHaveTextContent("PathGuardian")
    expect(screen.getByRole("link", { name: "PathGuardianとは" })).toHaveAttribute("href", "/lp")
    const intro = screen.getByTestId("auth-intro")
    expect(intro).toHaveTextContent(PRODUCT_FACTS.tagline)
    expect(intro).toHaveTextContent("無料・インストール不要")
    expect(screen.getAllByTestId("lupe").length).toBeGreaterThan(0)
    expect(screen.getByTestId("site-footer")).toHaveTextContent("利用規約")
    // 旧名は出さない
    expect(document.body).not.toHaveTextContent("通学路安全マップ")
  })

  it("Supabase の準備に失敗しても存在しない /error へは飛ばさず、その場で案内する", async () => {
    mockCreateServerClient.mockResolvedValue(null)

    await renderPage({})

    expect(mockRedirect).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("ログイン画面を表示できませんでした")
  })
})
