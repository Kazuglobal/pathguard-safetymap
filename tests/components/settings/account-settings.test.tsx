import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  email: "parent@example.com" as string | null,
  metadata: {} as Record<string, unknown>,
}))

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }))
vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({ supabase: { auth: { signOut: mocks.signOut, updateUser: mocks.updateUser } } }),
}))
vi.mock("@/components/providers/auth-context", () => ({
  useOptionalAuth: () => ({ user: { id: "user-1", email: mocks.email, user_metadata: mocks.metadata } }),
}))

import { AccountCredentialsSettings } from "@/components/settings/account-credentials-settings"
import { AccountDeletionSettings } from "@/components/settings/account-deletion-settings"
import { DEMO_ACCOUNT_LOCKED_MESSAGE } from "@/lib/auth/demo-account"
import { PASSWORD_RULES_ERROR } from "@/lib/auth/password-rules"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.email = "parent@example.com"
  mocks.metadata = {}
  mocks.signOut.mockResolvedValue({ error: null })
  mocks.updateUser.mockResolvedValue({ data: {}, error: null })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("AccountDeletionSettings(退会。UIUX改装 項目40)", () => {
  it("消えるものを見せ、「さくじょ」と入力するまで押せない。確定したら端末の通学路も消してログアウトする", async () => {
    localStorage.setItem("pathguardian:route-full-geometry:v1:user-1", "{}")
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ deleted: true }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const user = userEvent.setup()
    render(<AccountDeletionSettings />)

    await user.click(screen.getByRole("button", { name: "アカウントを削除する" }))
    expect(screen.getByText(/通学路とお子さまの登録/)).toBeInTheDocument()
    const submit = screen.getByRole("button", { name: "すべて削除して退会する" })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText(/と入力してください/), "さくじょ")
    await user.click(submit)

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/login?deleted=1"))
    expect(fetchMock).toHaveBeenCalledWith("/api/account", expect.objectContaining({ method: "DELETE", body: JSON.stringify({ confirm: "さくじょ" }) }))
    expect(mocks.signOut).toHaveBeenCalled()
    expect(localStorage.getItem("pathguardian:route-full-geometry:v1:user-1")).toBeNull()
  })

  it("失敗したら理由を出し、ログアウトしない", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "退会の処理を最後まで終えられませんでした。" }), { status: 500 })))
    const user = userEvent.setup()
    render(<AccountDeletionSettings />)

    await user.click(screen.getByRole("button", { name: "アカウントを削除する" }))
    await user.type(screen.getByLabelText(/と入力してください/), "さくじょ")
    await user.click(screen.getByRole("button", { name: "すべて削除して退会する" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("最後まで終えられませんでした")
    expect(mocks.signOut).not.toHaveBeenCalled()
  })
})

describe("AccountCredentialsSettings(メール・パスワード。UIUX改装 項目46)", () => {
  it("メールは確認のメールを送り、パスワードは条件を満たしたら変える", async () => {
    const user = userEvent.setup()
    render(<AccountCredentialsSettings />)

    await user.type(screen.getByLabelText("メールアドレスを変える"), "new@example.com")
    await user.click(screen.getByRole("button", { name: "確認のメールを送る" }))
    expect(await screen.findByText(/確認のメールを送りました/)).toBeInTheDocument()
    expect(mocks.updateUser).toHaveBeenCalledWith({ email: "new@example.com" })

    await user.type(screen.getByLabelText("パスワードを変える"), "short")
    await user.click(screen.getByRole("button", { name: "パスワードを変える" }))
    expect(screen.getByRole("alert")).toHaveTextContent(PASSWORD_RULES_ERROR)
    expect(mocks.updateUser).toHaveBeenCalledTimes(1)

    await user.clear(screen.getByLabelText("パスワードを変える"))
    await user.type(screen.getByLabelText("パスワードを変える"), "password123")
    await user.click(screen.getByRole("button", { name: "パスワードを変える" }))
    expect(await screen.findByText("パスワードを変えました。")).toBeInTheDocument()
    expect(mocks.updateUser).toHaveBeenLastCalledWith({ password: "password123" })
  })

  it("デモのアカウント(共用)では、メール・パスワードの変更と削除を出さない", () => {
    mocks.email = "demo@example.com"
    render(
      <>
        <AccountCredentialsSettings />
        <AccountDeletionSettings />
      </>,
    )

    expect(screen.getAllByText(DEMO_ACCOUNT_LOCKED_MESSAGE)).toHaveLength(2)
    expect(screen.queryByLabelText("メールアドレスを変える")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("パスワードを変える")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "アカウントを削除する" })).not.toBeInTheDocument()
  })

  it("メールの形の確かめと例示は、登録の画面と同じ", async () => {
    const user = userEvent.setup()
    render(<AccountCredentialsSettings />)

    expect(screen.getByLabelText("メールアドレスを変える")).toHaveAttribute("placeholder", "例: name@example.com")
    await user.type(screen.getByLabelText("メールアドレスを変える"), "abc")
    await user.click(screen.getByRole("button", { name: "確認のメールを送る" }))
    expect(screen.getByRole("alert")).toHaveTextContent("例: name@example.com の形で入力してください")
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it("LINE でログインしているアカウントでは、メールとパスワードを変えさせない", () => {
    mocks.email = "line-abc@line.auth.local"
    render(<AccountCredentialsSettings />)

    expect(screen.getByText(/LINE でログインしているアカウントです/)).toBeInTheDocument()
    expect(screen.queryByLabelText("メールアドレスを変える")).not.toBeInTheDocument()
  })

  it("LINE から本物のメールが届いた LINE のアカウントでも、メールを変えさせない(変えると次の LINE ログインで別のアカウントになる)", () => {
    mocks.email = "taro@example.com"
    mocks.metadata = { provider: "line", line_user_id: "U1234567890" }
    render(<AccountCredentialsSettings />)

    expect(screen.getByText(/LINE でログインしているアカウントです/)).toBeInTheDocument()
    expect(screen.queryByLabelText("メールアドレスを変える")).not.toBeInTheDocument()
  })
})
