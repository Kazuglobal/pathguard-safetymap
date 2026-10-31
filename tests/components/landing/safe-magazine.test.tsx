import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { SafeMagazine } from "@/components/landing/SafeMagazine"
import {
  SAFE_MAGAZINE_CAROUSEL_COUNT,
  SAFE_MAGAZINE_GRID_COUNT,
} from "@/components/landing/SafeMagazine"

vi.mock("@/components/landing/safe-magazine-carousel", () => ({
  SafeMagazineCarousel: ({ articles }: { articles: { id: string }[] }) => (
    <div data-testid="safe-magazine-carousel" data-count={articles.length} />
  ),
}))

describe("SafeMagazine", () => {
  it("スマホは自動スライド、PCは3列グリッドで記事を出す", () => {
    render(<SafeMagazine />)

    // マガジンの名前は SAFE MAGAZINE にそろえた(UIUX改装 項目25)
    expect(screen.getByRole("heading", { name: "SAFE MAGAZINE" })).toBeInTheDocument()

    const carousel = screen.getByTestId("safe-magazine-carousel")
    expect(carousel).toHaveAttribute("data-count", String(SAFE_MAGAZINE_CAROUSEL_COUNT))
    expect(carousel.parentElement).toHaveClass("md:hidden")

    const grid = screen.getByTestId("safe-magazine-grid")
    expect(grid).toHaveClass("hidden", "md:grid")
    expect(within(grid).getAllByRole("link")).toHaveLength(SAFE_MAGAZINE_GRID_COUNT)
  })

  it("自動スライドはグリッドより多くの記事を流す", () => {
    expect(SAFE_MAGAZINE_CAROUSEL_COUNT).toBeGreaterThan(SAFE_MAGAZINE_GRID_COUNT)
  })
})
