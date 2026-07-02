// =============================================
// きけんハンター 画像ジオメトリ (純粋ロジック)
// object-contain で表示した画像は、枠(container)の中で
// 縮小・センタリングされてレターボックス(余白)ができる。
// タップ座標やオーバーレイ位置を「画像内の相対座標(0..1)」へ
// 正しく変換するための純粋関数群。React/DOM 非依存。
// =============================================

export interface Size {
  readonly w: number
  readonly h: number
}

/** 枠の中で画像が実際に描画される矩形 (枠左上を原点とするpx)。 */
export interface ContainRect {
  readonly offsetX: number
  readonly offsetY: number
  readonly drawW: number
  readonly drawH: number
}

/** getBoundingClientRect 相当 (必要な4値のみ)。 */
export interface ViewportRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface RelPoint {
  readonly x: number
  readonly y: number
}

const EMPTY_CONTAIN: ContainRect = { offsetX: 0, offsetY: 0, drawW: 0, drawH: 0 }

/**
 * object-contain で natural を container に収めたときの実描画矩形を返す。
 * 退化入力(0以下)では空矩形を返す。
 */
export function containRect(natural: Size, container: Size): ContainRect {
  if (
    !(natural.w > 0) ||
    !(natural.h > 0) ||
    !(container.w > 0) ||
    !(container.h > 0)
  ) {
    return EMPTY_CONTAIN
  }
  const scale = Math.min(container.w / natural.w, container.h / natural.h)
  const drawW = natural.w * scale
  const drawH = natural.h * scale
  return {
    offsetX: (container.w - drawW) / 2,
    offsetY: (container.h - drawH) / 2,
    drawW,
    drawH,
  }
}

/**
 * クライアント座標を「画像内の相対座標(0..1)」へ変換する。
 * レターボックス(余白)上のタップや退化入力は null を返す(=非タップ扱い)。
 */
export function toImageCoords(
  clientX: number,
  clientY: number,
  rect: ViewportRect,
  contain: ContainRect,
): RelPoint | null {
  if (!(contain.drawW > 0) || !(contain.drawH > 0)) return null
  const localX = clientX - rect.left - contain.offsetX
  const localY = clientY - rect.top - contain.offsetY
  if (localX < 0 || localY < 0 || localX > contain.drawW || localY > contain.drawH) {
    return null
  }
  return {
    x: clamp01(localX / contain.drawW),
    y: clamp01(localY / contain.drawH),
  }
}

/**
 * 画像内の相対座標(0..1)を、枠に対する % 位置へ変換する(オーバーレイ配置用)。
 */
export function toContainerPct(
  rel: RelPoint,
  contain: ContainRect,
  container: Size,
): { leftPct: number; topPct: number } {
  if (!(container.w > 0) || !(container.h > 0)) {
    return { leftPct: 50, topPct: 50 }
  }
  const px = contain.offsetX + clamp01(rel.x) * contain.drawW
  const py = contain.offsetY + clamp01(rel.y) * contain.drawH
  return {
    leftPct: (px / container.w) * 100,
    topPct: (py / container.h) * 100,
  }
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}
