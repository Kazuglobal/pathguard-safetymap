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
  default: (props: { autoOpenReport?: boolean }) => {
    mocks.mapContainer(props)
    return <div data-testid="map-container" />
  },
}))

vi.mock("@/components/map/usage-tutorial-dialog", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="usage-tutorial-dialog">tutorial-open</div> : null,
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

    expect(screen.getByTestId("usage-tutorial-dialog")).toBeInTheDocument()
  })

  it("consumes the report query after auto-opening so the CTA can be triggered again", async () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams("report=open&routeId=abc"))

    render(<MapPageClient />)

    expect(mocks.mapContainer).toHaveBeenCalledWith(
      expect.objectContaining({ autoOpenReport: true }),
    )

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/map?routeId=abc", { scroll: false })
    })
  })
})
