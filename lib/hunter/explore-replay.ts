// =============================================
// きけんハンター たんけん 採点ルール v2 (純粋ロジック)
// 「適当に押しても正解」をなくすための採点。クライアントとサーバが同じ関数で数えるので、
// 画面の結果とサーバの再採点は必ず一致する。
//  - 虫めがね = 危険の数 + MAGNIFIER_EXTRA。はずれ(おしい含む)で 1 つ減り、0 で おしまい。
//    当たり・見つけ済みの枠の再タップでは減らない。
//  - 当たったら「どうして あぶない？」。理由が合えば達成度 1.0、ちがえば LOCATION_SHARE。
//  - 虫めがねを使い切った後・全部見つけた後のタップは採点しない(ignoredTaps)。
// React/IO/副作用なし。入力は変更しない。
// =============================================

import type { RiskSeverity } from "@/lib/hazard-game-types"
import { canAskReason } from "@/lib/hunter/reason-choices"
import { comboMultiplier, judgeTap, scoreSession, SEVERITY_POINTS } from "@/lib/hunter/scoring"
import type { HunterDiscovery, HunterHazard, HunterTap, HunterTapOutcome } from "@/lib/hunter/types"

/** 採点ルールの版。正解鍵(answer-cache)にこの値があるときだけ v2 で数える。 */
export const HUNTER_RULES_VERSION = 2
/** 危険の数に足す、虫めがねのおまけ。 */
export const MAGNIFIER_EXTRA = 3
/** 場所だけ当たって理由がちがうときの達成度。 */
export const LOCATION_SHARE = 0.6
/** 理由が合ったときの追加点(コンボはかけない)。基礎点のおよそ 2/3。 */
export const REASON_POINTS: Readonly<Record<RiskSeverity, number>> = {
  high: 100,
  medium: 67,
  low: 33,
}

export interface ExploreReplayResult {
  readonly score: number
  /** 場所が当たった数。 */
  readonly matches: number
  /** 理由まで合った数(理由を問わない危険は場所が当たれば数える)。 */
  readonly understood: number
  readonly comboMax: number
  readonly budget: number
  /** 虫めがねを使った数(はずれ・おしい)。 */
  readonly misses: number
  readonly ignoredTaps: number
  /** 0..100。理由まで=1、場所だけ=LOCATION_SHARE の合計 / 危険の数。 */
  readonly accuracy: number
  /** taps と同じ順・同じ数。 */
  readonly outcomes: readonly HunterTapOutcome[]
  /** 見つけた順。 */
  readonly discoveries: readonly HunterDiscovery[]
}

interface ReplayState {
  readonly score: number
  readonly combo: number
  readonly comboMax: number
  readonly misses: number
  readonly ignoredTaps: number
  readonly outcomes: readonly HunterTapOutcome[]
  readonly discoveries: readonly HunterDiscovery[]
}

const INITIAL_STATE: ReplayState = {
  score: 0,
  combo: 0,
  comboMax: 0,
  misses: 0,
  ignoredTaps: 0,
  outcomes: [],
  discoveries: [],
}

export function magnifierBudget(total: number): number {
  return Math.max(0, total) + MAGNIFIER_EXTRA
}

/** 理由の答えが要る危険か(other・kind 無しは場所だけで「わかった」)。 */
export function needsReason(hazard: Pick<HunterHazard, "kind">): boolean {
  return canAskReason(hazard.kind)
}

/** 理由まで合っているか。 */
export function isReasonCorrect(hazard: Pick<HunterHazard, "kind">, tap: HunterTap): boolean {
  return !needsReason(hazard) || tap.reason === hazard.kind
}

/** 理由まで=1、場所だけ=LOCATION_SHARE で数えた達成度(0..100 の整数)。 */
export function discoveryAccuracy(matches: number, understood: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0
  const u = Math.max(0, Math.min(understood, matches, total))
  const m = Math.max(u, Math.min(matches, total))
  const credit = u + (m - u) * LOCATION_SHARE
  return Math.max(0, Math.min(100, Math.round((credit / total) * 100)))
}

/** 虫めがねが残っていて、まだ見つけていない危険があるか。 */
export function isRoundOpen(state: { misses: number; found: number }, total: number): boolean {
  return state.misses < magnifierBudget(total) && state.found < total
}

const IGNORED: HunterTapOutcome = { result: "miss", hazardId: null, points: 0, ignored: true }

function applyHit(state: ReplayState, hazard: HunterHazard, tap: HunterTap): ReplayState {
  const combo = state.combo + 1
  const reasonCorrect = isReasonCorrect(hazard, tap)
  const location = Math.round(SEVERITY_POINTS[hazard.severity] * comboMultiplier(combo))
  const reason = reasonCorrect ? REASON_POINTS[hazard.severity] : 0
  return {
    ...state,
    score: state.score + location + reason,
    combo,
    comboMax: Math.max(state.comboMax, combo),
    outcomes: [
      ...state.outcomes,
      { result: "hit", hazardId: hazard.id, points: location + reason, reasonCorrect },
    ],
    discoveries: [...state.discoveries, { hazardId: hazard.id, understood: reasonCorrect }],
  }
}

/** タップ 1 回ぶん進める(新しい状態を返す)。 */
function stepTap(state: ReplayState, tap: HunterTap, hazards: readonly HunterHazard[]): ReplayState {
  const total = hazards.length
  if (!isRoundOpen({ misses: state.misses, found: state.discoveries.length }, total)) {
    return { ...state, ignoredTaps: state.ignoredTaps + 1, outcomes: [...state.outcomes, IGNORED] }
  }
  const foundIds = new Set(state.discoveries.map((d) => d.hazardId))
  const outcome = judgeTap(tap, hazards, foundIds)
  if (outcome.result === "hit" && outcome.hazardId) {
    const hazard = hazards.find((h) => h.id === outcome.hazardId) as HunterHazard
    return applyHit(state, hazard, tap)
  }
  if (outcome.alreadyFound === true) {
    // 見つけ済みの枠: 虫めがねは減らさず、コンボもそのまま。
    return { ...state, outcomes: [...state.outcomes, outcome] }
  }
  return { ...state, combo: 0, misses: state.misses + 1, outcomes: [...state.outcomes, outcome] }
}

/** taps を順に数える(採点ルール v2)。 */
export function replayExplore(
  taps: readonly HunterTap[],
  hazards: readonly HunterHazard[],
): ExploreReplayResult {
  const final = taps.reduce((state, tap) => stepTap(state, tap, hazards), INITIAL_STATE)
  const matches = final.discoveries.length
  const understood = final.discoveries.filter((d) => d.understood).length
  return {
    score: final.score,
    matches,
    understood,
    comboMax: final.comboMax,
    budget: magnifierBudget(hazards.length),
    misses: final.misses,
    ignoredTaps: final.ignoredTaps,
    accuracy: discoveryAccuracy(matches, understood, hazards.length),
    outcomes: final.outcomes,
    discoveries: final.discoveries,
  }
}

export interface ExploreSessionScore extends ExploreReplayResult {
  /** 実際に使ったルール(1=旧: 回数制限・理由なし / 2=v2)。 */
  readonly rules: 1 | 2
}

/**
 * session ルート用の入口。rules=2 なら v2、それ以外は旧ルール(scoreSession)で数え、
 * 同じ形で返す(旧ルールは理由を問わないので understood=matches、虫めがねは無制限扱い)。
 */
export function scoreExploreSession(
  taps: readonly HunterTap[],
  hazards: readonly HunterHazard[],
  rules: number | undefined | null,
): ExploreSessionScore {
  if (rules === HUNTER_RULES_VERSION) return { ...replayExplore(taps, hazards), rules: 2 }
  const legacy = scoreSession(taps, hazards)
  const discoveries = legacy.outcomes.flatMap((o) =>
    o.result === "hit" && o.hazardId ? [{ hazardId: o.hazardId, understood: true }] : [],
  )
  return {
    score: legacy.score,
    matches: legacy.matches,
    understood: legacy.matches,
    comboMax: legacy.comboMax,
    budget: 0,
    misses: legacy.outcomes.filter((o) => o.result !== "hit").length,
    ignoredTaps: 0,
    accuracy: discoveryAccuracy(legacy.matches, legacy.matches, hazards.length),
    outcomes: legacy.outcomes,
    discoveries,
    rules: 1,
  }
}
