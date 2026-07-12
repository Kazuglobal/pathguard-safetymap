import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import RegisterForm from "@/components/auth/register-form"

const mocks = vi.hoisted(() => ({
  signUp: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({ supabase: { auth: { signUp: mocks.signUp } } }),
}))
vi.mock("@/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("@/components/auth/social-login-buttons", () => ({ SocialLoginButtons: () => null }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

describe("RegisterForm", () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows live password requirements and focuses the first invalid field", async () => {
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.click(screen.getByRole("button", { name: "登録する" }))

    expect(screen.getByLabelText(/氏名/)).toHaveFocus()
    expect(screen.getByText("氏名を入力してください")).toBeInTheDocument()
    expect(screen.getByText("英字（アルファベット）を含めてください")).toBeInTheDocument()
    expect(screen.getAllByText("必須").length).toBeGreaterThanOrEqual(4)
  })

  it("maps an existing account to the approved inline recovery", async () => {
    mocks.signUp.mockResolvedValueOnce({
      data: { user: { identities: [] } },
      error: null,
    })
    const user = userEvent.setup()
    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/氏名/), "山田 太郎")
    await user.type(screen.getByLabelText(/メールアドレス/), "demo@example.com")
    await user.type(document.getElementById("password") as HTMLInputElement, "password1")
    await user.click(screen.getByTestId("agree-to-terms-checkbox"))
    await user.click(screen.getByRole("button", { name: "登録する" }))

    await waitFor(() => expect(screen.getByText("このメールは登録ずみです")).toBeInTheDocument())
    expect(screen.getByRole("link", { name: "ログインへすすむ" })).toHaveAttribute("href", "/login?next=%2Fmap")
    expect(screen.getByLabelText(/メールアドレス/)).toHaveFocus()
  })
})
