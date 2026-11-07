"use client"

// =============================================
// きけんハンター 逆モード「あんぜん さがし」
// 写真の中の「安全の工夫」(ガードレール・歩道・ミラー等)を肯定形で探す。
// たんけん と同じ規則で「適当に押しても正解」にしない(lib/hunter/safe-round.ts):
//  - 当たりは focus 中心の小さい当たり枠(和集合は写真の 25% 以下)。
//  - 虫めがね = 工夫の数 + 3。はずれで減り、使い切ったら こたえあわせへ。
//  - 当たったら「どうして あんしん？」の3択。説明は答えたあとに出す。
//  - 最後は こたえあわせ(写真の上で番号つき・見のがした工夫の場所も見せる)。
// ポイントは付けない(サーバの採点・記録は無い)。safePoints が無ければ呼ばれない。
// =============================================

import { useCallback, useMemo, useState } from "react"

import { buildSafeReasonChoices } from "@/lib/hunter/reason-choices"
import { buildSafeRevealItems } from "@/lib/hunter/reveal"
import {
  answerSafeReason,
  INITIAL_SAFE_ROUND,
  summarizeSafeRound,
  tapSafeRound,
  toSafeTargets,
  type SafeRoundState,
} from "@/lib/hunter/safe-round"
import { KID_SAFE_REASON_BY_KIND, type HunterSafeKind } from "@/lib/hunter/safe-kinds"
import type { HunterSafePoint, HunterTap } from "@/lib/hunter/types"

import { AnswerRevealScreen } from "./answer-reveal/answer-reveal-screen"
import { ExploreCanvas } from "./explore-canvas"
import { OutOfMagnifiers } from "./explore-screen"
import { MagnifierMeter } from "./magnifier-meter"
import { ReasonSheet, SAFE_QUESTION } from "./reason-sheet"
import { RubyText } from "./ruby-text"
import { BottomBar, PrimaryCTA, SpeechBubble } from "./theme"

export interface SafeHuntCanvasProps {
  imageUrl: string
  safePoints: readonly HunterSafePoint[]
  onDone: () => void
}

export const SAFE_SURFACE_LABEL = "しゃしんの上を タップして、安全の くふうを さがそう"

const safeFoundLabel = (title: string, understood: boolean) =>
  `みつけた あんぜん: ${title}${understood ? "（りゆうも わかった）" : ""}`

function useSafeRound(points: readonly HunterSafePoint[]) {
  const [state, setState] = useState<SafeRoundState>(INITIAL_SAFE_ROUND)
  const onTap = useCallback(
    (tap: HunterTap) => {
      const at = Date.now()
      setState((current) => tapSafeRound(current, tap, at, points))
    },
    [points],
  )
  const onReason = useCallback(
    (kind: string) => setState((current) => answerSafeReason(current, kind as HunterSafeKind, points)),
    [points],
  )
  const summary = useMemo(() => summarizeSafeRound(state, points), [state, points])
  return { state, summary, onTap, onReason }
}

function correctReasonOf(point: HunterSafePoint): string | null {
  return point.safeKind ? KID_SAFE_REASON_BY_KIND[point.safeKind] : null
}

export function SafeHuntCanvas({ imageUrl, safePoints, onDone }: SafeHuntCanvasProps) {
  const [phase, setPhase] = useState<"play" | "reveal">("play")
  const { state, summary, onTap, onReason } = useSafeRound(safePoints)
  const targets = useMemo(() => toSafeTargets(safePoints), [safePoints])

  if (phase === "reveal") {
    return (
      <AnswerRevealScreen
        imageUrl={imageUrl}
        items={buildSafeRevealItems(safePoints, state.discoveries)}
        variant="safe"
        accident={null}
        doneLabel="おわる"
        onDone={onDone}
      />
    )
  }

  const pendingPoint = state.pendingId ? safePoints.find((p) => p.id === state.pendingId) ?? null : null
  const remaining = Math.max(0, safePoints.length - summary.foundIds.length)

  return (
    <div className="mx-auto flex w-full max-w-2xl min-h-full flex-1 flex-col px-4 pt-1">
      <div className="flex flex-1 flex-col gap-3">
        <SpeechBubble mood={summary.outOfMagnifiers ? "cheer" : "happy"}>
          この みちの「<RubyText text="安全" />の くふう」を さがそう！ ガードレールや <RubyText text="歩道" />は
          あんしんの しるしだよ。
        </SpeechBubble>

        <ExploreCanvas
          imageUrl={imageUrl}
          hazards={targets}
          foundIds={summary.foundIds}
          understoodIds={summary.understoodIds}
          onTap={onTap}
          lastTap={state.lastTap}
          lastOutcome={state.lastOutcome}
          activeHazardId={state.pendingId}
          activeTone="green"
          paused={Boolean(pendingPoint)}
          locked={summary.outOfMagnifiers}
          hudExtra={<MagnifierMeter left={summary.magnifiersLeft} budget={summary.budget} />}
          overlay={
            summary.outOfMagnifiers ? (
              <OutOfMagnifiers detail="こたえあわせで、あんしんの くふうが どこに あるか いっしょに みてみよう。" />
            ) : null
          }
          surfaceLabel={SAFE_SURFACE_LABEL}
          foundLabel={safeFoundLabel}
          guideText="タップして あんしんの くふうを さがそう"
        />

        <SafeBelowPhoto state={state} points={safePoints} pendingPoint={pendingPoint} onReason={onReason} />
      </div>

      <BottomBar className="-mx-4 px-4">
        <PrimaryCTA
          disabled={Boolean(pendingPoint)}
          variant={summary.allFound || summary.outOfMagnifiers ? "sun" : "green"}
          onClick={() => setPhase("reveal")}
        >
          {pendingPoint
            ? "りゆうを えらんでね"
            : summary.allFound
              ? "ぜんぶ みつけた！こたえあわせへ"
              : summary.outOfMagnifiers
                ? "こたえあわせを する"
                : `こたえあわせを する（のこり ${remaining}）`}
        </PrimaryCTA>
      </BottomBar>
    </div>
  )
}

/** 写真の下: 「どうして あんしん？」→ 答えたあとの学び。読み上げは常設の live 領域で行う。 */
function SafeBelowPhoto({
  state,
  points,
  pendingPoint,
  onReason,
}: {
  state: SafeRoundState
  points: readonly HunterSafePoint[]
  pendingPoint: HunterSafePoint | null
  onReason: (kind: string) => void
}) {
  const lastFoundId = state.lastOutcome?.result === "hit" ? state.lastOutcome.hazardId : null
  const lastFound = lastFoundId ? points.find((p) => p.id === lastFoundId) ?? null : null
  const answered = lastFound && state.lastReason?.pointId === lastFound.id ? state.lastReason : null
  const announcement = answered
    ? answered.correct
      ? "せいかい！ りゆうも わかったね。"
      : `おしい！ ほんとうは「${lastFound ? correctReasonOf(lastFound) ?? "" : ""}」だよ。`
    : ""

  let sheet = null
  if (pendingPoint) {
    const choices = buildSafeReasonChoices(pendingPoint, points)
    sheet = (
      <ReasonSheet
        id={pendingPoint.id}
        mode="ask"
        question={SAFE_QUESTION}
        choices={choices}
        title={pendingPoint.type}
        detail={pendingPoint.whyGood}
        onAnswer={onReason}
      />
    )
  } else if (lastFound) {
    sheet = (
      <ReasonSheet
        id={lastFound.id}
        mode={answered ? "answered" : "info"}
        correct={answered ? answered.correct : true}
        correctReason={correctReasonOf(lastFound)}
        title={lastFound.type}
        detail={lastFound.whyGood}
      />
    )
  }

  return (
    <>
      {sheet}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </>
  )
}
