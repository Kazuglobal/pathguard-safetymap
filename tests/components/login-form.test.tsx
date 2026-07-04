import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import LoginForm from "@/components/auth/login-form"

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  toast: vi.fn(),
  signInWithPassword: vi.fn(),
  onAuthStateChange: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
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
    expect(mocks.push).toHaveBeenCalledWith("/landing")
  })
})
