"use client"

// =============================================
// きけんハンター たんけん:「どうして あぶない？」の3択と、答えたあとの学び
//  - ask: 場所が当たった直後。写真の上はふちどりで場所を見せたまま、下で理由を選ぶ。
//  - answered: 正解でも ちがっても、正しい理由・なぜ・つぎに すること を見せる(責めない)。
//  - info: 理由を問わない危険(other)。そのまま学びを見せる。
// 説明は答えたあとにだけ出す(先に出すと答えが分かってしまう)。
// =============================================

import { useEffect, useRef, type RefObject } from "react"
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

/**
 * 出たら見える所へスクロールし、フォーカスを移す(縦長の写真だと写真の下は画面の外になるため。
 * キーボード・読み上げでも、答えるたびに先頭からたどり直さなくてよいように)。
 */
function useRevealOnMount(
  sectionRef: RefObject<HTMLElement | null>,
  focusRef: RefObject<HTMLElement | null>,
  key: string,
  reduce: boolean,
) {
  useEffect(() => {
    const section = sectionRef.current
    if (section && typeof section.scrollIntoView === "function") {
      section.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
    }
    focusRef.current?.focus({ preventScroll: true })
  }, [sectionRef, focusRef, key, reduce])
}

/** 下の固定ボタンに隠れないよう、スクロールのときに下へ残す余白。 */
const SCROLL_MARGIN = { scrollMarginBottom: 132, scrollMarginTop: 72 } as const

export function ReasonSheet({ hazard, mode, choices, correct = false, onAnswer }: ReasonSheetProps) {
  const reduce = Boolean(useReducedMotion())
  const sectionRef = useRef<HTMLElement>(null)
  const focusRef = useRef<HTMLElement>(null)
  const asking = mode === "ask" && Boolean(choices && choices.length > 0)
  useRevealOnMount(sectionRef, focusRef, `${hazard.id}:${asking ? "ask" : mode}`, reduce)
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: tokens.spring }

  if (asking && choices) {
    const titleId = `reason-title-${hazard.id}`
    return (
      <motion.section
        ref={sectionRef}
        {...motionProps}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        style={SCROLL_MARGIN}
      >
        <PaperPanel tone="sun" className="px-4 py-4">
          <div className="flex items-center gap-2.5">
            <Mascot size="sm" mood="think" />
            <h3 id={titleId} className="text-[16px] font-black leading-snug" style={{ color: C.ink }}>
              みつけた！ どうして あぶないかな？
            </h3>
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {choices.map((choice, i) => (
              <button
                key={choice.kind}
                ref={i === 0 ? (el) => { focusRef.current = el } : undefined}
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

  // 答えの読み上げは ExploreScreen の常設の live 領域が行う(ここで aria-live を付けても、
  // 中身と同時に挿入されるため読まれないことがある)。ここは見出しへフォーカスを移すだけ。
  return (
    <motion.section ref={sectionRef} {...motionProps} aria-labelledby={`learn-title-${hazard.id}`} style={SCROLL_MARGIN}>
      <PaperPanel tone={mode === "answered" && !correct ? "accent" : "green"} className="px-4 py-4">
        <LearnHeader mode={mode} correct={correct} kind={hazard.kind} />
        <h3
          id={`learn-title-${hazard.id}`}
          ref={(el) => {
            focusRef.current = el
          }}
          tabIndex={-1}
          className="mt-2.5 text-[14.5px] font-black leading-relaxed outline-none"
          style={{ color: C.primaryStrong }}
        >
          <RubyText text={hazard.type} />
        </h3>
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
      <StampSeal size={48} label="◎" tone="green" />
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
