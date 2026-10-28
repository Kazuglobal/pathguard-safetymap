/**
 * ヘッダーのログイン状態表示(UIUX改装 項目17)と、タブレット幅の下部ナビ(768〜1023px 欠落の修正)。
 */
import { beforeAll, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import { Navigation } from "@/components/ui/navigation"

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any
})

vi.mock("next/navigation", () => ({
  usePathname: () => "/routes",
}))

vi.mock("framer-motion", () => {
  const strip =
    (Tag: any) =>
    ({ children, layoutId, initial, animate, exit, transition, whileTap, whileHover, variants, custom, ...props }: any) =>
      <Tag {...props}>{children}</Tag>
  return {
    motion: { div: strip("div"), span: strip("span"), button: strip("button"), svg: strip("svg") },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useReducedMotion: () => false,
  }
})

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}))

vi.mock("@/components/report/report-bottom-sheet", () => ({
  ReportBottomSheet: () => null,
}))

vi.mock("@/lib/admin", () => ({
  isAdminUser: () => false,
}))

const user = { id: "u1", email: "taro.yamada@example.com" }

describe("Navigation のログイン状態表示", () => {
  it("確定前は「ログイン」「新規登録」を出さずプレースホルダを出す", () => {
    render(<Navigation user={null} authStatus="loading" onLogout={vi.fn()} />)

    expect(screen.getByTestId("auth-placeholder")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "ログイン" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "新規登録" })).not.toBeInTheDocument()
  })

  it("未ログインと確定したらログイン導線を出す", () => {
    render(<Navigation user={null} authStatus="unauthenticated" onLogout={vi.fn()} />)

    expect(screen.queryByTestId("auth-placeholder")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "ログイン" })).toBeInTheDocument()
  })

  it("表示名があれば表示名を出し、メールアドレスの一部は出さない", () => {
    render(<Navigation user={user} authStatus="authenticated" displayName="さくらママ" onLogout={vi.fn()} />)

    expect(screen.getByTestId("user-info")).toHaveTextContent("さくらママ")
    expect(screen.queryByText("taro.yamada")).not.toBeInTheDocument()
  })

  it("表示名が未設定なら名前を出さず「ログイン中」だけを出す", () => {
    render(<Navigation user={user} authStatus="authenticated" displayName={null} onLogout={vi.fn()} />)

    expect(screen.getByTestId("user-info")).toHaveTextContent("ログイン中")
    expect(screen.queryByText("taro.yamada")).not.toBeInTheDocument()
    expect(screen.queryByText("ユーザー")).not.toBeInTheDocument()
  })

  it("authStatus を省略したときは user の有無で決める(従来の呼び出し互換)", () => {
    render(<Navigation user={user} onLogout={vi.fn()} />)
    expect(screen.queryByTestId("auth-placeholder")).not.toBeInTheDocument()
    expect(screen.getByTestId("logout-button")).toBeInTheDocument()
  })
})

describe("Navigation の下部ナビ", () => {
  it("タブレット幅(md)でも消えないよう lg 以上でだけ隠す", () => {
    const { container } = render(<Navigation user={user} authStatus="authenticated" onLogout={vi.fn()} />)
    const bottomNav = container.querySelector("nav.fixed.bottom-0")

    expect(bottomNav).not.toBeNull()
    expect(bottomNav?.className).toContain("lg:hidden")
    expect(bottomNav?.className).not.toContain("md:hidden")
  })
})
