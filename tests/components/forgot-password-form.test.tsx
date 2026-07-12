import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ForgotPasswordPage from "@/app/forgot-password/page"

const mocks = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn() }))

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: () => ({ auth: { resetPasswordForEmail: mocks.resetPasswordForEmail } }),
}))
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

describe("ForgotPasswordPage", () => {
  beforeEach(() => vi.clearAllMocks())

  it("shows a concrete inline format error and focuses the email field", async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    const input = screen.getByTestId("forgot-password-email")
    await user.type(input, "ux-test-invalid")
    await user.click(screen.getByTestId("forgot-password-submit"))

    expect(screen.getByRole("alert")).toHaveTextContent("例: name@example.com")
    expect(input).toHaveFocus()
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it("distinguishes rate limiting from a generic failure", async () => {
    mocks.resetPasswordForEmail.mockResolvedValueOnce({ error: { message: "rate limit exceeded" } })
    const user = userEvent.setup()
    render(<ForgotPasswordPage />)

    await user.type(screen.getByTestId("forgot-password-email"), "demo@example.com")
    await user.click(screen.getByTestId("forgot-password-submit"))

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("少し待ってから"))
  })
})
