import { describe, expect, it, vi } from "vitest"

import { buildMapDisplayOverlayOptions } from "@/lib/map-display-options"

describe("buildMapDisplayOverlayOptions", () => {
  it("builds real overlay options for heatmap and each hazard layer", () => {
    const onToggleHeatmap = vi.fn()
    const onToggleFlood = vi.fn()
    const onToggleTsunami = vi.fn()

    const options = buildMapDisplayOverlayOptions({
      isHeatmapVisible: true,
      isFloodVisible: false,
      isTsunamiVisible: true,
      onToggleHeatmap,
      onToggleFlood,
      onToggleTsunami,
    })

    expect(options).toEqual([
      expect.objectContaining({
        id: "heatmap",
        label: "事故ヒートマップ",
        selected: true,
      }),
      expect.objectContaining({
        id: "flood",
        label: "浸水",
        selected: false,
      }),
      expect.objectContaining({
        id: "tsunami",
        label: "津波",
        selected: true,
      }),
    ])

    options[0].onSelect()
    options[1].onSelect()
    options[2].onSelect()

    expect(onToggleHeatmap).toHaveBeenCalledTimes(1)
    expect(onToggleFlood).toHaveBeenCalledTimes(1)
    expect(onToggleTsunami).toHaveBeenCalledTimes(1)
  })
})
