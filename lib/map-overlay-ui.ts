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
  return isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 10.5rem)" : "5.75rem"
}
