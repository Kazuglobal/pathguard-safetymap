export interface MapDisplayOption {
  id: string
  label: string
  description: string
  selected: boolean
  onSelect: () => void
  previewImage?: string
  previewAlt?: string
}

interface BuildMapDisplayOverlayOptionsParams {
  isHeatmapVisible: boolean
  isFloodVisible: boolean
  isTsunamiVisible: boolean
  onToggleHeatmap: () => void
  onToggleFlood: () => void
  onToggleTsunami: () => void
}

export function buildMapDisplayOverlayOptions({
  isHeatmapVisible,
  isFloodVisible,
  isTsunamiVisible,
  onToggleHeatmap,
  onToggleFlood,
  onToggleTsunami,
}: BuildMapDisplayOverlayOptionsParams): MapDisplayOption[] {
  return [
    {
      id: "heatmap",
      label: "事故ヒートマップ",
      description: "事故の集中地点を重ねて表示します",
      selected: isHeatmapVisible,
      onSelect: onToggleHeatmap,
      previewImage: "/images/map-style-previews/heat-map.png",
      previewAlt: "事故ヒートマップのプレビュー",
    },
    {
      id: "flood",
      label: "洪水",
      description: "洪水リスクのある地域を重ねて表示します",
      selected: isFloodVisible,
      onSelect: onToggleFlood,
      previewImage: "/images/map-style-previews/flood-hazard.png",
      previewAlt: "洪水ハザードのプレビュー",
    },
    {
      id: "tsunami",
      label: "津波",
      description: "津波浸水想定区域を重ねて表示します",
      selected: isTsunamiVisible,
      onSelect: onToggleTsunami,
      previewImage: "/images/map-style-previews/tunami-hazard.png",
      previewAlt: "津波ハザードのプレビュー",
    },
  ]
}
