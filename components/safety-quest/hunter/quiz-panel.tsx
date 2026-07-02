"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Lightbulb, X } from "lucide-react"

import { judgeQuizAnswer } from "@/lib/hunter/quiz"
import type { HunterQuizAnswer, HunterQuizItem } from "@/lib/hunter/types"
import {
  containRect,
  toContainerPct,
  toImageCoords,
  type Size,
} from "@/lib/hunter/image-geometry"
import { RubyText } from "./ruby-text"
import { Mascot, PrimaryCTA, StatPill, tokens } from "./theme"

const C = tokens.color

export interface HunterQuizPanelProps {
  items: readonly HunterQuizItem[]
  imageUrl: string
  onComplete: (answers: HunterQuizAnswer[]) => void
}

export function HunterQuizPanel({ items, imageUrl, onComplete }: HunterQuizPanelProps) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<HunterQuizAnswer[]>([])
  const [revealed, setRevealed] = useState<{ answer: HunterQuizAnswer; correct: boolean } | null>(
    null,
  )

  const imageRef = useRef<HTMLDivElement>(null)
  const [natural, setNatural] = useState<Size | null>(null)
  const [box, setBox] = useState<Size | null>(null)

  const contain = useMemo(() => {
    if (!natural || !box) return null
    return containRect(natural, box)
  }, [natural, box])

  // imageUrl は全問題で共通の1枚(同一 <img src>)。ここでリセットしないと 2問目以降で
  // onLoad が再発火せず natural が null のまま固定され、place タップが恒久的に無効化される。
  useEffect(() => {
    setNatural(null)
  }, [imageUrl])

  useEffect(() => {
    const el = imageRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) setBox({ w: rect.width, h: rect.height })
    }
    update()
    if (typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [index])

  const item = items[index]
  const isLast = index >= items.length - 1

  const submit = useCallback(
    (answer: HunterQuizAnswer) => {
      if (revealed || !item) return
      const outcome = judgeQuizAnswer(item, answer)
      setAnswers((prev) => [...prev, answer])
      setRevealed({ answer, correct: outcome.correct })
    },
    [revealed, item],
  )

  if (!item) return null

  const goNext = () => {
    if (!revealed) return
    if (isLast) {
      onComplete(answers)
      return
    }
    setRevealed(null)
    setIndex((i) => i + 1)
  }

  const handleImageTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (revealed || !contain) return
    const rect = e.currentTarget.getBoundingClientRect()
    const rel = toImageCoords(e.clientX, e.clientY, rect, contain)
    if (!rel) return // レターボックス上は無視
    submit({ itemId: item.id, tap: rel })
  }

  /** answerRegion 中心の枠内 % 位置。 */
  const answerMarkerPos = () => {
    if (!item.answerRegion) return { left: "50%", top: "50%" }
    const center = {
      x: item.answerRegion.x + item.answerRegion.w / 2,
      y: item.answerRegion.y + item.answerRegion.h / 2,
    }
    if (!contain || !box) return { left: `${center.x * 100}%`, top: `${center.y * 100}%` }
    const pct = toContainerPct(center, contain, box)
    return { left: `${pct.leftPct}%`, top: `${pct.topPct}%` }
  }

  // place は否定しない: 外しても「ここにも あったね！」と温かく開示する。
  const placeHeading = revealed?.correct ? "せいかい！ " : "ここにも あったね！ "
  const choiceHeading = revealed?.correct ? "せいかい！ " : "おしい！ "
  const heading = item.kind === "place" ? placeHeading : choiceHeading

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* スクリーンリーダー向け: 解答結果と解説を読み上げる(常設。AnimatePresenceの
          マウント/アンマウントに頼ると一部ATで読み上げられないことがあるため独立させる) */}
      <span className="sr-only" role="status" aria-live="polite">
        {revealed ? `${heading}${item.explanation}` : ""}
      </span>

      <div className="flex items-center justify-between">
        <StatPill tone="blue" label="もんだい" value={`${index + 1} / ${items.length}`} />
        {item.theme && (
          <span
            className="rounded-full px-3 py-1 text-[12px] font-extrabold text-white"
            style={{ background: C.accent }}
          >
            <RubyText text={item.theme} />
          </span>
        )}
      </div>

      <div className="flex items-start gap-2.5">
        <span className="shrink-0">
          <Mascot size="sm" mood={revealed ? (revealed.correct ? "wow" : "cheer") : "think"} />
        </span>
        <p
          className="rounded-[18px] bg-white px-4 py-3 text-[16px] font-extrabold leading-relaxed"
          style={{ color: C.ink, boxShadow: tokens.shadow.soft }}
        >
          <RubyText text={item.question} />
        </p>
      </div>

      {item.kind === "place" ? (
        <div
          className="relative min-h-0 flex-1 overflow-hidden rounded-[20px]"
          style={{ background: C.headerNavy, boxShadow: tokens.shadow.card }}
        >
          <div
            ref={imageRef}
            role="button"
            tabIndex={0}
            aria-label="しゃしんの上を タップして こたえよう"
            onClick={handleImageTap}
            className={`relative h-full w-full ${tokens.cls.focus}`}
            style={{ cursor: revealed ? "default" : "pointer" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="クイズの しゃしん"
              draggable={false}
              onLoad={(e) => {
                const img = e.currentTarget
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setNatural({ w: img.naturalWidth, h: img.naturalHeight })
                }
              }}
              className="absolute inset-0 h-full w-full object-contain"
              style={{ pointerEvents: "none" }}
            />
            {/* 解答後: 正解の場所を温かく見せる(外しても否定しない) */}
            {revealed && item.answerRegion && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 16 }}
                aria-hidden="true"
                className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                style={{
                  ...answerMarkerPos(),
                  width: 52,
                  height: 52,
                  background: revealed.correct ? C.success : C.warning,
                  color: revealed.correct ? "#fff" : C.ink,
                  boxShadow: `0 0 0 4px #fff, ${tokens.shadow.card}`,
                }}
              >
                {revealed.correct ? (
                  <Check className="h-6 w-6" strokeWidth={3} />
                ) : (
                  <span className="text-2xl font-black">!</span>
                )}
              </motion.span>
            )}
            {!revealed && (
              <span className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
                <span className="rounded-full bg-black/55 px-3 py-1 text-[12px] font-bold text-white">
                  しゃしんを タップして こたえてね
                </span>
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {item.choices?.map((choice) => {
            const isCorrect = choice.id === item.correctChoiceId
            const isPicked = revealed?.answer.choiceId === choice.id
            const bg = !revealed
              ? C.surface
              : isCorrect
                ? C.success
                : isPicked
                  ? C.danger
                  : C.surface
            const color = !revealed ? C.ink : isCorrect || isPicked ? "#fff" : C.inkSoft
            return (
              <button
                key={choice.id}
                type="button"
                disabled={Boolean(revealed)}
                onClick={() => submit({ itemId: item.id, choiceId: choice.id })}
                className={`flex items-center gap-2 rounded-[18px] px-4 py-3.5 text-left text-[15px] font-extrabold ${tokens.cls.focus}`}
                style={{ background: bg, color, boxShadow: tokens.shadow.soft }}
              >
                {revealed && isCorrect && <Check className="h-5 w-5 shrink-0" strokeWidth={3} />}
                {revealed && isPicked && !isCorrect && <X className="h-5 w-5 shrink-0" strokeWidth={3} />}
                <RubyText text={choice.label} />
              </button>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-2.5"
          >
            <div
              className="flex items-start gap-2 rounded-[18px] px-4 py-3"
              style={{ background: C.surfaceWarm, boxShadow: tokens.shadow.soft }}
            >
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0" style={{ color: C.warning }} aria-hidden="true" />
              <p className="text-[14px] font-bold leading-relaxed" style={{ color: C.ink }}>
                <span className="font-extrabold" style={{ color: revealed.correct ? C.success : C.accentStrong }}>
                  {heading}
                </span>
                <RubyText text={item.explanation} />
              </p>
            </div>
            <PrimaryCTA onClick={goNext}>
              {isLast ? "けっかを みる" : "つぎの もんだいへ"}
            </PrimaryCTA>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
