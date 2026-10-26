// =============================================
// 地図の吹き出し（Mapbox Popup）を、地図の上に重ねたUIの下に潜らせない（純粋関数）
//
// Mapbox は吹き出しの向きを「地図の枠に収まるか」だけで決めるので、上の検索欄・ボタン列や
// 下の「危険箇所を報告」ボタンの下に潜り込んで読めなくなる（2026-10-08 ユーザー指摘）。
// =============================================

export type PopupAnchor = 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** 画面の左右この割合より端の点は、吹き出しを画面の内側へ向けて開く。 */
const EDGE_RATIO = 0.3

/**
 * タップした点から吹き出しを開く向き（Mapbox の anchor = 吹き出しのどの辺を点に付けるか）。
 * 上半分なら下向き（top）、下半分なら上向き（bottom）。左右の端に近いときは画面の内側へ開く。
 */
export function popupAnchorForPoint(
  point: { x: number; y: number },
  map: { width: number; height: number },
): PopupAnchor {
  const vertical = point.y < map.height / 2 ? 'top' : 'bottom'
  if (point.x < map.width * EDGE_RATIO) return `${vertical}-left`
  if (point.x > map.width * (1 - EDGE_RATIO)) return `${vertical}-right`
  return vertical
}

export interface VerticalBox {
  top: number
  bottom: number
}

/**
 * 吹き出しを上下の重ねUIから出すために、地図をずらす量（map.panBy の y。正=地図の中身を上へ）。
 * 収まりきらない高さのときは、見出しのある上端を優先して見せる。
 */
export function popupPanOffset(
  popup: VerticalBox,
  map: VerticalBox,
  safe: { top: number; bottom: number },
): number {
  const visibleTop = map.top + safe.top
  const visibleBottom = map.bottom - safe.bottom
  if (popup.top < visibleTop) return Math.round(popup.top - visibleTop)
  if (popup.bottom > visibleBottom) {
    const shiftUp = popup.bottom - visibleBottom
    // 上へずらしすぎて見出しが上の重ねUIに隠れないようにする
    const maxShiftUp = popup.top - visibleTop
    return Math.round(Math.min(shiftUp, Math.max(0, maxShiftUp)))
  }
  return 0
}

/** 余白(px)。重ねUIのすぐ下・すぐ上に吹き出しがくっつかないようにする。 */
const OVERLAY_GAP_PX = 8

/**
 * 地図の上下に重ねたUI（検索欄・ボタン列、下部の報告ボタン）の位置から、
 * 吹き出しを置いてよい範囲（地図の上端・下端からの距離）を求める。表示されていない要素（高さ0）は無視する。
 */
export function overlaySafeArea(
  map: VerticalBox,
  overlays: { top: VerticalBox[]; bottom: VerticalBox[] },
): { top: number; bottom: number } {
  const visible = (box: VerticalBox) => box.bottom - box.top > 0
  const top = Math.max(0, ...overlays.top.filter(visible).map((box) => box.bottom - map.top + OVERLAY_GAP_PX))
  const bottom = Math.max(0, ...overlays.bottom.filter(visible).map((box) => map.bottom - box.top + OVERLAY_GAP_PX))
  return { top, bottom }
}

/** 吹き出しが画面の左右にはみ出したとき、地図を横にずらす量（map.panBy の x。正=地図の中身を左へ）。 */
export function popupHorizontalPanOffset(
  popup: { left: number; right: number },
  map: { left: number; right: number },
): number {
  if (popup.left < map.left + OVERLAY_GAP_PX) return Math.round(popup.left - (map.left + OVERLAY_GAP_PX))
  if (popup.right > map.right - OVERLAY_GAP_PX) return Math.round(popup.right - (map.right - OVERLAY_GAP_PX))
  return 0
}
