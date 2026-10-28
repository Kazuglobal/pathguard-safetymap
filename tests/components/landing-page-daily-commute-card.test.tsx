import { render, screen, within } from "@testing-library/react"
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

describe("LandingPage 今日の通学3分チェック integration", () => {
  it("renders the commute check card once and, without a registered route, offers only the register CTA", () => {
    render(<LandingPage />)

    const dashboard = screen.getByTestId("child-route-dashboard")
    expect(dashboard).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { name: "今日の通学3分チェック" })).toHaveLength(1)

    const links = within(dashboard).getAllByRole("link")
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveTextContent("通学路を登録する")
    expect(links[0]).toHaveAttribute("href", "/routes")
    expect(within(dashboard).queryByText(/^\d+件$/)).not.toBeInTheDocument()
    expect(within(dashboard).queryByText("未設定")).not.toBeInTheDocument()
  })
})
