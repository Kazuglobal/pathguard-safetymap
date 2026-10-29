// =============================================
// 写真のぼかし矩形ロジック (純粋関数)。報告の写真・きけんハンターで共用(UIUX改装 項目57)
// オンデバイス顔検出の結果・指でなぞった範囲 → ぼかし矩形 (相対座標 0..1)
// canvas 適用は lib/media/canvas-mask.ts、顔検出は lib/media/face-detection.ts。
// もとは lib/hunter/masking.ts と components/safety-quest/hunter/mask-confirm.tsx にあった。
// =============================================

/** ぼかす範囲 (相対座標 0..1)。きけんハンターの HunterRegion と同じ形 */
export interface MaskRegion {
  x: number
  y: number
  w: number
  h: number
}

/** 顔検出結果 (相対座標 0..1 正規化)。score は信頼度 (任意)。 */
export interface DetectedFace {
  x: number
  y: number
  width: number
  height: number
  score?: number
}

/** ぼかし矩形の計算オプション。 */
export interface BlurOptions {
  /** 信頼できる顔に与える余白 (割合)。既定 0.08。 */
  baseMargin?: number
  /** 不確実な顔に与える広めの余白 (割合)。既定 0.18。 */
  uncertainMargin?: number
  /** これ未満の score を「不確実」とみなす閾値。既定 0.6。 */
  uncertainThreshold?: number
}

const DEFAULT_BASE_MARGIN = 0.08
const DEFAULT_UNCERTAIN_MARGIN = 0.18
const DEFAULT_UNCERTAIN_THRESHOLD = 0.6

/**
 * AI送信用画像の長辺上限。
 * Vercel Functions の 4.5MB リクエスト上限に対し、base64/JSON の膨張分を含めても
 * 十分な余白を持たせつつ、危険箇所を判別できる解像度を維持する。
 */
export const MAX_MASKED_OUTPUT_LONG_EDGE = 1600
/** ドラッグ確定とみなす最小サイズ (相対座標 0..1) */
export const MIN_DRAG_SIZE = 0.02

/**
 * 矩形を [0,1] 範囲に収める。
 * - x,y を [0,1] にクランプ。
 * - 負の w,h は 0 に。
 * - x+w<=1, y+h<=1 となるよう w,h を縮める。
 */
export function clampRegion(r: MaskRegion): MaskRegion {
  const x = Math.min(Math.max(r.x, 0), 1)
  const y = Math.min(Math.max(r.y, 0), 1)
  const w = Math.min(Math.max(r.w, 0), 1 - x)
  const h = Math.min(Math.max(r.h, 0), 1 - y)
  return { x, y, w, h }
}

/**
 * 矩形を各辺 margin (割合) 分広げて clampRegion を通す。
 */
export function expandRegion(r: MaskRegion, margin: number): MaskRegion {
  return clampRegion({
    x: r.x - margin,
    y: r.y - margin,
    w: r.w + 2 * margin,
    h: r.h + 2 * margin,
  })
}

/**
 * 顔1件 → ぼかし矩形。
 * 不確実 (score < uncertainThreshold) なら広めの余白を与える。
 */
export function faceToBlurRegion(face: DetectedFace, opts?: BlurOptions): MaskRegion {
  const baseMargin = opts?.baseMargin ?? DEFAULT_BASE_MARGIN
  const uncertainMargin = opts?.uncertainMargin ?? DEFAULT_UNCERTAIN_MARGIN
  const uncertainThreshold = opts?.uncertainThreshold ?? DEFAULT_UNCERTAIN_THRESHOLD

  const isUncertain = face.score != null && face.score < uncertainThreshold
  const margin = isUncertain ? uncertainMargin : baseMargin

  return expandRegion(
    { x: face.x, y: face.y, w: face.width, h: face.height },
    margin,
  )
}

/**
 * 顔の配列 → ぼかし矩形の配列。
 */
export function buildBlurRegions(
  faces: readonly DetectedFace[],
  opts?: BlurOptions,
): MaskRegion[] {
  return faces.map((face) => faceToBlurRegion(face, opts))
}

export type DragState = {
  startX: number
  startY: number
  curX: number
  curY: number
}

/** ドラッグ状態 → 正規化矩形 (0..1) */
export function dragToRegion(drag: DragState): MaskRegion {
  const x = Math.min(drag.startX, drag.curX)
  const y = Math.min(drag.startY, drag.curY)
  const w = Math.abs(drag.curX - drag.startX)
  const h = Math.abs(drag.curY - drag.startY)
  return { x, y, w, h }
}

export function calculateMaskedOutputSize(
  width: number,
  height: number,
): { width: number; height: number } {
  const scale = Math.min(1, MAX_MASKED_OUTPUT_LONG_EDGE / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}
