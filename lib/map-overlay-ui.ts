import type { MapTopOverlayPanel } from "@/components/map/map-top-overlay"

export function dismissTransientMapUi({
  setActiveTopPanel,
  setDismissSearchResultsSignal,
  setFoldTopDetailsSignal,
}: {
  setActiveTopPanel: (panel: MapTopOverlayPanel) => void
  setDismissSearchResultsSignal: React.Dispatch<React.SetStateAction<number>>
  /** 「くわしい表示」の列をたたむ合図。地図を広く見せるため、地図をさわったらたたむ */
  setFoldTopDetailsSignal?: React.Dispatch<React.SetStateAction<number>>
}) {
  setActiveTopPanel(null)
  setDismissSearchResultsSignal((prev) => prev + 1)
  setFoldTopDetailsSignal?.((prev) => prev + 1)
}

/**
 * 地図の上の列(検索・「通学路チェック」・「くわしい表示」)のすぐ下の高さ。map-top-overlay の列の高さに合わせた固定の値で、
 * 右上の「ピンの見方」(map-floating-controls)と0件の案内(map-empty-area-notice)が使う。unfolded は「くわしい表示」の列を
 * 開いたとき。md 以上は上にヘッダーがあるぶん下がる。上の列の高さを変えたら、この値も測り直す。
 * スマホは検索を低く(44px)しているので、md 以上より上の列が 12px 低い
 */
export const BELOW_MAP_TOP_ROWS = {
  folded: "top-[calc(env(safe-area-inset-top,0px)+7.25rem)] md:top-[calc(env(safe-area-inset-top,0px)+12.5rem)]",
  unfolded: "top-[calc(env(safe-area-inset-top,0px)+11.5rem)] md:top-[calc(env(safe-area-inset-top,0px)+16.5rem)]",
} as const

/** スマホの地図のボタン列の下端。地図では下部タブバーを出さないので画面の一番下に置く（lib/navigation-visibility.ts）。 */
export const MOBILE_MAP_DOCK_BOTTOM = "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)"
