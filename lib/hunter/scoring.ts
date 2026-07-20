// =============================================
// きけんハンター 探索モード 採点ロジック (純粋関数)
// 設計書: docs/plans/2026-06-26-kiken-hunter-design.md
// React/IO/副作用なし。すべてイミュータブル。
//
// 方針B: Geminiのbboxを品質ゲートに通した「正確な当たり判定」+ ヒント。
//  - hit は子どもの指先分だけ補正し、明確に外れた場所は正解にしない。
//  - 外れ(near/miss)には最近傍の未発見hazardへの温度感・方向を付け、
//    自己修正できるようにする(自動発見はしない=最後は子のタップ)。
// =============================================

import type { RiskSeverity } from "@/lib/hazard-game-types"
import type {
  HunterDirection,
  HunterHazard,
  HunterRegion,
  HunterTap,
  HunterTapOutcome,
  HunterTemperature,
} from "@/lib/hunter/types"
import { SPATIAL_TAP_MARGIN, tapWithinRegion } from "@/lib/hunter/spatial-hit"

/** severity ごとの基礎点 */
export const SEVERITY_POINTS: Record<RiskSeverity, number> = {
  high: 150,
  medium: 100,
  low: 50,
}

/** severity の重み(複数hit候補・統合時の優先度) */
const WEIGHT_BY_SEVERITY: Record<RiskSeverity, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

/** hit ゾーンを各辺へ拡張する既定マージン(指先補正のみ)。 */
export const HIT_MARGIN = SPATIAL_TAP_MARGIN
/** near ゾーンを各辺へ拡張する既定マージン */
export const NEAR_OUTER = 0.18

/** 温度のしきい値(タップ〜最近傍hazard中心の距離) */
const HOT_DISTANCE = 0.18
const WARM_DISTANCE = 0.34

/** コンボ倍率の上限 */
const MAX_COMBO_MULTIPLIER = 2
/** コンボ 1 段あたりの増分 */
const COMBO_STEP = 0.1

export interface JudgeTapOptions {
  /** hit 判定ゾーンの拡張マージン。既定 HIT_MARGIN。 */
  hitMargin?: number
  /** near 判定ゾーンの拡張マージン。既定 NEAR_OUTER。 */
  nearMargin?: number
}

function regionCenter(region: HunterRegion): { x: number; y: number } {
  return { x: region.x + region.w / 2, y: region.y + region.h / 2 }
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

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** タップ〜最近傍hazard中心の距離を温度感へ。 */
export function tapTemperature(d: number): HunterTemperature {
  if (d <= HOT_DISTANCE) return "hot"
  if (d <= WARM_DISTANCE) return "warm"
  return "cold"
}

/** タップから hazard 中心への大まかな方向(上下左右)。同点は null。 */
export function tapDirection(tap: HunterTap, center: { x: number; y: number }): HunterDirection | null {
  const dx = center.x - tap.x
  const dy = center.y - tap.y
  if (dx === 0 && dy === 0) return null
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left"
  return dy >= 0 ? "down" : "up"
}

/** 未発見hazardのうち、タップに最も近いものとその距離を返す。無ければ null。 */
export function nearestUnfound(
  tap: HunterTap,
  hazards: readonly HunterHazard[],
  foundIds: ReadonlySet<string>,
): { hazardId: string | null; distance: number } {
  let bestId: string | null = null
  let best = Infinity
  for (const hazard of hazards) {
    if (foundIds.has(hazard.id)) continue
    const d = distance(tap, regionCenter(hazard.region))
    if (d < best) {
      best = d
      bestId = hazard.id
    }
  }
  return { hazardId: bestId, distance: best }
}

/**
 * 単発のベース判定 (コンボ非適用)。
 * - 未発見 hazard の hit ゾーン(広め)に内包する候補のうち severity重み×confidence 最大 -> hit
 * - hit 無し: 最近傍の未発見 hazard が near ゾーン内 -> near、外 -> miss
 * - near/miss には nearestId/temperature/direction を付与(自己修正用)
 * - 全 hazard 発見済みなら near を返さず最近傍も null(ヒント抑止)
 */
export function judgeTap(
  tap: HunterTap,
  hazards: readonly HunterHazard[],
  foundIds: ReadonlySet<string>,
  options?: JudgeTapOptions,
): HunterTapOutcome {
  const hitMargin = options?.hitMargin ?? HIT_MARGIN
  const nearMargin = options?.nearMargin ?? NEAR_OUTER

  // hit: 広めゾーンに入る未発見候補から、最も「危険で確からしい」1件を選ぶ
  let hit: HunterHazard | null = null
  let hitScore = -Infinity
  for (const hazard of hazards) {
    if (foundIds.has(hazard.id)) continue
    if (tapWithinRegion(tap, hazard.region, hitMargin)) {
      const score = WEIGHT_BY_SEVERITY[hazard.severity] * hazard.confidence
      if (score > hitScore) {
        hitScore = score
        hit = hazard
      }
    }
  }
  if (hit) {
    return { result: "hit", hazardId: hit.id, points: SEVERITY_POINTS[hit.severity] }
  }

  // 最近傍の未発見 hazard を基準にヒント(温度・方向)を作る
  const nearest = nearestUnfound(tap, hazards, foundIds)
  if (nearest.hazardId === null) {
    // 全発見済み: ヒントを出さない
    return { result: "miss", hazardId: null, points: 0, nearestId: null }
  }

  const nearestHazard = hazards.find((h) => h.id === nearest.hazardId) as HunterHazard
  const center = regionCenter(nearestHazard.region)
  const temperature = tapTemperature(nearest.distance)
  const direction = tapDirection(tap, center)
  const inNear = regionContains(expandRegion(nearestHazard.region, nearMargin), tap)

  return {
    result: inNear ? "near" : "miss",
    hazardId: inNear ? nearestHazard.id : null,
    points: 0,
    nearestId: nearest.hazardId,
    temperature,
    direction,
  }
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
 * - near/miss: consecutiveHits を 0 にリセット。
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
      outcomes.push({ result: "hit", hazardId: base.hazardId, points: awarded })
      continue
    }

    consecutiveHits = 0
    outcomes.push(base)
  }

  return { score, matches: found.size, comboMax, outcomes }
}
