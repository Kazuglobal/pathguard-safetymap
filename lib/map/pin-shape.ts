/**
 * 地図ピンのしずく形(viewBox 0 0 44 54、先端は (22, 52))。
 * 白丸は中心 (22, 20)・半径 13 に置く前提。
 *
 * lucide の MapPin は内側に円を持ち、中に置く絵の真後ろへ輪が重なるため、
 * ピンの外形はこの path を使う。
 */
export const PIN_VIEW_BOX = "0 0 44 54"
export const PIN_PATH = "M22 52C22 52 4 35.5 4 20a18 18 0 1 1 36 0c0 15.5-18 32-18 32Z"

const POINT_PIN_GLYPHS = {
  /** 報告する場所(これから足す) */
  select: "M22 13v14M15 20h14",
  /** 送信済み */
  submitted: "M15.5 20.5l4.5 4.5 8.5-9.5",
} as const

export type PointPinKind = keyof typeof POINT_PIN_GLYPHS

/**
 * 報告地点マーカー用のSVG文字列。React root を持たない imperative な
 * マーカー要素(map-container の updateSelectionMarker)から innerHTML で使う。
 * 入力は固定の種別だけで、ユーザー入力は混ざらない。
 */
export function buildPointPinSvg(kind: PointPinKind): string {
  return [
    `<svg class="map-point-pin-shape" viewBox="${PIN_VIEW_BOX}" aria-hidden="true" focusable="false">`,
    `<path d="${PIN_PATH}" fill="#159E72" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/>`,
    `<circle cx="22" cy="20" r="13" fill="#fff"/>`,
    `<path d="${POINT_PIN_GLYPHS[kind]}" fill="none" stroke="#0C7A55" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    `</svg>`,
  ].join("")
}
