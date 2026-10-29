import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import LoginForm from "@/components/auth/login-form"
import { PRODUCT_FACTS } from "@/lib/product-facts"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
  signInWithPassword: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
    replace: mocks.replace,
    refresh: mocks.refresh,
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({
    supabase: {
      auth: {
        signInWithPassword: mocks.signInWithPassword,
        onAuthStateChange: mocks.onAuthStateChange,
      },
    },
  }),
}))

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: mocks.toast,
  }),
}))

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "demo-token" } },
      error: null,
    })
    mocks.onAuthStateChange.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    })
  })

  it("routes demo login directly to landing without refreshing the login page", async () => {
    const user = userEvent.setup()

    render(<LoginForm />)

    await user.click(screen.getByRole("button", { name: "デモユーザーで試す" }))

    await waitFor(() => {
      expect(mocks.signInWithPassword).toHaveBeenCalledWith({
        email: "demo@example.com",
        password: "demopassword",
      })
    })

    expect(mocks.refresh).not.toHaveBeenCalled()
    // デモログインは戻るボタンでログイン画面に戻らないよう replace で遷移する
    expect(mocks.replace).toHaveBeenCalledWith("/landing")
  })

  it("デモの説明(登録不要・何が見られるか・データは見本・共用なので自分の情報を入れない)を出す(項目3)", () => {
    render(<LoginForm />)

    const demo = screen.getByRole("region", { name: "登録せずに試す" })
    expect(demo).toHaveTextContent(PRODUCT_FACTS.demo.summary)
    expect(demo).toHaveTextContent(PRODUCT_FACTS.demo.note)
    expect(demo).toHaveTextContent(PRODUCT_FACTS.demo.shared)
    expect(demo).toContainElement(screen.getByRole("button", { name: "デモユーザーで試す" }))
  })

  it("メールとパスワードの欄に自動入力の印を付け、パスワードは表示を切り替えられる(項目35・36)", async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    const email = screen.getByLabelText("メールアドレス")
    const password = document.getElementById("password") as HTMLInputElement
    expect(email).toHaveAttribute("autocomplete", "email")
    expect(email).toHaveAttribute("placeholder", "例: name@example.com")
    expect(password).toHaveAttribute("autocomplete", "current-password")

    await user.click(screen.getByRole("button", { name: "入力したパスワードを表示する" }))
    expect(password).toHaveAttribute("type", "text")
  })

  it("ログインに失敗したら、英語のまま出さずに日本語で理由を出す", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({ data: { session: null }, error: { message: "Invalid login credentials", code: "invalid_credentials" } })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText("メールアドレス"), "parent@example.com")
    await user.type(document.getElementById("password") as HTMLInputElement, "wrong-password1")
    await user.click(screen.getByRole("button", { name: "ログイン" }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("メールアドレスまたはパスワードが正しくありません。")
    expect(alert).not.toHaveTextContent("Invalid")
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
