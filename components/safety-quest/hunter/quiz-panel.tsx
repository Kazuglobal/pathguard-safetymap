"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Check, Lightbulb, X } from "lucide-react"

import { judgeQuizAnswer } from "@/lib/hunter/quiz"
import type { HunterQuizAnswer, HunterQuizItem, HunterTap } from "@/lib/hunter/types"
import { RubyText } from "./ruby-text"
import { Mascot, PrimaryCTA, StatPill, tokens } from "./theme"

const C = tokens.color

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

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

  const item = items[index]
  if (!item) return null
  const isLast = index >= items.length - 1

  const submit = (answer: HunterQuizAnswer) => {
    if (revealed) return
    const outcome = judgeQuizAnswer(item, answer)
    const nextAnswers = [...answers, answer]
    setAnswers(nextAnswers)
    setRevealed({ answer, correct: outcome.correct })
  }

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
    if (revealed) return
    const rect = e.currentTarget.getBoundingClientRect()
    submit({
      itemId: item.id,
      tap: {
        x: clamp01((e.clientX - rect.left) / rect.width),
        y: clamp01((e.clientY - rect.top) / rect.height),
      },
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* 進捗 */}
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

      {/* 問い */}
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

      {/* place: 写真をタップ / choice: 4択 */}
      {item.kind === "place" ? (
        <div
          className="relative min-h-0 flex-1 overflow-hidden rounded-[20px]"
          style={{ background: C.headerNavy, boxShadow: tokens.shadow.card }}
        >
          <div
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
              className="absolute inset-0 h-full w-full object-contain"
              style={{ pointerEvents: "none" }}
            />
            {/* 解答後: 正解の場所を見せる */}
            {revealed && item.answerRegion && (
              <motion.span
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 16 }}
                aria-hidden="true"
                className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
                style={{
                  left: `${(item.answerRegion.x + item.answerRegion.w / 2) * 100}%`,
                  top: `${(item.answerRegion.y + item.answerRegion.h / 2) * 100}%`,
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

      {/* 解説＋つぎへ */}
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
                  {revealed.correct ? "せいかい！ " : "おしい！ "}
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
