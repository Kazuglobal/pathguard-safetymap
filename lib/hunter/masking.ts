// =============================================
// きけんハンター 顔ぼかし矩形ロジック (純粋関数)
// オンデバイス顔検出の結果 → ぼかし矩形 (相対座標 0..1)
// canvas 適用や MediaPipe 呼び出しはブラウザ層で別途行う。
// =============================================

import type { HunterRegion } from "@/lib/hunter/types"

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
 * 矩形を [0,1] 範囲に収める。
 * - x,y を [0,1] にクランプ。
 * - 負の w,h は 0 に。
 * - x+w<=1, y+h<=1 となるよう w,h を縮める。
 */
export function clampRegion(r: HunterRegion): HunterRegion {
  const x = Math.min(Math.max(r.x, 0), 1)
  const y = Math.min(Math.max(r.y, 0), 1)
  const w = Math.min(Math.max(r.w, 0), 1 - x)
  const h = Math.min(Math.max(r.h, 0), 1 - y)
  return { x, y, w, h }
}

/**
 * 矩形を各辺 margin (割合) 分広げて clampRegion を通す。
 */
export function expandRegion(r: HunterRegion, margin: number): HunterRegion {
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
export function faceToBlurRegion(face: DetectedFace, opts?: BlurOptions): HunterRegion {
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
): HunterRegion[] {
  return faces.map((face) => faceToBlurRegion(face, opts))
}
