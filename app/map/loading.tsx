import { MapLoadingPlaceholder } from "@/components/map/map-loading-placeholder"

// 地図を開いた直後も、地図の部品を読み込む間と同じ待ち表示を出す(UIUX改装 項目16・42)
export default function Loading() {
  return <MapLoadingPlaceholder />
}
