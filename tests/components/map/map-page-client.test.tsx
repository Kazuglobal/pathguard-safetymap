import { render, screen, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"

import MapPageClient from "@/components/map/map-page-client"

const mocks = vi.hoisted(() => ({
  shouldShowTutorial: vi.fn(),
}))

vi.mock("@/components/map/map-container", () => ({
  default: () => <div data-testid="map-container" />,
}))

vi.mock("@/components/map/usage-tutorial-dialog", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="usage-tutorial-dialog">tutorial-open</div> : null,
}))

vi.mock("@/lib/tutorial-storage", () => ({
  shouldShowTutorial: mocks.shouldShowTutorial,
}))

describe("MapPageClient", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.shouldShowTutorial.mockReturnValue(false)
  })

  it("provides an entry point to reopen the tutorial", () => {
    render(<MapPageClient />)

    fireEvent.click(screen.getByRole("button", { name: "使い方を確認" }))

    expect(screen.getByTestId("usage-tutorial-dialog")).toBeInTheDocument()
  })
})
