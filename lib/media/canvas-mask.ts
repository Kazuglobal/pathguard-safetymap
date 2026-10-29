// =============================================
// canvas へのぼかし(報告の写真・きけんハンターで共用。UIUX改装 項目57)
// もとは components/safety-quest/hunter/mask-confirm.tsx にあった処理を、そのまま移した。
// =============================================

import type { MaskRegion } from "@/lib/media/masking"

/** ぼかしの強さ (ピクセレート時の縮小先サイズ目安・px) */
export const PIXELATE_TARGET_PX = 12

/**
 * 1つのぼかし領域を canvas に適用 (強いピクセレート)。
 * 対象範囲を極小サイズに縮小 → 元範囲へ拡大描画することで判別不能化する。
 */
export function applyBlurRegion(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  region: MaskRegion,
): void {
  const sx = Math.round(region.x * canvas.width)
  const sy = Math.round(region.y * canvas.height)
  const sw = Math.round(region.w * canvas.width)
  const sh = Math.round(region.h * canvas.height)
  if (sw <= 0 || sh <= 0) return

  // 縮小先サイズ (アスペクト維持・最低1px)
  const scale = Math.min(1, PIXELATE_TARGET_PX / Math.max(sw, sh))
  const tw = Math.max(1, Math.round(sw * scale))
  const th = Math.max(1, Math.round(sh * scale))

  const tmp = document.createElement("canvas")
  tmp.width = tw
  tmp.height = th
  const tctx = tmp.getContext("2d")
  if (!tctx) return

  // 対象範囲を縮小コピー
  tctx.imageSmoothingEnabled = true
  tctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, tw, th)

  // 縮小画像をブロック状に拡大描画 (ピクセレート)
  const prevSmoothing = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(tmp, 0, 0, tw, th, sx, sy, sw, sh)

  // さらにブラーで境界をなじませる (対応ブラウザのみ)
  try {
    ctx.save()
    ctx.filter = "blur(4px)"
    ctx.drawImage(tmp, 0, 0, tw, th, sx, sy, sw, sh)
    ctx.restore()
  } catch {
    // ctx.filter 未対応でもピクセレートだけで十分判別不能
  }
  ctx.imageSmoothingEnabled = prevSmoothing
}
