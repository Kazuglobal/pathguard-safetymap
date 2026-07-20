// =============================================
// きけんハンター 段階ヒント ロジック (純粋関数)
// explore-canvas の「あったかい/つめたい→ゾーン発光→薄枠開示」の
// 発火レベルと対象選択を、UIから切り離して単体テスト可能にする。
// 自動発見はしない(最後は必ず子のタップ)。React/IO/副作用なし。
// =============================================

import { nearestUnfound } from "@/lib/hunter/scoring"
import type { HunterHazard } from "@/lib/hunter/types"

/** ヒント発火のしきい値(missStreak: 連続非hit / idleMs: 最後の発見からの経過)。 */
export const HINT_THRESHOLDS = {
  lv1Miss: 2,
  lv1Ms: 8000,
  lv2Miss: 4,
  lv2Ms: 16000,
  lv3Miss: 6,
  lv3Ms: 26000,
} as const

/**
 * ヒントレベル(0..3)を決める。
 * - 0=非表示 / 1=温度+方向 / 2=ゾーン発光 / 3=薄枠開示
 * - 最後の1件でも答えの枠を早出しせず、通常の Lv3 しきい値を守る。
 */
export function computeHintLevel(
  missStreak: number,
  idleMs: number,
  _remaining: number,
): 0 | 1 | 2 | 3 {
  const T = HINT_THRESHOLDS
  if (missStreak >= T.lv3Miss || idleMs >= T.lv3Ms) {
    return 3
  }
  if (missStreak >= T.lv2Miss || idleMs >= T.lv2Ms) return 2
  if (missStreak >= T.lv1Miss || idleMs >= T.lv1Ms) return 1
  return 0
}

/**
 * ヒントの対象(未発見 hazard)を選ぶ。
 * - 未発見が無ければ null。
 * - lastTap があればそれに最も近い未発見、無ければ未発見の先頭(rank 降順前提)。
 */
export function selectHintTarget(
  lastTap: { x: number; y: number } | null,
  hazards: readonly HunterHazard[],
  foundIds: ReadonlySet<string>,
): HunterHazard | null {
  const hasUnfound = hazards.some((h) => !foundIds.has(h.id))
  if (!hasUnfound) return null
  if (lastTap) {
    const near = nearestUnfound(lastTap, hazards, foundIds)
    if (near.hazardId) return hazards.find((h) => h.id === near.hazardId) ?? null
  }
  return hazards.find((h) => !foundIds.has(h.id)) ?? null
}
