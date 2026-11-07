// =============================================
// きけんハンター「あんぜん さがし」1 回ぶんの状態 (純粋ロジック)
// たんけん と同じ規則で「適当に押しても正解」にしない:
//  - 当たり判定は focus 中心の小さい当たり枠(sanitizeSafePoints が作る。判定は judgeTap を共用)。
//  - 虫めがね = 工夫の数 + MAGNIFIER_EXTRA。はずれ(おしい含む)で 1 つ減り、0 で おしまい。
//  - 当たったら「どうして あんしん？」の3択。理由まで合えば「わかった」。
//  - 理由の答え待ち・連打(TAP_DEBOUNCE_MS 以内)・おしまいの後のタップは受け付けない。
// サーバの採点・記録は無い(あんぜん さがし は ポイントを付けない)。状態は毎回新しく作る。
// =============================================

import { discoveryAccuracy, magnifierBudget } from "@/lib/hunter/explore-replay"
import { TAP_DEBOUNCE_MS } from "@/lib/hunter/explore-round"
import { isDeliberateMiss } from "@/lib/hunter/hint"
import { canAskSafeReason } from "@/lib/hunter/reason-choices"
import type { HunterSafeKind } from "@/lib/hunter/safe-kinds"
import { judgeTap } from "@/lib/hunter/scoring"
import type { HunterDiscovery, HunterHazard, HunterSafePoint, HunterTap, HunterTapOutcome } from "@/lib/hunter/types"

export interface SafeReasonAnswer {
  readonly pointId: string
  readonly reason: HunterSafeKind | null
  readonly correct: boolean
}

export interface SafeRoundState {
  readonly discoveries: readonly HunterDiscovery[]
  readonly misses: number
  readonly lastTapAt: number | null
  readonly lastTap: HunterTap | null
  readonly lastOutcome: HunterTapOutcome | null
  readonly pendingId: string | null
  readonly lastReason: SafeReasonAnswer | null
}

export const INITIAL_SAFE_ROUND: SafeRoundState = {
  discoveries: [],
  misses: 0,
  lastTapAt: null,
  lastTap: null,
  lastOutcome: null,
  pendingId: null,
  lastReason: null,
}

/** 安全の工夫を、タップ判定(judgeTap)とキャンバスが扱える形へ。 */
export function toSafeTargets(points: readonly HunterSafePoint[]): HunterHazard[] {
  return points.map((p) => ({
    id: p.id,
    type: p.type,
    region: p.region,
    ...(p.hitRegion ? { hitRegion: p.hitRegion } : {}),
    ...(p.focusPoint ? { focusPoint: p.focusPoint } : {}),
    severity: "low" as const,
    kidExplanation: p.whyGood,
    safeAction: "",
    confidence: 1,
  }))
}

export interface SafeRoundSummary {
  readonly foundIds: readonly string[]
  readonly understoodIds: readonly string[]
  readonly budget: number
  readonly magnifiersLeft: number
  readonly outOfMagnifiers: boolean
  readonly allFound: boolean
  /** 0..100(理由まで=1・場所だけ=0.6)。 */
  readonly accuracy: number
}

export function summarizeSafeRound(state: SafeRoundState, points: readonly HunterSafePoint[]): SafeRoundSummary {
  const budget = magnifierBudget(points.length)
  const found = state.discoveries.length
  const understood = state.discoveries.filter((d) => d.understood).length
  const allFound = points.length > 0 && found >= points.length
  return {
    foundIds: state.discoveries.map((d) => d.hazardId),
    understoodIds: state.discoveries.filter((d) => d.understood).map((d) => d.hazardId),
    budget,
    magnifiersLeft: Math.max(0, budget - state.misses),
    outOfMagnifiers: !allFound && state.misses >= budget,
    allFound,
    accuracy: discoveryAccuracy(found, understood, points.length),
  }
}

export function canAcceptSafeTap(state: SafeRoundState, points: readonly HunterSafePoint[], at: number): boolean {
  if (state.pendingId !== null) return false
  if (state.lastTapAt !== null && at - state.lastTapAt < TAP_DEBOUNCE_MS) return false
  const summary = summarizeSafeRound(state, points)
  return !summary.allFound && !summary.outOfMagnifiers
}

/** タップを 1 回進める。受け付けないときは同じ state を返す。 */
export function tapSafeRound(
  state: SafeRoundState,
  tap: HunterTap,
  at: number,
  points: readonly HunterSafePoint[],
): SafeRoundState {
  if (!canAcceptSafeTap(state, points, at)) return state
  const point: HunterTap = { x: tap.x, y: tap.y }
  const foundIds = new Set(state.discoveries.map((d) => d.hazardId))
  const outcome = judgeTap(point, toSafeTargets(points), foundIds)
  const base = { ...state, lastTapAt: at, lastTap: point, lastReason: null }

  if (outcome.result === "hit" && outcome.hazardId) {
    const target = points.find((p) => p.id === outcome.hazardId)
    const ask = canAskSafeReason(target?.safeKind)
    return {
      ...base,
      discoveries: [...state.discoveries, { hazardId: outcome.hazardId, understood: !ask }],
      lastOutcome: outcome,
      pendingId: ask ? outcome.hazardId : null,
    }
  }
  if (outcome.alreadyFound === true) return { ...base, lastOutcome: outcome }
  return {
    ...base,
    misses: state.misses + 1,
    lastOutcome: { ...outcome, deliberate: isDeliberateMiss(state.lastTapAt, at) },
  }
}

/** 「どうして あんしん？」に答える。答え待ちでなければ同じ state。lastOutcome は作り直さない。 */
export function answerSafeReason(
  state: SafeRoundState,
  reason: HunterSafeKind | null,
  points: readonly HunterSafePoint[],
): SafeRoundState {
  const pointId = state.pendingId
  if (pointId === null) return state
  const target = points.find((p) => p.id === pointId)
  const correct = Boolean(target && reason && target.safeKind === reason)
  return {
    ...state,
    discoveries: state.discoveries.map((d) => (d.hazardId === pointId ? { hazardId: pointId, understood: correct } : d)),
    pendingId: null,
    lastReason: { pointId, reason, correct },
  }
}
