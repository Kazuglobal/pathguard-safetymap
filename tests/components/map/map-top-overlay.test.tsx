import type { ComponentProps } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { MapTopOverlay } from "@/components/map/map-top-overlay"

function renderOverlay(overrides: Partial<ComponentProps<typeof MapTopOverlay>> = {}) {
  const props: ComponentProps<typeof MapTopOverlay> = {
    activePanel: null,
    is3DEnabled: false,
    isARMode: false,
    isHeatmapVisible: false,
    isSuspiciousVisible: false,
    onPanelChange: vi.fn(),
    onToggle3D: vi.fn(),
    onToggleAR: vi.fn(),
    onToggleHeatmap: vi.fn(),
    onToggleSuspicious: vi.fn(),
    searchSlot: <div>search-slot</div>,
    heatmapPanelSlot: <div>heatmap-panel</div>,
    hazardPanelSlot: <div>hazard-panel</div>,
    threeDPanelSlot: <div>3d-panel</div>,
    arPanelSlot: <div>ar-panel</div>,
    suspiciousPanelSlot: <div>suspicious-panel</div>,
    ...overrides,
  }
  render(<MapTopOverlay {...props} />)
  return props
}

const ADVANCED = ["事故ヒートマップ", "不審者情報", "AR", "3D"]

describe("MapTopOverlay", () => {
  it("keeps the overlay below the fixed desktop header", () => {
    const { container } = render(
      <MapTopOverlay
        activePanel={null}
        is3DEnabled={false}
        isARMode={false}
        isHeatmapVisible={false}
        isSuspiciousVisible={false}
        onPanelChange={() => {}}
        onToggle3D={() => {}}
        onToggleAR={() => {}}
        onToggleHeatmap={() => {}}
        onToggleSuspicious={() => {}}
        searchSlot={<div>search-slot</div>}
        heatmapPanelSlot={<div>heatmap-panel</div>}
        hazardPanelSlot={<div>hazard-panel</div>}
        threeDPanelSlot={<div>3d-panel</div>}
        arPanelSlot={<div>ar-panel</div>}
        suspiciousPanelSlot={<div>suspicious-panel</div>}
      />,
    )

    expect(container.firstChild).toHaveClass("md:top-[calc(env(safe-area-inset-top,0px)+4.75rem)]")
  })

  // 初期表示は「通学路チェック」。そのほかの表示は「くわしい表示」にたたむ(UIUX改装 項目9・10)
  it("shows only 「通学路チェック」 and 「くわしい表示」 under the search at first", () => {
    renderOverlay()

    expect(screen.getByText("search-slot")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "通学路チェック" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /くわしい表示/ })).toHaveAttribute("aria-expanded", "false")
    for (const name of [...ADVANCED, "ハザード"]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument()
    }
  })

  it("unfolds the other layers, each with an icon and a one-line description", async () => {
    const user = userEvent.setup()
    renderOverlay({ renderDisplayOptions: (trigger) => trigger })

    await user.click(screen.getByRole("button", { name: /くわしい表示/ }))

    expect(screen.getByRole("button", { name: /くわしい表示/ })).toHaveAttribute("aria-expanded", "true")
    const group = screen.getByRole("group", { name: "くわしい表示" })
    for (const name of [...ADVANCED, "地図の見た目"]) {
      const chip = within(group).getByRole("button", { name })
      expect(chip.querySelector("svg")).not.toBeNull()
      // 名前のほかに、ひとことの説明がある
      expect(chip.textContent!.length).toBeGreaterThan(name.length + 3)
    }
    expect(within(group).getByRole("button", { name: "事故ヒートマップ" })).toHaveTextContent("事故の多い場所を色で")
    expect(within(group).getByRole("button", { name: "地図の見た目" })).toHaveTextContent("背景・洪水・津波")
  })

  it("opens the route check panel from 「通学路チェック」", async () => {
    const user = userEvent.setup()
    const props = renderOverlay()

    await user.click(screen.getByRole("button", { name: "通学路チェック" }))

    expect(props.onPanelChange).toHaveBeenCalledWith("hazard")
  })

  it("turns the heatmap on and opens its panel from inside 「くわしい表示」", async () => {
    const user = userEvent.setup()
    const props = renderOverlay()

    await user.click(screen.getByRole("button", { name: /くわしい表示/ }))
    await user.click(screen.getByRole("button", { name: "事故ヒートマップ" }))

    expect(props.onToggleHeatmap).toHaveBeenCalledTimes(1)
    expect(props.onPanelChange).toHaveBeenCalledWith("heatmap")
  })

  it("stays unfolded while a panel inside 「くわしい表示」 is open, and renders only that panel", () => {
    renderOverlay({ activePanel: "heatmap", isHeatmapVisible: true })

    expect(screen.getByRole("button", { name: /くわしい表示/ })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "事故ヒートマップ" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText("heatmap-panel")).toBeInTheDocument()
    expect(screen.queryByText("hazard-panel")).not.toBeInTheDocument()
  })

  it("closes the active panel when the same chip is tapped again", async () => {
    const user = userEvent.setup()
    const props = renderOverlay({ activePanel: "heatmap", isHeatmapVisible: true })

    await user.click(screen.getByRole("button", { name: "事故ヒートマップ" }))

    expect(props.onPanelChange).toHaveBeenCalledWith(null)
  })

  it("switches from a detail panel to the route check", async () => {
    const user = userEvent.setup()
    const props = renderOverlay({ activePanel: "heatmap", isHeatmapVisible: true })

    await user.click(screen.getByRole("button", { name: "通学路チェック" }))

    expect(props.onPanelChange).toHaveBeenCalledWith("hazard")
  })

  it("keeps 「くわしい表示」 unfolded after closing a panel with its own chip", async () => {
    const user = userEvent.setup()
    const onPanelChange = vi.fn()
    const props = {
      is3DEnabled: false,
      isARMode: false,
      isHeatmapVisible: true,
      isSuspiciousVisible: false,
      onPanelChange,
      onToggle3D: vi.fn(),
      onToggleAR: vi.fn(),
      onToggleHeatmap: vi.fn(),
      onToggleSuspicious: vi.fn(),
      searchSlot: <div>search-slot</div>,
      heatmapPanelSlot: <div>heatmap-panel</div>,
      hazardPanelSlot: <div>hazard-panel</div>,
      threeDPanelSlot: <div>3d-panel</div>,
      arPanelSlot: <div>ar-panel</div>,
      suspiciousPanelSlot: <div>suspicious-panel</div>,
    }
    const { rerender } = render(<MapTopOverlay {...props} activePanel="heatmap" />)

    await user.click(screen.getByRole("button", { name: "事故ヒートマップ" }))
    expect(onPanelChange).toHaveBeenCalledWith(null)
    rerender(<MapTopOverlay {...props} activePanel={null} />)

    expect(screen.getByRole("button", { name: /くわしい表示/ })).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByRole("button", { name: "事故ヒートマップ" })).toBeInTheDocument()
  })

  it("folds 「くわしい表示」 again and closes its open panel", async () => {
    const user = userEvent.setup()
    const props = renderOverlay({ activePanel: "3d", is3DEnabled: true })

    await user.click(screen.getByRole("button", { name: /くわしい表示/ }))

    expect(props.onPanelChange).toHaveBeenCalledWith(null)
  })
})
