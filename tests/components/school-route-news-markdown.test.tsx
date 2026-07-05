import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import NewsDetailPage from "@/app/school-route-news/[slug]/page"

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
    render(
      await NewsDetailPage({
        params: Promise.resolve({ slug: "sendai-aoba-kawadaira-repeated-suspicious-20260706" }),
      })
    )

    const table = screen.getByRole("table")
    expect(table.parentElement).toHaveClass("overflow-x-auto", "mb-4")
    expect(table).toHaveClass("w-full", "border-collapse", "border", "border-gray-200", "text-sm")

    const columnHeader = within(table).getByRole("columnheader", { name: "発生日" })
    expect(columnHeader).toHaveClass("border", "border-gray-200", "bg-gray-50")

    const cell = within(table).getByRole("cell", { name: "2人で下校途中の女子小学生ら" })
    expect(cell).toHaveClass("border", "border-gray-200", "px-4", "py-2", "text-gray-600")
  })
})
