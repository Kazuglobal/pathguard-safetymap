import { fireEvent, render, screen } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

const sentry = vi.hoisted(() => ({ captureException: vi.fn() }))
vi.mock("@sentry/nextjs", () => sentry)

import ContactPage from "@/app/contact/page"
import ErrorPage from "@/app/error"
import GlobalError from "@/app/global-error"
import NotFound from "@/app/not-found"
import { SiteFooter } from "@/components/layout/site-footer"
import { PageLoading } from "@/components/layout/page-loading"

/** 全画面に共通の外枠(フッター・404・エラー・読み込み中・お問い合わせ)。UIUX改装 項目4・32・41・42 */
describe("共通のフッター", () => {
  it("規約・プライバシー・お問い合わせ・公式 Instagram・運営者の表記を出す", () => {
    render(<SiteFooter />)

    expect(screen.getByRole("link", { name: "利用規約" })).toHaveAttribute("href", "/terms")
    expect(screen.getByRole("link", { name: "プライバシーポリシー" })).toHaveAttribute("href", "/privacy")
    expect(screen.getByRole("link", { name: "お問い合わせ" })).toHaveAttribute("href", "/contact")
    const instagram = screen.getByRole("link", { name: /公式Instagram @kiken_hunter_jp/ })
    expect(instagram).toHaveAttribute("href", "https://www.instagram.com/kiken_hunter_jp/")
    expect(instagram).toHaveAttribute("target", "_blank")
    expect(screen.getByText("運営者の表記は準備中です")).toBeInTheDocument()
    expect(screen.getByTestId("brand-logo")).toHaveTextContent("PathGuardian")
  })

  it("スマホの下部タブバーがある画面では、その高さぶん下を空ける", () => {
    const { rerender } = render(<SiteFooter />)
    expect(screen.getByTestId("site-footer").className).toContain("pb-8")
    rerender(<SiteFooter reserveBottomNav />)
    expect(screen.getByTestId("site-footer").className).toContain("pb-28")
  })
})

describe("見つからないページ・エラーの画面は日本語で、戻り道を出す", () => {
  it("404 はホームと地図への入口を出す", () => {
    render(<NotFound />)
    expect(screen.getByRole("heading", { name: "ページが見つかりません" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "ホームへ" })).toHaveAttribute("href", "/landing")
    expect(screen.getByRole("link", { name: "地図をひらく" })).toHaveAttribute("href", "/map")
  })

  it("画面のエラーは、もう一度読み込む・ホームへを出し、エラーの中身は画面に出さない", () => {
    const retry = vi.fn()
    const error = Object.assign(new Error("D1_ERROR: no such column: secret_detail"), { digest: "123abc" })
    render(<ErrorPage error={error} retry={retry} />)

    fireEvent.click(screen.getByRole("button", { name: "もう一度読み込む" }))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("link", { name: "ホームへ" })).toHaveAttribute("href", "/landing")
    expect(screen.getByRole("alert")).not.toHaveTextContent("D1_ERROR")
    expect(screen.getByRole("alert")).toHaveTextContent("123abc")
    expect(sentry.captureException).toHaveBeenCalledWith(error)
  })

  it("ルートの layout ごと壊れたときの画面も日本語(英語の既定の画面を出さない)", () => {
    // global-error は html/body ごと描くので、文字列にして確かめる
    const html = renderToStaticMarkup(<GlobalError error={new Error("boom")} reset={vi.fn()} />)
    expect(html).toContain('<html lang="ja">')
    expect(html).toContain("画面を表示できませんでした")
    expect(html).toContain("もう一度読み込む")
    expect(html).toContain('href="/landing"')
    expect(html).not.toMatch(/Application error|Try again|Something went wrong|boom/)
  })

  it("読み込み中の表示は、読み上げにも状態を伝える", () => {
    render(<PageLoading label="マイページを準備しています…" />)
    expect(screen.getByRole("status")).toHaveTextContent("マイページを準備しています…")
  })
})

describe("お問い合わせ(項目4・40)", () => {
  it("公開の場(GitHub)に誘導せず、フォームは準備中と出し、削除は設定から自分でできると案内する", () => {
    const { container } = render(<ContactPage />)

    expect(container.innerHTML).not.toContain("github.com")
    expect(container.textContent).not.toContain("GitHub")
    expect(screen.getByTestId("contact-form-preparing")).toHaveTextContent("準備中")
    expect(container.textContent).toContain("「アカウントを削除」")
    expect(screen.getByRole("link", { name: "マイページを開く" })).toHaveAttribute("href", "/mypage")
  })
})
