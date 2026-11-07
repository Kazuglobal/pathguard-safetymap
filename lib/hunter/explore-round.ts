// =============================================
// きけんハンター たんけん 1 回ぶんの画面の状態 (純粋ロジック)
// タップ → (当たりなら)理由の3択 → 次のタップ、を進める。
// 合計(見つけた数・虫めがね・点)は必ず replayExplore で数え直すので、
// サーバの再採点(app/api/hunter/session)と画面の結果がずれない。
//  - 理由の回答待ちの間・虫めがねを使い切った後・全部見つけた後のタップは受け付けない。
//  - 前のタップから TAP_DEBOUNCE_MS 以内のタップは受け付けない(連打・二重タップよけ)。
//  - 見つけ済みの枠のタップは送らない(採点に影響しないため。送るタップの数も増やさない)。
// React/IO/副作用なし。状態は毎回新しく作る。
// =============================================

import { isDeliberateMiss } from "@/lib/hunter/hint"
import {
  isRoundOpen,
  magnifierBudget,
  needsReason,
  replayExplore,
  type ExploreReplayResult,
} from "@/lib/hunter/explore-replay"
import type { HunterDangerKind, HunterHazard, HunterTap, HunterTapOutcome } from "@/lib/hunter/types"

/** これより短い間隔の 2 回目のタップは受け付けない。 */
export const TAP_DEBOUNCE_MS = 350

export interface ReasonAnswer {
  readonly hazardId: string
  readonly reason: HunterDangerKind | null
  readonly correct: boolean
}

export interface ExploreRoundState {
  /** サーバへ送るタップ(はずれ・おしい・当たり。当たりには理由が付く)。 */
  readonly taps: readonly HunterTap[]
  readonly lastTapAt: number | null
  readonly lastTap: HunterTap | null
  /** 直近に受け付けたタップの結果。理由を答えても作り直さない(画面の効果が二重に動かないように)。 */
  readonly lastOutcome: HunterTapOutcome | null
  /** 理由の答え待ちの危険。null なら待っていない。 */
  readonly pendingReasonHazardId: string | null
  /** 直近の理由の答え(こたえを見せる用)。次のタップで消える。 */
  readonly lastReason: ReasonAnswer | null
}

export const INITIAL_EXPLORE_ROUND: ExploreRoundState = {
  taps: [],
  lastTapAt: null,
  lastTap: null,
  lastOutcome: null,
  pendingReasonHazardId: null,
  lastReason: null,
}

export interface ExploreRoundSummary {
  readonly replay: ExploreReplayResult
  readonly foundIds: readonly string[]
  readonly understoodIds: readonly string[]
  readonly budget: number
  readonly magnifiersLeft: number
  /** 虫めがねを使い切った(全部は見つけていない)。 */
  readonly outOfMagnifiers: boolean
  readonly allFound: boolean
}

export function summarizeRound(state: ExploreRoundState, hazards: readonly HunterHazard[]): ExploreRoundSummary {
  const replay = replayExplore(state.taps, hazards)
  const budget = magnifierBudget(hazards.length)
  const allFound = hazards.length > 0 && replay.matches >= hazards.length
  return {
    replay,
    foundIds: replay.discoveries.map((d) => d.hazardId),
    understoodIds: replay.discoveries.filter((d) => d.understood).map((d) => d.hazardId),
    budget,
    magnifiersLeft: Math.max(0, budget - replay.misses),
    outOfMagnifiers: !allFound && replay.misses >= budget,
    allFound,
  }
}

/** タップを受け付けるか(答え待ち・連打・おしまいの後は受け付けない)。 */
export function canAcceptTap(state: ExploreRoundState, hazards: readonly HunterHazard[], at: number): boolean {
  if (state.pendingReasonHazardId !== null) return false
  if (state.lastTapAt !== null && at - state.lastTapAt < TAP_DEBOUNCE_MS) return false
  const replay = replayExplore(state.taps, hazards)
  return isRoundOpen({ misses: replay.misses, found: replay.matches }, hazards.length)
}

/** タップを 1 回進める。受け付けないときは同じ state を返す。 */
export function tapRound(
  state: ExploreRoundState,
  tap: HunterTap,
  at: number,
  hazards: readonly HunterHazard[],
): ExploreRoundState {
  if (!canAcceptTap(state, hazards, at)) return state
  const point: HunterTap = { x: tap.x, y: tap.y }
  const next = replayExplore([...state.taps, point], hazards)
  const outcome = next.outcomes[next.outcomes.length - 1]
  const base = { ...state, lastTapAt: at, lastTap: point, lastReason: null }

  if (outcome.result === "hit" && outcome.hazardId) {
    const hazard = hazards.find((h) => h.id === outcome.hazardId)
    const ask = hazard ? needsReason(hazard) : false
    return {
      ...base,
      taps: [...state.taps, point],
      lastOutcome: outcome,
      pendingReasonHazardId: ask ? outcome.hazardId : null,
    }
  }
  if (outcome.alreadyFound === true) {
    return { ...base, lastOutcome: outcome }
  }
  const deliberate = isDeliberateMiss(state.lastTapAt, at)
  return { ...base, taps: [...state.taps, point], lastOutcome: { ...outcome, deliberate } }
}

/**
 * 理由の3択に答える。答え待ちでなければ同じ state。
 * 当たりのタップ(最後に送ったタップ)に理由を付け直す。lastOutcome は作り直さない。
 */
export function answerReason(
  state: ExploreRoundState,
  reason: HunterDangerKind | null,
  hazards: readonly HunterHazard[],
): ExploreRoundState {
  const hazardId = state.pendingReasonHazardId
  if (hazardId === null || state.taps.length === 0) return state
  const hazard = hazards.find((h) => h.id === hazardId)
  const lastIndex = state.taps.length - 1
  const tagged: HunterTap = reason ? { ...state.taps[lastIndex], reason } : state.taps[lastIndex]
  return {
    ...state,
    taps: [...state.taps.slice(0, lastIndex), tagged],
    pendingReasonHazardId: null,
    lastReason: { hazardId, reason, correct: Boolean(hazard && reason && hazard.kind === reason) },
  }
}
