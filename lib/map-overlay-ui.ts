import type { MapTopOverlayPanel } from "@/components/map/map-top-overlay"

export function dismissTransientMapUi({
  setActiveTopPanel,
  setDismissSearchResultsSignal,
}: {
  setActiveTopPanel: (panel: MapTopOverlayPanel) => void
  setDismissSearchResultsSignal: React.Dispatch<React.SetStateAction<number>>
}) {
  setActiveTopPanel(null)
  setDismissSearchResultsSignal((prev) => prev + 1)
}

/**
 * 右下の「表示」ボタンの下端。Mapbox の右下コントロール（現在地・拡大縮小）の上に置く。
 * PC は現在地ボタンが画面下から約135〜175pxにあり、5.75remでは重なっていた（2026-10-08 本番で確認）ので 9rem。
 */
export function getMapDisplayDockBottomOffset(isMobile: boolean) {
  return isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 10.5rem)" : "9rem"
}

/** スマホの地図のボタン列の下端。地図では下部タブバーを出さないので画面の一番下に置く（lib/navigation-visibility.ts）。 */
export const MOBILE_MAP_DOCK_BOTTOM = "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)"
