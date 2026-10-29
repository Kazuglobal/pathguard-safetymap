import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import RegisterForm from "@/components/auth/register-form"
import { DUPLICATE_EMAIL_MESSAGE, RATE_LIMIT_MESSAGE } from "@/lib/auth/error-messages"
import { PRODUCT_FACTS } from "@/lib/product-facts"

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  resend: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }))
vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({ supabase: { auth: { signUp: mocks.signUp, resend: mocks.resend } } }),
}))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("@/components/auth/social-login-buttons", () => ({ SocialLoginButtons: () => null }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, email = "parent@example.com") {
  await user.type(screen.getByLabelText(/メールアドレス/), email)
  await user.type(document.getElementById("password") as HTMLInputElement, "password1")
  await user.click(screen.getByTestId("agree-to-terms-checkbox"))
  await user.click(screen.getByRole("button", { name: "登録する" }))
}

describe("RegisterForm", () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows live password requirements and focuses the first invalid field", async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.click(screen.getByRole("button", { name: "登録する" }))

    expect(screen.getByLabelText(/メールアドレス/)).toHaveFocus()
    expect(screen.getByText("メールアドレスを入力してください")).toBeInTheDocument()
    expect(screen.getByText("英字（アルファベット）を含めてください")).toBeInTheDocument()
    // メール・パスワード・規約への同意の3つだけ
    expect(screen.getAllByText("必須")).toHaveLength(3)
  })

  it("例示は「例: name@example.com」、登録ボタンの近くに確認メールが届くことを出す(項目35・36)", () => {
    render(<RegisterForm />)

    expect(screen.getByLabelText(/メールアドレス/)).toHaveAttribute("placeholder", "例: name@example.com")
    expect(screen.getByTestId("register-confirmation-note")).toHaveTextContent(PRODUCT_FACTS.registration.confirmationMail)
    expect(document.getElementById("password")).toHaveAttribute("autocomplete", "new-password")
  })

  it("パスワードは表示・非表示を切り替えられる", async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)
    const password = document.getElementById("password") as HTMLInputElement

    expect(password).toHaveAttribute("type", "password")
    await user.click(screen.getByRole("button", { name: "入力したパスワードを表示する" }))
    expect(password).toHaveAttribute("type", "text")
    await user.click(screen.getByRole("button", { name: "入力したパスワードを隠す" }))
    expect(password).toHaveAttribute("type", "password")
  })

  it("氏名を聞かず、メールとパスワードだけで登録し、送ったあとは確認メールの案内を出す", async () => {
    mocks.signUp.mockResolvedValueOnce({ data: { user: { identities: [{ id: "identity" }] }, session: null }, error: null })
    const user = userEvent.setup()
    render(<RegisterForm />)

    expect(screen.queryByLabelText(/氏名/)).not.toBeInTheDocument()
    expect(screen.getByText(/お名前は不要です/)).toBeInTheDocument()

    await fillAndSubmit(user)

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledTimes(1))
    expect(mocks.signUp).toHaveBeenCalledWith({ email: "parent@example.com", password: "password1" })
    expect(await screen.findByRole("heading", { name: "確認のメールを送りました" })).toBeInTheDocument()
    expect(screen.getByTestId("register-mail-sent")).toHaveTextContent("parent@example.com")
    expect(screen.getByRole("heading", { name: "メールが届かないとき" })).toBeInTheDocument()
    expect(screen.getByText(/迷惑メールのフォルダ/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "ログインの画面へ" })).toHaveAttribute("href", "/login")
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it("確認メールは、少し待ってからもう一度送れる(送れなかった理由も日本語で出す)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      mocks.signUp.mockResolvedValueOnce({ data: { user: { identities: [{ id: "identity" }] }, session: null }, error: null })
      mocks.resend.mockResolvedValueOnce({ error: { message: "Email rate limit exceeded", code: "over_email_send_rate_limit" } })
      mocks.resend.mockResolvedValueOnce({ error: null })
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(<RegisterForm />)
      await fillAndSubmit(user)

      const resend = await screen.findByRole("button", { name: /確認メールをもう一度送る/ })
      // 送った直後は、続けて押せない
      expect(resend).toBeDisabled()
      await act(async () => {
        vi.advanceTimersByTime(61_000)
      })
      expect(resend).toBeEnabled()

      await user.click(resend)
      expect(mocks.resend).toHaveBeenCalledWith({ type: "signup", email: "parent@example.com" })
      expect(await screen.findByRole("alert")).toHaveTextContent(RATE_LIMIT_MESSAGE)

      await act(async () => {
        vi.advanceTimersByTime(61_000)
      })
      await user.click(screen.getByRole("button", { name: /確認メールをもう一度送る/ }))
      expect(await screen.findByRole("status")).toHaveTextContent("もう一度送りました")
    } finally {
      vi.useRealTimers()
    }
  })

  it("アドレスを打ちまちがえたときは、入力しなおせる(入れたアドレスは残す)", async () => {
    mocks.signUp.mockResolvedValueOnce({ data: { user: { identities: [{ id: "identity" }] }, session: null }, error: null })
    const user = userEvent.setup()
    render(<RegisterForm />)
    await fillAndSubmit(user, "parnet@example.com")

    await user.click(await screen.findByRole("button", { name: "メールアドレスを入力しなおす" }))

    expect(screen.getByLabelText(/メールアドレス/)).toHaveValue("parnet@example.com")
  })

  it("メールの確認を求めない設定では、そのままホームへ移る", async () => {
    mocks.signUp.mockResolvedValueOnce({ data: { user: { identities: [{ id: "identity" }] }, session: { access_token: "t" } }, error: null })
    const user = userEvent.setup()
    render(<RegisterForm />)
    await fillAndSubmit(user)

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/landing"))
    expect(screen.queryByTestId("register-mail-sent")).not.toBeInTheDocument()
  })

  it("maps an existing account to the approved inline recovery", async () => {
    mocks.signUp.mockResolvedValueOnce({
      data: { user: { identities: [] } },
      error: null,
    })
    const user = userEvent.setup()
    render(<RegisterForm />)

    await fillAndSubmit(user, "demo@example.com")

    await waitFor(() => expect(screen.getByText(DUPLICATE_EMAIL_MESSAGE)).toBeInTheDocument())
    expect(DUPLICATE_EMAIL_MESSAGE).toBe("このメールアドレスは登録済みです")
    expect(screen.getByRole("link", { name: "ログインへすすむ" })).toHaveAttribute("href", "/login?next=%2Fmap")
    expect(screen.getByLabelText(/メールアドレス/)).toHaveFocus()
  })

  it("変換できないエラーは、英語のまま出さず日本語の文にする", async () => {
    mocks.signUp.mockResolvedValueOnce({ data: {}, error: { message: "Database error saving new user" } })
    const user = userEvent.setup()
    render(<RegisterForm />)
    await fillAndSubmit(user)

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("登録できませんでした。時間をおいて、もう一度お試しください。")
    expect(alert).not.toHaveTextContent("Database")
  })
})
