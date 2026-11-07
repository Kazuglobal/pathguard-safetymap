"use client"

// =============================================
// きけんハンター たんけんモード(写真が主役)
//  写真 → 当たったら下に「どうして あぶない？」→ 答えたら学び → 次をさがす。
//  虫めがねを使い切ったら写真に案内を重ね、こたえあわせへ進める。
//  全部見つけても自動で次へ進まない(最後の学びを読む時間を保証。CTA の明示タップを待つ)。
// =============================================

import { motion, useReducedMotion } from "framer-motion"
import { ShieldCheck } from "lucide-react"

import type { ReasonAnswer } from "@/lib/hunter/explore-round"
import { needsReason } from "@/lib/hunter/explore-replay"
import type { ReasonChoice } from "@/lib/hunter/reason-choices"
import type {
  HunterAccidentSummary,
  HunterDangerKind,
  HunterHazard,
  HunterTap,
  HunterTapOutcome,
} from "@/lib/hunter/types"

import { CareCard } from "./care-card"
import { ExploreCanvas } from "./explore-canvas"
import { MagnifierMeter } from "./magnifier-meter"
import { ReasonSheet } from "./reason-sheet"
import { BottomBar, Mascot, PrimaryCTA, tokens } from "./theme"

const C = tokens.color

export interface ExploreScreenProps {
  accident: HunterAccidentSummary | null
  maskedUrl: string
  hazards: readonly HunterHazard[]
  foundIds: readonly string[]
  lastTap: { x: number; y: number } | null
  lastOutcome: HunterTapOutcome | null
  busy: boolean
  remaining: number
  onTap: (tap: HunterTap) => void
  onFinish: () => void
  /** 安全の工夫の数。全部見つけたあとに「あんぜんの くふうも さがす」を出す。 */
  safeCount?: number
  onSafeHunt?: () => void
  understoodIds?: readonly string[]
  /** 虫めがね(採点ルール v2)。null なら出さない。 */
  magnifiers?: { readonly left: number; readonly budget: number } | null
  outOfMagnifiers?: boolean
  pending?: { readonly hazard: HunterHazard; readonly choices: readonly ReasonChoice[] } | null
  lastFound?: HunterHazard | null
  lastReason?: ReasonAnswer | null
  onReason?: (kind: HunterDangerKind) => void
}

function finishLabel(props: ExploreScreenProps): string {
  if (props.busy) return "まとめているよ…"
  if (props.pending) return "りゆうを えらんでね"
  if (props.outOfMagnifiers) return "こたえあわせを する"
  if (props.remaining > 0) return `こたえあわせを する（のこり ${props.remaining}）`
  return "ぜんぶ みつけた！こたえあわせへ"
}

export function ExploreScreen(props: ExploreScreenProps) {
  const { maskedUrl, hazards, foundIds, lastTap, lastOutcome, busy, remaining, onTap, onFinish } = props
  const { safeCount = 0, onSafeHunt, magnifiers = null, outOfMagnifiers = false, pending = null } = props

  return (
    <div className="mx-auto flex w-full max-w-2xl min-h-full flex-col px-4 pt-1">
      <div className="flex flex-1 flex-col gap-3">
        {/* 写真が主役。先頭に置く */}
        <ExploreCanvas
          imageUrl={maskedUrl}
          hazards={hazards}
          foundIds={foundIds}
          onTap={onTap}
          lastTap={lastTap}
          lastOutcome={lastOutcome}
          understoodIds={props.understoodIds}
          activeHazardId={pending ? pending.hazard.id : null}
          paused={Boolean(pending)}
          locked={outOfMagnifiers}
          hudExtra={magnifiers ? <MagnifierMeter left={magnifiers.left} budget={magnifiers.budget} /> : null}
          overlay={outOfMagnifiers ? <OutOfMagnifiers /> : null}
        />

        <BelowPhoto {...props} />
      </div>

      <BottomBar className="-mx-4 px-4">
        <div className="flex flex-col gap-2">
          <PrimaryCTA
            disabled={busy || Boolean(pending)}
            variant={remaining > 0 && !outOfMagnifiers ? "green" : "sun"}
            onClick={onFinish}
          >
            {finishLabel(props)}
          </PrimaryCTA>
          {remaining === 0 && safeCount > 0 && onSafeHunt ? (
            <PrimaryCTA size="md" variant="paper" disabled={busy} onClick={onSafeHunt}>
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              あんぜんの くふうも さがす（{safeCount}）
            </PrimaryCTA>
          ) : null}
        </div>
      </BottomBar>
    </div>
  )
}

/** 写真の下: 理由の3択 → 答えたあとの学び → (何もないとき)この地点の「気をつけて」情報。 */
function BelowPhoto(props: ExploreScreenProps) {
  const { pending = null, lastFound = null, lastReason = null, onReason, accident } = props
  if (pending) {
    return <ReasonSheet hazard={pending.hazard} mode="ask" choices={pending.choices} onAnswer={onReason} />
  }
  if (lastFound && lastReason && lastReason.hazardId === lastFound.id) {
    return <ReasonSheet hazard={lastFound} mode="answered" correct={lastReason.correct} />
  }
  if (lastFound && !needsReason(lastFound)) {
    return <ReasonSheet hazard={lastFound} mode="info" />
  }
  return accident ? <CareCard accident={accident} compact /> : null
}

function OutOfMagnifiers() {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className="absolute inset-0 z-10 grid place-items-center p-4"
      style={{ background: "rgba(38,65,59,.55)", pointerEvents: "none" }}
    >
      <div
        aria-live="polite"
        className="flex max-w-[300px] flex-col items-center gap-2 rounded-[20px] px-5 py-4 text-center"
        style={{ background: C.card, boxShadow: tokens.shadow.card }}
      >
        <Mascot size="sm" mood="cheer" />
        <p className="text-[16px] font-black leading-snug" style={{ color: C.ink }}>
          むしめがねを ぜんぶ つかったよ！
        </p>
        <p className="text-[13px] font-bold leading-relaxed" style={{ color: C.inkSoft }}>
          こたえあわせで、どこが あぶないか いっしょに 見てみよう。
        </p>
      </div>
    </motion.div>
  )
}
