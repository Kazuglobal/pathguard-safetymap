import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { MapTopOverlay } from "@/components/map/map-top-overlay"

describe("MapTopOverlay", () => {
  it("renders the search field first and shows the horizontal chip row", () => {
    render(
      <MapTopOverlay
        activePanel={null}
        is3DEnabled={false}
        isARMode={false}
        isHeatmapVisible={false}
        onPanelChange={() => {}}
        onToggle3D={() => {}}
        onToggleAR={() => {}}
        onToggleHeatmap={() => {}}
        searchSlot={<div>search-slot</div>}
        heatmapPanelSlot={<div>heatmap-panel</div>}
        hazardPanelSlot={<div>hazard-panel</div>}
        threeDPanelSlot={<div>3d-panel</div>}
        arPanelSlot={<div>ar-panel</div>}
      />,
    )

    expect(screen.getByText("search-slot")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "3D" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "AR" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "事故ヒートマップ" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "ハザード" })).toBeInTheDocument()
  })

  it("opens the matching panel when a chip is pressed", async () => {
    const user = userEvent.setup()
    const onPanelChange = vi.fn()

    render(
      <MapTopOverlay
        activePanel={null}
        is3DEnabled={false}
        isARMode={false}
        isHeatmapVisible={false}
        onPanelChange={onPanelChange}
        onToggle3D={() => {}}
        onToggleAR={() => {}}
        onToggleHeatmap={() => {}}
        searchSlot={<div>search-slot</div>}
        heatmapPanelSlot={<div>heatmap-panel</div>}
        hazardPanelSlot={<div>hazard-panel</div>}
        threeDPanelSlot={<div>3d-panel</div>}
        arPanelSlot={<div>ar-panel</div>}
      />,
    )

    await user.click(screen.getByRole("button", { name: "事故ヒートマップ" }))

    expect(onPanelChange).toHaveBeenCalledWith("heatmap")
  })

  it("renders only the active contextual panel below the chip rail", () => {
    render(
      <MapTopOverlay
        activePanel="hazard"
        is3DEnabled={false}
        isARMode={false}
        isHeatmapVisible={false}
        onPanelChange={() => {}}
        onToggle3D={() => {}}
        onToggleAR={() => {}}
        onToggleHeatmap={() => {}}
        searchSlot={<div>search-slot</div>}
        heatmapPanelSlot={<div>heatmap-panel</div>}
        hazardPanelSlot={<div>hazard-panel</div>}
        threeDPanelSlot={<div>3d-panel</div>}
        arPanelSlot={<div>ar-panel</div>}
      />,
    )

    expect(screen.getByText("hazard-panel")).toBeInTheDocument()
    expect(screen.queryByText("heatmap-panel")).not.toBeInTheDocument()
    expect(screen.queryByText("3d-panel")).not.toBeInTheDocument()
  })

  it("closes the active panel when the same chip is tapped again", async () => {
    const user = userEvent.setup()
    const onPanelChange = vi.fn()

    render(
      <MapTopOverlay
        activePanel="heatmap"
        is3DEnabled={false}
        isARMode={false}
        isHeatmapVisible={true}
        onPanelChange={onPanelChange}
        onToggle3D={() => {}}
        onToggleAR={() => {}}
        onToggleHeatmap={() => {}}
        searchSlot={<div>search-slot</div>}
        heatmapPanelSlot={<div>heatmap-panel</div>}
        hazardPanelSlot={<div>hazard-panel</div>}
        threeDPanelSlot={<div>3d-panel</div>}
        arPanelSlot={<div>ar-panel</div>}
      />,
    )

    await user.click(screen.getByRole("button", { name: "事故ヒートマップ" }))

    expect(onPanelChange).toHaveBeenCalledWith(null)
  })

  it("switches panels when a different chip is tapped", async () => {
    const user = userEvent.setup()
    const onPanelChange = vi.fn()

    render(
      <MapTopOverlay
        activePanel="heatmap"
        is3DEnabled={false}
        isARMode={false}
        isHeatmapVisible={true}
        onPanelChange={onPanelChange}
        onToggle3D={() => {}}
        onToggleAR={() => {}}
        onToggleHeatmap={() => {}}
        searchSlot={<div>search-slot</div>}
        heatmapPanelSlot={<div>heatmap-panel</div>}
        hazardPanelSlot={<div>hazard-panel</div>}
        threeDPanelSlot={<div>3d-panel</div>}
        arPanelSlot={<div>ar-panel</div>}
      />,
    )

    await user.click(screen.getByRole("button", { name: "ハザード" }))

    expect(onPanelChange).toHaveBeenCalledWith("hazard")
  })
})
