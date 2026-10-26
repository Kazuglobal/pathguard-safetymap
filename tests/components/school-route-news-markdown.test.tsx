import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import NewsDetailPage from "@/app/school-route-news/[slug]/page"
import { NEWS_ITEMS } from "@/lib/school-route-news"

vi.mock("next/image", () => ({
  default: ({ fill: _fill, priority: _priority, ...props }: any) => <img {...props} />,
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

describe("school route news markdown rendering", () => {
  it("renders GFM tables with an overflow wrapper and styled cells", async () => {
    // 保持期間ポリシー（90日）で記事が入れ替わってもテストが壊れないよう、
    // スラッグを直指定せず、表を含む最新の記事を NEWS_ITEMS から選ぶ。
    const itemWithTable = NEWS_ITEMS.find((item) => /\|\s*-+\s*\|/.test(item.content))
    expect(itemWithTable, "no NEWS_ITEMS entry contains a GFM table").toBeDefined()

    render(
      await NewsDetailPage({
        params: Promise.resolve({ slug: itemWithTable!.slug }),
      })
    )

    const table = screen.getAllByRole("table")[0]
    expect(table.parentElement).toHaveClass("overflow-x-auto", "mb-4")
    expect(table).toHaveClass("w-full", "border-collapse", "border", "border-gray-200", "text-sm")

    const columnHeader = within(table).getAllByRole("columnheader")[0]
    expect(columnHeader).toHaveClass("border", "border-gray-200", "bg-gray-50")

    const cell = within(table).getAllByRole("cell")[0]
    expect(cell).toHaveClass("border", "border-gray-200", "px-4", "py-2", "text-gray-600")
  })
})
