import { describe, expect, it, vi } from "vitest"

import { buildMapDisplayOverlayOptions } from "@/lib/map-display-options"

describe("buildMapDisplayOverlayOptions", () => {
  it("builds real overlay options for heatmap, accident hotspots, suspicious alerts, and each hazard layer", () => {
    const onToggleHeatmap = vi.fn()
    const onToggleHotspot = vi.fn()
    const onToggleFlood = vi.fn()
    const onToggleTsunami = vi.fn()
    const onToggleSuspicious = vi.fn()

    const options = buildMapDisplayOverlayOptions({
      isHeatmapVisible: true,
      isHotspotVisible: false,
      isFloodVisible: false,
      isTsunamiVisible: true,
      isSuspiciousVisible: false,
      onToggleHeatmap,
      onToggleHotspot,
      onToggleFlood,
      onToggleTsunami,
      onToggleSuspicious,
    })

    expect(options).toEqual([
      expect.objectContaining({
        id: "heatmap",
        label: "事故ヒートマップ",
        description: "事故の集中地点を重ねて表示します",
        previewImage: "/images/map-style-previews/heat-map.png",
        previewAlt: "事故ヒートマップのプレビュー",
        selected: true,
      }),
      expect.objectContaining({
        id: "hotspot",
        label: "事故多発地点",
        selected: false,
      }),
      expect.objectContaining({
        id: "suspicious",
        label: "不審者情報",
        description: "不審者目撃エリアを半径つきの円で表示します",
        selected: false,
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

    options[0].onSelect()
    options[1].onSelect()
    options[2].onSelect()
    options[3].onSelect()
    options[4].onSelect()

    expect(onToggleHeatmap).toHaveBeenCalledTimes(1)
    expect(onToggleHotspot).toHaveBeenCalledTimes(1)
    expect(onToggleSuspicious).toHaveBeenCalledTimes(1)
    expect(onToggleFlood).toHaveBeenCalledTimes(1)
    expect(onToggleTsunami).toHaveBeenCalledTimes(1)
  })
})
