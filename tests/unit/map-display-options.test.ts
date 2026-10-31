import { describe, expect, it, vi } from "vitest"

import { buildMapDisplayOverlayOptions } from "@/lib/map-display-options"

describe("buildMapDisplayOverlayOptions", () => {
  // 事故ヒートマップと不審者情報は「くわしい表示」に自分のボタンがあるので、「地図の見た目」には並べない(UIUX改装 項目9・10)
  it("builds the overlay options of 「地図の見た目」: accident hotspots and each hazard layer (not the heatmap or suspicious alerts)", () => {
    const onToggleHotspot = vi.fn()
    const onToggleFlood = vi.fn()
    const onToggleTsunami = vi.fn()

    const options = buildMapDisplayOverlayOptions({
      isHotspotVisible: true,
      isFloodVisible: false,
      isTsunamiVisible: true,
      onToggleHotspot,
      onToggleFlood,
      onToggleTsunami,
    })

    expect(options).toEqual([
      expect.objectContaining({
        id: "hotspot",
        label: "事故多発地点",
        selected: true,
      }),
      expect.objectContaining({
        id: "flood",
        label: "洪水",
        description: "洪水リスクのある地域を重ねて表示します",
        previewImage: "/images/map-style-previews/flood-hazard.png",
        previewAlt: "洪水ハザードのプレビュー",
        selected: false,
      }),
      expect.objectContaining({
        id: "tsunami",
        label: "津波",
        description: "津波浸水想定区域を重ねて表示します",
        previewImage: "/images/map-style-previews/tunami-hazard.png",
        previewAlt: "津波ハザードのプレビュー",
        selected: true,
      }),
    ])
    expect(options.map((option) => option.id)).not.toContain("heatmap")
    expect(options.map((option) => option.id)).not.toContain("suspicious")

    options[0].onSelect()
    options[1].onSelect()
    options[2].onSelect()

    expect(onToggleHotspot).toHaveBeenCalledTimes(1)
    expect(onToggleFlood).toHaveBeenCalledTimes(1)
    expect(onToggleTsunami).toHaveBeenCalledTimes(1)
  })
})
