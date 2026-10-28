/**
 * LayoutProvider のログイン状態(UIUX改装 項目17)と、ログアウト時の移動の統一(項目29・53)。
 */
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const router = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }
let pathname = "/routes"

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}))

type AuthCallback = (event: string, session: { user: { id: string } } | null) => void
let authCallback: AuthCallback | null = null

const fakeSupabase = {
  auth: {
    getUser: vi.fn(),
    onAuthStateChange: vi.fn((cb: AuthCallback) => {
      authCallback = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    signOut: vi.fn(async () => {
      // 本物と同じく、サインアウト中に SIGNED_OUT が届く
      authCallback?.("SIGNED_OUT", null)
      return { error: null }
    }),
  },
}

vi.mock("@/components/providers/supabase-provider", () => ({
  SupabaseProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSupabase: () => ({ supabase: fakeSupabase }),
  isAbortLikeFetchError: () => false,
}))

vi.mock("@/components/ui/navigation-wrapper", () => ({
  NavigationWrapper: ({ children, authStatus, displayName, onLogout }: any) => (
    <div>
      <div data-testid="nav" data-status={authStatus} data-name={displayName ?? ""} />
      <button type="button" onClick={() => onLogout()}>
        ログアウト
      </button>
      {children}
    </div>
  ),
}))

vi.mock("@/components/ui/toaster", () => ({ Toaster: () => null }))
vi.mock("@/components/notifications/push-permission-prompt", () => ({ PushPermissionPrompt: () => null }))
vi.mock("@/components/onboarding/app-onboarding-gate", () => ({ AppOnboardingGate: () => null }))
vi.mock("@/components/pwa/service-worker-registrar", () => ({ ServiceWorkerRegistrar: () => null }))
vi.mock("@/components/pwa/ios-install-prompt", () => ({ IosInstallPrompt: () => null }))

import { LayoutProvider } from "@/components/providers/layout-provider"

const fetchMock = vi.fn()

beforeEach(() => {
  router.replace.mockReset()
  router.refresh.mockReset()
  fakeSupabase.auth.getUser.mockReset()
  fakeSupabase.auth.signOut.mockClear()
  authCallback = null
  pathname = "/routes"
  window.history.pushState({}, "", "/routes?tab=1")
  fetchMock.mockReset()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ profile: { display_name: "さくらママ" } }) })
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("LayoutProvider のログイン状態", () => {
  it("確定前は loading、ログインが確かめられたら authenticated と表示名になる", async () => {
    let resolveUser: (value: unknown) => void = () => {}
    fakeSupabase.auth.getUser.mockReturnValue(new Promise((resolve) => (resolveUser = resolve)))

    render(<LayoutProvider>本文</LayoutProvider>)
    expect(screen.getByTestId("nav")).toHaveAttribute("data-status", "loading")

    await act(async () => {
      resolveUser({ data: { user: { id: "u1" } }, error: null })
    })

    await waitFor(() => expect(screen.getByTestId("nav")).toHaveAttribute("data-status", "authenticated"))
    await waitFor(() => expect(screen.getByTestId("nav")).toHaveAttribute("data-name", "さくらママ"))
    expect(fetchMock).toHaveBeenCalledWith("/api/profile", expect.objectContaining({ credentials: "same-origin" }))
  })

  it("セッションが無ければ unauthenticated になり、プロフィールは取りに行かない", async () => {
    fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth session missing!" } })

    render(<LayoutProvider>本文</LayoutProvider>)

    await waitFor(() => expect(screen.getByTestId("nav")).toHaveAttribute("data-status", "unauthenticated"))
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("ログアウト時の移動", () => {
  it("期限切れなどで SIGNED_OUT になったら、保護ページはその場で戻り先つきのログインへ移す", async () => {
    fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null })
    render(<LayoutProvider>本文</LayoutProvider>)
    await waitFor(() => expect(screen.getByTestId("nav")).toHaveAttribute("data-status", "authenticated"))

    act(() => authCallback?.("SIGNED_OUT", null))

    expect(router.replace).toHaveBeenCalledWith("/login?next=%2Froutes%3Ftab%3D1")
    expect(screen.getByTestId("nav")).toHaveAttribute("data-status", "unauthenticated")
  })

  it("公開ページでは SIGNED_OUT でも移動しない", async () => {
    pathname = "/landing"
    window.history.pushState({}, "", "/landing")
    fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null })
    render(<LayoutProvider>本文</LayoutProvider>)
    await waitFor(() => expect(screen.getByTestId("nav")).toHaveAttribute("data-status", "authenticated"))

    act(() => authCallback?.("SIGNED_OUT", null))

    expect(router.replace).not.toHaveBeenCalled()
  })

  it("自分でログアウトしたら、どの画面からでも /login?loggedOut=1 へ移る(戻り先つきの移動は起きない)", async () => {
    fakeSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null })
    render(<LayoutProvider>本文</LayoutProvider>)
    await waitFor(() => expect(screen.getByTestId("nav")).toHaveAttribute("data-status", "authenticated"))

    await userEvent.click(screen.getByRole("button", { name: "ログアウト" }))

    expect(fakeSupabase.auth.signOut).toHaveBeenCalledTimes(1)
    expect(router.replace).toHaveBeenCalledTimes(1)
    expect(router.replace).toHaveBeenCalledWith("/login?loggedOut=1")
  })
})
