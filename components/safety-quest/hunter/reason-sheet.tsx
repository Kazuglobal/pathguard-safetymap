"use client"

// =============================================
// きけんハンター たんけん:「どうして あぶない？」の3択と、答えたあとの学び
//  - ask: 場所が当たった直後。写真の上はふちどりで場所を見せたまま、下で理由を選ぶ。
//  - answered: 正解でも ちがっても、正しい理由・なぜ・つぎに すること を見せる(責めない)。
//  - info: 理由を問わない危険(other)。そのまま学びを見せる。
// 説明は答えたあとにだけ出す(先に出すと答えが分かってしまう)。
// =============================================

import { motion, useReducedMotion } from "framer-motion"
import { Check, Lightbulb, ShieldCheck } from "lucide-react"

import { KID_REASON_BY_KIND, type HunterDangerKind } from "@/lib/hunter/kid-copy"
import type { ReasonChoice } from "@/lib/hunter/reason-choices"
import type { HunterHazard } from "@/lib/hunter/types"

import { RubyText } from "./ruby-text"
import { Mascot, PaperPanel, StampSeal, tokens } from "./theme"

const C = tokens.color

export type ReasonSheetMode = "ask" | "answered" | "info"

export interface ReasonSheetProps {
  hazard: HunterHazard
  mode: ReasonSheetMode
  choices?: readonly ReasonChoice[] | null
  /** answered のとき: 選んだ理由が合っていたか。 */
  correct?: boolean
  onAnswer?: (kind: HunterDangerKind) => void
}

export function ReasonSheet({ hazard, mode, choices, correct = false, onAnswer }: ReasonSheetProps) {
  const reduce = useReducedMotion()
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: tokens.spring }

  if (mode === "ask" && choices && choices.length > 0) {
    const titleId = `reason-title-${hazard.id}`
    return (
      <motion.section {...motionProps} role="dialog" aria-modal="false" aria-labelledby={titleId}>
        <PaperPanel tone="sun" className="px-4 py-4">
          <div className="flex items-center gap-2.5">
            <Mascot size="sm" mood="think" />
            <h3 id={titleId} className="text-[16px] font-black leading-snug" style={{ color: C.ink }}>
              みつけた！ どうして あぶないかな？
            </h3>
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {choices.map((choice) => (
              <button
                key={choice.kind}
                type="button"
                aria-label={choice.label}
                onClick={() => onAnswer?.(choice.kind)}
                className={`min-h-[54px] w-full touch-manipulation rounded-[16px] border-2 bg-white px-4 py-2.5 text-left text-[15px] font-black leading-snug transition-transform active:translate-y-[2px] ${tokens.cls.focus}`}
                style={{ borderColor: "rgba(67,57,43,.16)", color: C.ink, boxShadow: tokens.shadow.pressPaper }}
              >
                <RubyText text={choice.label} />
              </button>
            ))}
          </div>
        </PaperPanel>
      </motion.section>
    )
  }

  return (
    <motion.section {...motionProps} aria-live="polite">
      <PaperPanel tone={mode === "answered" && !correct ? "accent" : "green"} className="px-4 py-4">
        <LearnHeader mode={mode} correct={correct} kind={hazard.kind} />
        <p className="mt-2.5 text-[14.5px] font-black leading-relaxed" style={{ color: C.primaryStrong }}>
          <RubyText text={hazard.type} />
        </p>
        <p className="mt-1 flex gap-1.5 text-[14px] font-bold leading-relaxed" style={{ color: C.ink }}>
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" style={{ color: C.sunDeep }} />
          <span>
            <RubyText text={hazard.kidExplanation} />
          </span>
        </p>
        <p className="mt-1 flex gap-1.5 text-[14px] font-black leading-relaxed" style={{ color: C.inkSoft }}>
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" style={{ color: C.primary }} />
          <span>
            つぎに すること：<RubyText text={hazard.safeAction} />
          </span>
        </p>
      </PaperPanel>
    </motion.section>
  )
}

function LearnHeader({ mode, correct, kind }: { mode: ReasonSheetMode; correct: boolean; kind?: HunterDangerKind }) {
  const reason = kind ? KID_REASON_BY_KIND[kind] : null
  if (mode === "answered" && !correct) {
    return (
      <div className="flex items-start gap-2.5">
        <Mascot size="sm" mood="cheer" />
        <p className="text-[15px] font-black leading-relaxed" style={{ color: C.accentStrong }}>
          おしい！ ほんとうは「{reason ? <RubyText text={reason} /> : null}」だよ。
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2.5">
      <StampSeal size={44} label="わかった" tone="green" />
      <p className="flex items-center gap-1 text-[15.5px] font-black leading-snug" style={{ color: C.primaryStrong }}>
        {mode === "answered" ? (
          <>
            <Check className="h-5 w-5 shrink-0" aria-hidden="true" />
            せいかい！ りゆうも わかったね
          </>
        ) : (
          "よく きづいたね！"
        )}
      </p>
    </div>
  )
}
