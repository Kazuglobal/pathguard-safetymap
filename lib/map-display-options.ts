export interface MapDisplayOption {
  id: string
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}

interface BuildMapDisplayOverlayOptionsParams {
  isHeatmapVisible: boolean
  isHazardPanelOpen: boolean
  onToggleHeatmap: () => void
  onToggleHazard: () => void
}

export function buildMapDisplayOverlayOptions({
  isHeatmapVisible,
  isHazardPanelOpen,
  onToggleHeatmap,
  onToggleHazard,
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
      id: "hazard",
      label: "危険・注意",
      description: "通学路上の注意点を確認します",
      selected: isHazardPanelOpen,
      onSelect: onToggleHazard,
    },
  ]
}
