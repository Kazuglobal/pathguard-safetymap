import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}))

import PrivacyPage from "@/app/privacy/page"
import { RETENTION_DAYS } from "@/lib/retention/policy"
import { BRAND } from "@/lib/brand"

describe("プライバシーポリシーは実際の動きと同じことを書く(UIUX改装 項目55〜62)", () => {
  it("氏名を預からないこと、写真は端末でぼかしてから外部の AI サービスに送ること、不具合の記録で録画をしないことを書く", () => {
    const { container } = render(<PrivacyPage />)
    const text = container.textContent ?? ""

    expect(text).toContain("氏名は預かりません")
    expect(text).not.toMatch(/氏名、メールアドレスなどアカウント登録情報/)
    expect(text).toContain("外部の AI サービス(米国の事業者)へ送ります")
    expect(text).toContain("保存するのは、このぼかした写真だけです")
    expect(text).toContain("通常時の画面の録画はしません")
    expect(text).toContain("道すじの両端それぞれ200m以上(削る長さは毎回変えます)は保存せず")
  })

  // 会社名は、規約で開示が必要な Google(アナリティクス・マップ)だけ。ほかは役割で書き、問い合わせがあれば答える
  it("Google 以外の外部の事業者は名前を出さず役割で書き、問い合わせがあれば答えると書く", () => {
    const { container } = render(<PrivacyPage />)
    const text = container.textContent ?? ""

    for (const name of ["Supabase", "Cloudflare", "Gemini", "Anthropic", "Claude", "OpenAI", "Sentry", "Mapbox", "Resend"]) {
      expect(text, name).not.toContain(name)
    }
    expect(text).toContain("Google Maps")
    expect(text).toContain("名前を書いていない事業者は、お問い合わせいただければお答えします")
  })

  it("保存の期間の表は lib/retention/policy.ts の値と同じ", () => {
    render(<PrivacyPage />)
    const table = screen.getByTestId("privacy-retention-table")

    expect(within(table).getByText(`作成から${RETENTION_DAYS.unpublishedReport}日`)).toBeInTheDocument()
    expect(within(table).getByText(`公開から${RETENTION_DAYS.publishedReport / 365}年(解決済みは解決から${RETENTION_DAYS.resolvedReport}日)`)).toBeInTheDocument()
    // 作成の記録とバックアップは、どちらも30日
    expect(within(table).getAllByText(`${RETENTION_DAYS.backup}日`)).toHaveLength(RETENTION_DAYS.backup === RETENTION_DAYS.reportCreateHistory ? 2 : 1)
  })

  it("お知らせの「くわしく」から飛べる改定の履歴がある", () => {
    const { container } = render(<PrivacyPage />)
    expect(container.querySelector("#revisions")).toHaveTextContent("2026年10月29日")
  })

  // 個人情報保護法32条1項: 氏名・住所、開示などの手続、安全管理措置を「本人の知り得る状態(求めに応じて遅滞なく回答する場合を含む)」に置く
  it("運営者の氏名と、住所は求めに応じて知らせること、開示などのご請求の方法、安全管理のためにしていることを書く", () => {
    const { container } = render(<PrivacyPage />)
    const text = container.textContent ?? ""

    expect(text).toContain(`運営者: ${BRAND.operator}`)
    expect(text).toContain("住所: お問い合わせいただければ、遅滞なくお知らせします")
    expect(text).toContain("開示")
    expect(text).toContain("利用の停止・消去")
    expect(text).toContain("手数料はいただきません")
    expect(text).toContain("安全管理のためにしていること")
    expect(text).toContain("主に日本と米国のサーバーで保存・処理されることがあります")
    // 外的環境の把握: 保存先の国の制度を、個人情報保護委員会の資料で示す
    expect(screen.getByRole("link", { name: "個人情報保護委員会の資料(アメリカ合衆国)" })).toHaveAttribute(
      "href",
      "https://www.ppc.go.jp/enforcement/infoprovision/laws/offshore_report_america/",
    )
    expect(screen.getByRole("link", { name: "お問い合わせページ" })).toHaveAttribute("href", "/contact")
  })

  it("Google アナリティクスを使わないときは、Cookie を使う解析ツールは入れていないと書く", () => {
    const { container } = render(<PrivacyPage />)
    expect(container.textContent).toContain("Cookie を使うアクセス解析ツールは導入していません")
  })

  it("Google アナリティクスを使うときは、Cookie の節でもそれを書き、「第三者のトラッキングは行っていません」と食い違わない", async () => {
    vi.resetModules()
    vi.doMock("@/lib/google-analytics", () => ({ GA_MEASUREMENT_ID: "G-TEST1234" }))
    try {
      const { default: PageWithGa } = await import("@/app/privacy/page")
      const { container } = render(<PageWithGa />)
      const text = container.textContent ?? ""

      expect(text).not.toContain("第三者のトラッキングは行っていません")
      expect(text).toContain("Google アナリティクスが Cookie などの識別子を使います")
    } finally {
      vi.doUnmock("@/lib/google-analytics")
      vi.resetModules()
    }
  })
})
