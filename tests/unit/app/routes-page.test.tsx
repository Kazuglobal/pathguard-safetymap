import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  // 認証確認が返ってこない状況を作る（返るまで待つ実装なら見出しが出ない）
  getUser: vi.fn(() => new Promise(() => {})),
  getSession: vi.fn(() => new Promise(() => {})),
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("@/components/providers/supabase-provider", () => ({
  useSupabase: () => ({ supabase: { auth: { getUser: h.getUser, getSession: h.getSession } } }),
  useOptionalSupabase: () => undefined,
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, replace: h.replace }),
}))

vi.mock("@/components/map/route-manager", () => ({
  RouteManager: ({ onRouteSelect }: { onRouteSelect?: (route: { id: string; name: string }) => void }) => (
    <div data-testid="route-manager-stub">
      <button type="button" onClick={() => onRouteSelect?.({ id: "route-1", name: "さくらの通学路" })}>
        ルートを選ぶ
      </button>
    </div>
  ),
}))

import RoutesPage from "@/app/routes/page"

describe("/routes ページ", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("認証確認を待たずに、見出しと通学路の一覧をすぐ出す", () => {
    render(<RoutesPage />)

    expect(screen.getByRole("heading", { level: 1, name: /うちの子の通学路/ })).toBeInTheDocument()
    expect(
      screen.getByText("いつもの道をとうろくすると、毎朝の「通学3分チェック」で注意点がわかります")
    ).toBeInTheDocument()
    expect(screen.getByTestId("route-manager-stub")).toBeInTheDocument()
    // 保護は middleware.ts が受け持つので、ページでは認証を確認し直さず遷移もしない
    expect(h.getUser).not.toHaveBeenCalled()
    expect(h.push).not.toHaveBeenCalled()
    expect(h.replace).not.toHaveBeenCalled()
  })

  it("一覧でルートを選ぶと、選択中のルート名を出す", async () => {
    render(<RoutesPage />)

    await userEvent.click(screen.getByRole("button", { name: "ルートを選ぶ" }))

    expect(screen.getByText("さくらの通学路")).toBeInTheDocument()
    expect(screen.getByText(/選択中:/)).toBeInTheDocument()
  })
})
