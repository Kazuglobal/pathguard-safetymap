import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DailyCommuteCheckCard } from "@/components/landing/DailyCommuteCheckCard"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

describe("DailyCommuteCheckCard", () => {
  it("renders a public-safe default state without fabricated personalized data", () => {
    render(<DailyCommuteCheckCard />)

    expect(screen.getByText("今日の通学3分チェック")).toBeInTheDocument()
    expect(screen.getByText("通学前に危険情報やルート設定状況を30秒で確認できます。")).toBeInTheDocument()
    expect(screen.getByText("0件")).toBeInTheDocument()
    expect(screen.getByText("未設定")).toBeInTheDocument()
    expect(screen.getByText("未更新")).toBeInTheDocument()
    expect(screen.queryByText("登録した通学路向けの注意点を30秒で確認できます。")).not.toBeInTheDocument()
  })

  it("renders explicit values when route data is provided", () => {
    render(
      <DailyCommuteCheckCard
        cautionCount={3}
        routeConfigured={true}
        lastUpdatedDaysAgo={1}
        mapHref="/map?source=landing"
      />
    )

    expect(screen.getByText("3件")).toBeInTheDocument()
    expect(screen.getByText("設定済み")).toBeInTheDocument()
    expect(screen.getByText("1日前")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /地図を見る/i })).toHaveAttribute("href", "/map?source=landing")
  })
})
