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
  isHotspotVisible: boolean
  isFloodVisible: boolean
  isTsunamiVisible: boolean
  onToggleHotspot: () => void
  onToggleFlood: () => void
  onToggleTsunami: () => void
}

/**
 * 「くわしい表示」の中の「地図の見た目」で重ねる情報(UIUX改装 項目9・10)。
 * 事故ヒートマップと不審者情報は「くわしい表示」に自分のボタンがあるので、ここには並べない(切り替える場所を1つにする)
 */
export function buildMapDisplayOverlayOptions({
  isHotspotVisible,
  isFloodVisible,
  isTsunamiVisible,
  onToggleHotspot,
  onToggleFlood,
  onToggleTsunami,
}: BuildMapDisplayOverlayOptionsParams): MapDisplayOption[] {
  return [
    {
      id: "hotspot",
      label: "事故多発地点",
      description: "半径30m以内で5年に5件以上の事故がある地点を表示します",
      selected: isHotspotVisible,
      onSelect: onToggleHotspot,
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
