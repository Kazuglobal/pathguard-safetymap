import type { HunterRegion, HunterTap } from "@/lib/hunter/types"

/**
 * 写真タップ式の全モードで共通に使う指先補正。
 * 画像幅の2.5%だけを許容し、AIの領域から明確に外れた場所は正解にしない。
 */
export const SPATIAL_TAP_MARGIN = 0.025

/** 点が margin 分だけ広げた region に入るか（端を含む）。 */
export function tapWithinRegion(
  tap: HunterTap,
  region: HunterRegion,
  margin: number = SPATIAL_TAP_MARGIN,
): boolean {
  return (
    tap.x >= region.x - margin &&
    tap.x <= region.x + region.w + margin &&
    tap.y >= region.y - margin &&
    tap.y <= region.y + region.h + margin
  )
}
