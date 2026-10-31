import React from "react"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AuthStatus } from "@/components/providers/auth-context"

const mocks = vi.hoisted(() => ({ status: "authenticated" as AuthStatus, isMobile: true }))

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mocks.isMobile }))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/providers/auth-context", () => ({
  useOptionalAuth: () => ({ status: mocks.status }),
}))

vi.mock("@/components/notifications/notification-bell", () => ({
  NotificationBell: ({ isLoggedIn }: { isLoggedIn?: boolean }) => (isLoggedIn ? <button type="button" aria-label="通知" /> : null),
}))

import { StickyHeader } from "@/components/landing/StickyHeader"

describe("ホームのスマホ用ヘッダー(UIUX改装 項目37)", () => {
  beforeEach(() => {
    mocks.status = "authenticated"
    mocks.isMobile = true
  })

  it("ログイン中は、スマホでもお知らせのベルを出す(地図のボタンより右)", () => {
    render(<StickyHeader />)

    const bell = screen.getByRole("button", { name: "通知" })
    const mapLink = screen.getByRole("link", { name: "地図をみる" })
    expect(mapLink.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("パソコンの幅では、このヘッダーのベルは動かさない(上のナビのベルと2つで通知を読まない)", () => {
    mocks.isMobile = false
    render(<StickyHeader />)

    expect(screen.queryByRole("button", { name: "通知" })).toBeNull()
  })

  it("ログイン状態の確認中・ログインしていないときはベルを出さない", () => {
    for (const status of ["loading", "unauthenticated"] as const) {
      mocks.status = status
      const { unmount } = render(<StickyHeader />)
      expect(screen.queryByRole("button", { name: "通知" })).toBeNull()
      unmount()
    }
  })
})
