import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { MapStatusOverlays } from "@/components/map/map-status-overlays"

const baseProps = {
  showMobileMapHint: false,
  onDismissHint: vi.fn(),
  isReportFormOpen: false,
  selectedLocation: null,
  mapError: null,
  isLoading: true,
}

describe("MapStatusOverlays", () => {
  it("shows progressive marker loading and keeps the list action available", async () => {
    const onShowList = vi.fn()
    const user = userEvent.setup()
    render(<MapStatusOverlays {...baseProps} loadingStage={2} onShowList={onShowList} />)

    expect(screen.getByText("地図を読み込み中 2/2")).toBeInTheDocument()
    expect(screen.getByText("危険マーカーを準備しています")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "一覧で見る" }))
    expect(onShowList).toHaveBeenCalledTimes(1)
  })

  it("explains why reporting is unavailable before the base map is ready", () => {
    render(<MapStatusOverlays {...baseProps} loadingStage={1} />)
    expect(screen.getByText("地図の準備ができたら使えます")).toBeInTheDocument()
  })

  it("offers recovery actions for a map error", async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(<MapStatusOverlays {...baseProps} isLoading={false} mapError="オフラインです" onRetry={onRetry} />)

    await user.click(screen.getByRole("button", { name: "もう一度ためす" }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
