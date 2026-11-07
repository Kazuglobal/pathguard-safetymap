"use client"

// =============================================
// きけんハンター たんけん 1 回ぶんの状態フック
// 純粋な lib/hunter/explore-round.ts を React の状態へつなぐだけ。合計は毎回 replayExplore で数える。
// =============================================

import { useCallback, useMemo, useState } from "react"

import {
  answerReason,
  INITIAL_EXPLORE_ROUND,
  summarizeRound,
  tapRound,
  type ExploreRoundState,
  type ExploreRoundSummary,
} from "@/lib/hunter/explore-round"
import { buildReasonChoices, type ReasonChoice } from "@/lib/hunter/reason-choices"
import type { HunterDangerKind, HunterHazard, HunterTap } from "@/lib/hunter/types"

export interface ExploreRound {
  readonly state: ExploreRoundState
  readonly summary: ExploreRoundSummary
  /** 理由の答え待ちの危険とその3択。待っていなければ null。 */
  readonly pending: { readonly hazard: HunterHazard; readonly choices: readonly ReasonChoice[] } | null
  /** 直近に見つけた危険(ふちどり・学びのカード用)。次のタップで変わる。 */
  readonly lastFound: HunterHazard | null
  readonly onTap: (tap: HunterTap) => void
  readonly onReason: (kind: HunterDangerKind) => void
  readonly reset: () => void
}

export function useExploreRound(hazards: readonly HunterHazard[]): ExploreRound {
  const [state, setState] = useState<ExploreRoundState>(INITIAL_EXPLORE_ROUND)

  const onTap = useCallback(
    (tap: HunterTap) => {
      const at = Date.now()
      setState((current) => tapRound(current, tap, at, hazards))
    },
    [hazards],
  )
  const onReason = useCallback(
    (kind: HunterDangerKind) => setState((current) => answerReason(current, kind, hazards)),
    [hazards],
  )
  const reset = useCallback(() => setState(INITIAL_EXPLORE_ROUND), [])

  const summary = useMemo(() => summarizeRound(state, hazards), [state, hazards])

  const pending = useMemo(() => {
    const hazard = state.pendingReasonHazardId
      ? hazards.find((h) => h.id === state.pendingReasonHazardId) ?? null
      : null
    const choices = hazard ? buildReasonChoices(hazard, hazards) : null
    return hazard && choices ? { hazard, choices } : null
  }, [state.pendingReasonHazardId, hazards])

  const lastFound = useMemo(() => {
    const outcome = state.lastOutcome
    if (!outcome || outcome.result !== "hit" || !outcome.hazardId) return null
    return hazards.find((h) => h.id === outcome.hazardId) ?? null
  }, [state.lastOutcome, hazards])

  return { state, summary, pending, lastFound, onTap, onReason, reset }
}
