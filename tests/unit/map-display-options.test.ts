import { describe, expect, it, vi } from "vitest"

import { buildMapDisplayOverlayOptions } from "@/lib/map-display-options"

describe("buildMapDisplayOverlayOptions", () => {
  it("builds real overlay options for heatmap and hazards", () => {
    const onToggleHeatmap = vi.fn()
    const onToggleHazard = vi.fn()

    const options = buildMapDisplayOverlayOptions({
      isHeatmapVisible: true,
      isHazardPanelOpen: false,
      onToggleHeatmap,
      onToggleHazard,
    })

    expect(options).toEqual([
      expect.objectContaining({
        id: "heatmap",
        label: "事故ヒートマップ",
        selected: true,
      }),
      expect.objectContaining({
        id: "hazard",
        label: "危険・注意",
        selected: false,
      }),
    ])

    options[0].onSelect()
    options[1].onSelect()

    expect(onToggleHeatmap).toHaveBeenCalledTimes(1)
    expect(onToggleHazard).toHaveBeenCalledTimes(1)
  })
})
