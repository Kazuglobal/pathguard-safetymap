import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import LandingPage from "@/app/landing/page"

vi.mock("@/components/landing", async () => {
  const actual = await vi.importActual<typeof import("@/components/landing")>("@/components/landing")

  return {
    ...actual,
    StickyHeader: () => <div data-testid="sticky-header" />,
    HeroCarousel: () => <div data-testid="hero-carousel" />,
    SchoolRouteNewsSection: () => <div data-testid="school-route-news" />,
    HazardMapBanner: () => <div data-testid="hazard-map-banner" />,
    StoreSection: () => <div data-testid="store-section" />,
    SafeMagazine: () => <div data-testid="safe-magazine" />,
    HiyariHatReport: () => <div data-testid="hiyari-hat-report" />,
  }
})

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

describe("LandingPage DailyCommuteCheckCard integration", () => {
  it("renders the commute card with the public-safe default state", () => {
    render(<LandingPage />)

    expect(screen.getByText("今日の通学3分チェック")).toBeInTheDocument()
    expect(screen.getByText("通学前に危険情報やルート設定状況を30秒で確認できます。")).toBeInTheDocument()
    expect(screen.getByText("0件")).toBeInTheDocument()
    expect(screen.getByText("未設定")).toBeInTheDocument()
    expect(screen.getByText("未更新")).toBeInTheDocument()
    expect(screen.queryByText("2件")).not.toBeInTheDocument()
    expect(screen.queryByText("46日前")).not.toBeInTheDocument()
  })
})
