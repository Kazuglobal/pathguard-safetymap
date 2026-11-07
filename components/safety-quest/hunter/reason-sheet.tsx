"use client"

// =============================================
// きけんハンター 理由の3択と、答えたあとの学び(たんけん / あんぜん さがし で共通)
//  - ask: 場所が当たった直後。写真の上はふちどりで場所を見せたまま、下で理由を選ぶ。
//  - answered: 正解でも ちがっても、正しい理由・この写真での説明(・つぎに すること)を見せる(責めない)。
//  - info: 理由を問わないもの(other)。そのまま学びを見せる。
// 説明は答えたあとにだけ出す(先に出すと答えが分かってしまう)。
// =============================================

import { useEffect, useRef, type RefObject } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Check, Lightbulb, ShieldCheck } from "lucide-react"

import { RubyText } from "./ruby-text"
import { Mascot, PaperPanel, StampSeal, tokens } from "./theme"

const C = tokens.color

export type ReasonSheetMode = "ask" | "answered" | "info"

export interface ReasonSheetChoice {
  readonly kind: string
  readonly label: string
}

export interface ReasonSheetProps {
  /** 対象の ID(見出しの id・フォーカスの切り替えに使う)。 */
  id: string
  mode: ReasonSheetMode
  /** ask の見出し。既定は たんけん の問い。 */
  question?: string
  choices?: readonly ReasonSheetChoice[] | null
  /** answered のとき: 選んだ理由が合っていたか。 */
  correct?: boolean
  /** ちがったときに見せる正しい理由。 */
  correctReason?: string | null
  /** 種類のことば(例: 見通しの悪い角 / ガードレール)。 */
  title: string
  /** この写真での説明。 */
  detail: string
  /** つぎに すること(あんぜん さがし には無い)。 */
  action?: string | null
  onAnswer?: (kind: string) => void
}

export const DANGER_QUESTION = "みつけた！ どうして あぶないかな？"
export const SAFE_QUESTION = "みつけた！ どうして あんしんかな？"

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

export function ReasonSheet(props: ReasonSheetProps) {
  const { id, mode, question = DANGER_QUESTION, choices, correct = false, onAnswer } = props
  const reduce = Boolean(useReducedMotion())
  const sectionRef = useRef<HTMLElement>(null)
  const focusRef = useRef<HTMLElement>(null)
  const asking = mode === "ask" && Boolean(choices && choices.length > 0)
  useRevealOnMount(sectionRef, focusRef, `${id}:${asking ? "ask" : mode}`, reduce)
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: tokens.spring }

  if (asking && choices) {
    const titleId = `reason-title-${id}`
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
              {question}
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

  // 答えの読み上げは画面側の常設の live 領域が行う(ここで aria-live を付けても、
  // 中身と同時に挿入されるため読まれないことがある)。ここは見出しへフォーカスを移すだけ。
  return (
    <motion.section ref={sectionRef} {...motionProps} aria-labelledby={`learn-title-${id}`} style={SCROLL_MARGIN}>
      <PaperPanel tone={mode === "answered" && !correct ? "accent" : "green"} className="px-4 py-4">
        <LearnHeader mode={mode} correct={correct} correctReason={props.correctReason ?? null} />
        <h3
          id={`learn-title-${id}`}
          ref={(el) => {
            focusRef.current = el
          }}
          tabIndex={-1}
          className="mt-2.5 text-[14.5px] font-black leading-relaxed outline-none"
          style={{ color: C.primaryStrong }}
        >
          <RubyText text={props.title} />
        </h3>
        <p className="mt-1 flex gap-1.5 text-[14px] font-bold leading-relaxed" style={{ color: C.ink }}>
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" style={{ color: C.sunDeep }} />
          <span>
            <RubyText text={props.detail} />
          </span>
        </p>
        {props.action ? (
          <p className="mt-1 flex gap-1.5 text-[14px] font-black leading-relaxed" style={{ color: C.inkSoft }}>
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" style={{ color: C.primary }} />
            <span>
              つぎに すること：<RubyText text={props.action} />
            </span>
          </p>
        ) : null}
      </PaperPanel>
    </motion.section>
  )
}

function LearnHeader({
  mode,
  correct,
  correctReason,
}: {
  mode: ReasonSheetMode
  correct: boolean
  correctReason: string | null
}) {
  if (mode === "answered" && !correct) {
    return (
      <div className="flex items-start gap-2.5">
        <Mascot size="sm" mood="cheer" />
        <p className="text-[15px] font-black leading-relaxed" style={{ color: C.accentStrong }}>
          おしい！ ほんとうは「{correctReason ? <RubyText text={correctReason} /> : null}」だよ。
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
