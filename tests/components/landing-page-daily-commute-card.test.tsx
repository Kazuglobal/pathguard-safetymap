import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import LandingPage from "@/app/landing/page"

vi.mock("@/components/landing", async () => {
  const actual = await vi.importActual<typeof import("@/components/landing")>("@/components/landing")

  return {
    ...actual,
    StickyHeader: () => <div data-testid="sticky-header" />,
    DailyCommuteCheckCard: () => <div data-testid="lower-commute-card" />,
    HeroCarousel: () => <div data-testid="hero-carousel" />,
    SchoolRouteNewsSection: () => <div data-testid="school-route-news" />,
    HazardMapBanner: () => <div data-testid="hazard-map-banner" />,
    StoreSection: () => <div data-testid="store-section" />,
    SafeMagazine: () => <div data-testid="safe-magazine" />,
    HiyariHatReport: () => <div data-testid="hiyari-hat-report" />,
  }
})

vi.mock("@/hooks/use-child-route-dashboard", () => ({
  useChildRouteDashboard: () => ({
    state: "empty",
    childName: undefined,
    errorMessage: undefined,
    quickChecks: [],
    retryHref: "/map",
  }),
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}))

describe("LandingPage DailyCommuteCheckCard integration", () => {
  it("keeps the upper dashboard and does not render the lower commute card", () => {
    render(<LandingPage />)

    expect(screen.getByTestId("child-route-dashboard")).toBeInTheDocument()
    expect(screen.queryByTestId("lower-commute-card")).not.toBeInTheDocument()
    expect(screen.getAllByRole("heading", { name: "今日の通学3分チェック" })).toHaveLength(1)
  })
})
