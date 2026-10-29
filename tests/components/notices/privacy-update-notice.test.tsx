import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { NAME_REMOVAL_NOTICE_KEY, PrivacyUpdateNotice } from "@/components/notices/privacy-update-notice"

const mocks = vi.hoisted(() => ({ pathname: "/mypage", tutorialPending: false }))

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }))
vi.mock("@/lib/tutorial-storage", () => ({ shouldShowTutorial: () => mocks.tutorialPending }))
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}))

describe("PrivacyUpdateNotice(氏名を預からないしくみのお知らせ)", () => {
  beforeEach(() => {
    localStorage.clear()
    mocks.pathname = "/mypage"
    mocks.tutorialPending = false
  })

  it("まだ見ていなければ出し、閉じたらこの端末では二度と出さない", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<PrivacyUpdateNotice />)

    expect(screen.getByRole("status")).toHaveTextContent("お名前(氏名)を預からないしくみにしました")
    await user.click(screen.getByRole("button", { name: "わかりました" }))
    expect(screen.queryByTestId("privacy-update-notice")).not.toBeInTheDocument()
    expect(localStorage.getItem(NAME_REMOVAL_NOTICE_KEY)).toBe("1")

    unmount()
    render(<PrivacyUpdateNotice />)
    expect(screen.queryByTestId("privacy-update-notice")).not.toBeInTheDocument()
  })

  it("「くわしく」はプライバシーポリシーの改定履歴へ移り、見たことにする", async () => {
    const user = userEvent.setup()
    render(<PrivacyUpdateNotice />)

    const link = screen.getByRole("link", { name: "くわしく(プライバシーポリシー)" })
    expect(link).toHaveAttribute("href", "/privacy#revisions")
    await user.click(link)
    expect(localStorage.getItem(NAME_REMOVAL_NOTICE_KEY)).toBe("1")
  })

  it("初回の絵本オンボーディングが出る /landing では重ねず、見たことにもしない", () => {
    mocks.pathname = "/landing"
    mocks.tutorialPending = true
    render(<PrivacyUpdateNotice />)

    expect(screen.queryByTestId("privacy-update-notice")).not.toBeInTheDocument()
    expect(localStorage.getItem(NAME_REMOVAL_NOTICE_KEY)).toBeNull()
  })

  it("保存ができない環境では、毎回出してしまわないよう出さない", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied") })
    render(<PrivacyUpdateNotice />)

    expect(screen.queryByTestId("privacy-update-notice")).not.toBeInTheDocument()
    getItem.mockRestore()
  })
})
