// =============================================
// きけんハンター 探索モード 採点ロジック (純粋関数)
// 設計書: docs/plans/2026-06-26-kiken-hunter-design.md
// React/IO/副作用なし。すべてイミュータブル。
// =============================================

import type { RiskSeverity } from "@/lib/hazard-game-types"
import type {
  HunterHazard,
  HunterRegion,
  HunterTap,
  HunterTapOutcome,
} from "@/lib/hunter/types"

/** severity ごとの基礎点 */
export const SEVERITY_POINTS: Record<RiskSeverity, number> = {
  high: 150,
  medium: 100,
  low: 50,
}

/** near 判定で各辺を拡張する既定マージン (相対座標) */
const DEFAULT_NEAR_MARGIN = 0.06

/** コンボ倍率の上限 */
const MAX_COMBO_MULTIPLIER = 2

/** コンボ 1 段あたりの増分 */
const COMBO_STEP = 0.1

export interface JudgeTapOptions {
  nearMargin?: number
}

/** 点が region に内包されるか (端を含む)。 */
function regionContains(region: HunterRegion, tap: HunterTap): boolean {
  return (
    tap.x >= region.x &&
    tap.x <= region.x + region.w &&
    tap.y >= region.y &&
    tap.y <= region.y + region.h
  )
}

/** region を各辺 margin だけ拡張した新しい region を返す。 */
function expandRegion(region: HunterRegion, margin: number): HunterRegion {
  return {
    x: region.x - margin,
    y: region.y - margin,
    w: region.w + margin * 2,
    h: region.h + margin * 2,
  }
}

/**
 * 単発のベース判定 (コンボ非適用)。
 * - 未発見の hazard で tight region に内包する最初の1件 -> hit
 * - そうでなく、nearMargin 拡張領域に内包する hazard があれば -> near
 * - どれも無ければ -> miss
 */
export function judgeTap(
  tap: HunterTap,
  hazards: readonly HunterHazard[],
  foundIds: ReadonlySet<string>,
  options?: JudgeTapOptions,
): HunterTapOutcome {
  const nearMargin = options?.nearMargin ?? DEFAULT_NEAR_MARGIN

  for (const hazard of hazards) {
    if (foundIds.has(hazard.id)) continue
    if (regionContains(hazard.region, tap)) {
      return {
        result: "hit",
        hazardId: hazard.id,
        points: SEVERITY_POINTS[hazard.severity],
      }
    }
  }

  for (const hazard of hazards) {
    if (regionContains(expandRegion(hazard.region, nearMargin), tap)) {
      return { result: "near", hazardId: hazard.id, points: 0 }
    }
  }

  return { result: "miss", hazardId: null, points: 0 }
}

/**
 * n 回連続 hit の倍率。
 * 1hit -> 1.0, 2 -> 1.1, ... 上限 2.0。n <= 0 は 1。
 */
export function comboMultiplier(consecutiveHits: number): number {
  if (consecutiveHits <= 0) return 1
  return Math.min(MAX_COMBO_MULTIPLIER, 1 + COMBO_STEP * (consecutiveHits - 1))
}

export interface ReplayResult {
  score: number
  matches: number
  comboMax: number
  outcomes: HunterTapOutcome[]
}

/**
 * 権威ある再採点。taps を順に replay し、コンボを適用して集計する。
 * - hit: consecutiveHits を加算し comboMultiplier を base 点へ適用 (四捨五入)。
 *        hazard を発見済みに追加し comboMax を更新。
 * - near/miss: consecutiveHits を 0 にリセットし outcome をそのまま記録。
 */
export function scoreSession(
  taps: readonly HunterTap[],
  hazards: readonly HunterHazard[],
  options?: JudgeTapOptions,
): ReplayResult {
  const found = new Set<string>()
  const outcomes: HunterTapOutcome[] = []
  let consecutiveHits = 0
  let comboMax = 0
  let score = 0

  for (const tap of taps) {
    const base = judgeTap(tap, hazards, found, options)

    if (base.result === "hit" && base.hazardId !== null) {
      consecutiveHits += 1
      const multiplier = comboMultiplier(consecutiveHits)
      const awarded = Math.round(base.points * multiplier)
      found.add(base.hazardId)
      score += awarded
      if (consecutiveHits > comboMax) {
        comboMax = consecutiveHits
      }
      outcomes.push({
        result: "hit",
        hazardId: base.hazardId,
        points: awarded,
      })
      continue
    }

    consecutiveHits = 0
    outcomes.push(base)
  }

  return { score, matches: found.size, comboMax, outcomes }
}
