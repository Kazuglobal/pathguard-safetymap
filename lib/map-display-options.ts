export interface MapDisplayOption {
  id: string
  label: string
  description: string
  selected: boolean
  onSelect: () => void
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
    },
    {
      id: "flood",
      label: "浸水",
      description: "浸水想定区域を地図に重ねて表示します",
      selected: isFloodVisible,
      onSelect: onToggleFlood,
    },
    {
      id: "tsunami",
      label: "津波",
      description: "津波想定区域を地図に重ねて表示します",
      selected: isTsunamiVisible,
      onSelect: onToggleTsunami,
    },
  ]
}
