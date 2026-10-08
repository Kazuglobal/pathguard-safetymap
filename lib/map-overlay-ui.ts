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

export function getMapDisplayDockBottomOffset(isMobile: boolean) {
  return isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 7.75rem)" : "5.75rem"
}

/** スマホの地図のボタン列の下端。地図では下部タブバーを出さないので画面の一番下に置く（lib/navigation-visibility.ts）。 */
export const MOBILE_MAP_DOCK_BOTTOM = "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)"
