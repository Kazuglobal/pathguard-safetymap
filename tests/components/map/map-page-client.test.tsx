import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

import MapPageClient from "@/components/map/map-page-client"

const mocks = vi.hoisted(() => ({
  shouldShowTutorial: vi.fn(),
  useSearchParams: vi.fn(),
  usePathname: vi.fn(),
  replace: vi.fn(),
  mapContainer: vi.fn(),
}))

vi.mock("@/components/map/map-container", () => ({
  default: (props: {
    autoOpenReport?: boolean
    preferredRouteId?: string | null
    initialReportId?: string | null
  }) => {
    mocks.mapContainer(props)
    return <div data-testid="map-container" />
  },
}))

vi.mock("@/components/onboarding/app-onboarding", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="app-onboarding">onboarding-open</div> : null,
}))

vi.mock("next/navigation", () => ({
  useSearchParams: mocks.useSearchParams,
  usePathname: mocks.usePathname,
  useRouter: () => ({
    replace: mocks.replace,
  }),
}))

vi.mock("@/lib/tutorial-storage", () => ({
  shouldShowTutorial: mocks.shouldShowTutorial,
  markTutorialCompleted: vi.fn(),
}))

describe("MapPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.shouldShowTutorial.mockReturnValue(false)
    mocks.useSearchParams.mockReturnValue(new URLSearchParams())
    mocks.usePathname.mockReturnValue("/map")
  })

  it("provides an entry point to reopen the tutorial", () => {
    render(<MapPageClient />)

    fireEvent.click(screen.getByRole("button", { name: "使い方を確認" }))

    expect(screen.getByTestId("app-onboarding")).toBeInTheDocument()
  })

  it("consumes the report query after auto-opening so the CTA can be triggered again", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("report=open&routeId=abc"))

    render(<MapPageClient />)

    await waitFor(() => {
      expect(mocks.mapContainer).toHaveBeenCalledWith(
        expect.objectContaining({ autoOpenReport: true, preferredRouteId: "abc" }),
      )
    })

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/map?routeId=abc", { scroll: false })
    })
  })

  it("passes through the selected route id from the query string", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("routeId=route-42"))

    render(<MapPageClient />)

    await waitFor(() => {
      expect(mocks.mapContainer).toHaveBeenCalledWith(
        expect.objectContaining({ autoOpenReport: false, preferredRouteId: "route-42" }),
      )
    })
  })

  it("passes the report id through for push-notification deep links", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("reportId=report-42"))

    render(<MapPageClient />)

    await waitFor(() => {
      expect(mocks.mapContainer).toHaveBeenCalledWith(
        expect.objectContaining({ initialReportId: "report-42" }),
      )
    })
  })
})
