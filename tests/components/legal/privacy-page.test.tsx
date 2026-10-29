import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}))

import PrivacyPage from "@/app/privacy/page"
import { RETENTION_DAYS } from "@/lib/retention/policy"

describe("プライバシーポリシーは実際の動きと同じことを書く(UIUX改装 項目55〜62)", () => {
  it("氏名を預からないこと、写真は端末でぼかしてから3つの AI に送ること、Sentry の録画をしないことを書く", () => {
    const { container } = render(<PrivacyPage />)
    const text = container.textContent ?? ""

    expect(text).toContain("氏名は預かりません")
    expect(text).not.toMatch(/氏名、メールアドレスなどアカウント登録情報/)
    expect(text).toContain("Google(Gemini)・Anthropic(Claude)・OpenAI")
    expect(text).toContain("保存するのは、このぼかした写真だけです")
    expect(text).toContain("通常時の画面の録画はしません")
    expect(text).toContain("両端200mの道すじは保存せず")
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
})
