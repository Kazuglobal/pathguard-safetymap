// =============================================
// 写真の縦横比 → タップ面の CSS aspect-ratio (純粋ロジック)
// 4:3 固定だと縦長写真(子どもが縦持ちで撮る既定)が枠幅の半分以下に縮み、
// 危険ポイントの的が 24〜33px になっていた。写真の比率に合わせ、極端な比率は
// 3:4〜4:3 にクランプする(オーバーレイ座標は箱サイズから都度計算するので不変)。
// =============================================

export const DEFAULT_PHOTO_ASPECT = "4 / 3"
const MIN_RATIO = 3 / 4
const MAX_RATIO = 4 / 3

export function photoAspectRatio(natural: { w: number; h: number } | null | undefined): string {
  if (!natural || !(natural.w > 0) || !(natural.h > 0)) return DEFAULT_PHOTO_ASPECT
  const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, natural.w / natural.h))
  return `${Math.round(ratio * 1000)} / 1000`
}
