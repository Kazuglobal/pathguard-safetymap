import { act, render, screen, fireEvent, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest"

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

vi.mock("@/components/map/spot-guide", () => ({
  default: ({ open }: { open: boolean }) => (open ? <div data-testid="spot-guide-open" /> : null),
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

  // 「使い方」は地図のヘルプ。はじめての案内は、ヘルプの中から別に開く(UIUX改装 項目51)
  it("opens the map help from 「使い方」, and the first-time guide only from inside the help", () => {
    render(<MapPageClient />)

    fireEvent.click(screen.getByRole("button", { name: "使い方を確認" }))

    expect(screen.getByText("地図の使い方")).toBeInTheDocument()
    expect(screen.queryByTestId("app-onboarding")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /はじめての案内をもう一度/ }))

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

  // はじめて地図を開いたとき、実際のボタンを照らす案内を出す。用事があって来たときは先をふさがない
  describe("first-visit spot guide", () => {
    let search: HTMLElement

    beforeEach(() => {
      vi.useFakeTimers()
      localStorage.clear()
      // 地図の部品が出そろった状態(本物の MapContainer はモックなので、検索の部品だけ置く)
      search = document.createElement("div")
      search.setAttribute("data-guide", "map-search")
      document.body.appendChild(search)
    })

    afterEach(() => {
      search.remove()
      vi.useRealTimers()
    })

    const tick = () => act(() => vi.advanceTimersByTime(600))

    it("shows the guide once the map controls are on screen", () => {
      render(<MapPageClient />)
      expect(screen.queryByTestId("spot-guide-open")).not.toBeInTheDocument()

      tick()
      expect(screen.getByTestId("spot-guide-open")).toBeInTheDocument()
    })

    it("does not show it again once it has been seen", () => {
      localStorage.setItem("pathguard-map-guide", JSON.stringify({ version: 1 }))
      render(<MapPageClient />)

      tick()
      expect(screen.queryByTestId("spot-guide-open")).not.toBeInTheDocument()
    })

    it.each(["report=open", "reportId=r1", "routeId=route-1", "suspiciousAlert=1"])(
      "stays out of the way when the visitor arrives with a task (?%s)",
      (query) => {
        mocks.useSearchParams.mockReturnValue(new URLSearchParams(query))
        render(<MapPageClient />)

        tick()
        tick()
        expect(screen.queryByTestId("spot-guide-open")).not.toBeInTheDocument()
      },
    )

    it("waits while another dialog is open, then shows", () => {
      const dialog = document.createElement("div")
      dialog.setAttribute("role", "dialog")
      document.body.appendChild(dialog)
      render(<MapPageClient />)

      tick()
      expect(screen.queryByTestId("spot-guide-open")).not.toBeInTheDocument()

      dialog.remove()
      tick()
      expect(screen.getByTestId("spot-guide-open")).toBeInTheDocument()
    })

    it("stops watching after the page is left", () => {
      search.remove()
      const { unmount } = render(<MapPageClient />)
      unmount()

      expect(vi.getTimerCount()).toBe(0)
    })
  })
})
