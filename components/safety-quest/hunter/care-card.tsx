"use client"

import { motion, useReducedMotion, type Transition } from "framer-motion"
import { Baby, Clock, ShieldAlert, Sparkles } from "lucide-react"

import type { HunterAccidentSummary } from "@/lib/hunter/types"

import { Mascot, StatPill, tokens } from "./theme"

// きけんハンター「気をつけるカード」
// 子ども向け・やさしい・断定しないトーンで、地点の事故サマリを表示する。
// 配色/角丸/影/演出は共通テーマ（theme.tsx）の tokens に統一。

const C = tokens.color

const SPRING: Transition = { type: "spring", stiffness: 260, damping: 18 }

export function CareCard({ accident }: { accident: HunterAccidentSummary }) {
  const reduce = useReducedMotion()

  const {
    hasData,
    riskLabel,
    riskEmoji,
    childInvolved,
    topAccidentType,
    peakTimeSlot,
    kidMessage,
  } = accident

  const showChildChip = hasData && childInvolved > 0
  const showTypeChip = hasData && topAccidentType !== null
  const showTimeChip = hasData && peakTimeSlot !== null
  const hasAnyChip = showChildChip || showTypeChip || showTimeChip

  return (
    <motion.section
      className="relative overflow-hidden rounded-[24px] bg-[#FFF8EF] p-5"
      style={{
        boxShadow: `${tokens.shadow.soft}, ${tokens.shadow.card}`,
      }}
      aria-label="気をつけるカード"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduce ? { duration: 0.2 } : SPRING}
    >
      {/* やわらかい飾りの光（装飾） */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full"
        style={{ background: C.warning, opacity: 0.16 }}
      />

      {/* 上部: 危険レベルのバッジ ＋ 見守るハンタくん */}
      <div className="relative flex items-start justify-between gap-3">
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-2"
          style={{
            backgroundColor: C.primaryStrong,
            color: "#FFFFFF",
            boxShadow: tokens.shadow.soft,
          }}
        >
          <span className="text-lg leading-none" aria-hidden="true">
            {riskEmoji}
          </span>
          <span className="text-[15px] font-extrabold tracking-wide">
            {riskLabel}
          </span>
        </div>

        <span className="-mt-1 -mr-1 shrink-0">
          <Mascot size="sm" mood="cheer" />
        </span>
      </div>

      {/* 中央: 子ども向けメッセージ（このカードの主役） */}
      <p
        className="relative mt-3 text-[20px] font-extrabold leading-[1.5]"
        style={{ color: C.ink }}
      >
        {kidMessage}
      </p>

      {/* データがあるとき: 気をつけるポイントのチップ */}
      {hasAnyChip ? (
        <div className="relative mt-4 flex flex-wrap gap-2">
          {showChildChip ? (
            <StatPill
              tone="orange"
              icon={<Baby className="h-4 w-4" aria-hidden="true" />}
              label="こどもが かかわった"
              value={`${childInvolved}けん`}
            />
          ) : null}
          {showTypeChip ? (
            <StatPill
              tone="blue"
              icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
              label="おおい できごと"
              value={topAccidentType as string}
            />
          ) : null}
          {showTimeChip ? (
            <StatPill
              tone="yellow"
              icon={<Clock className="h-4 w-4" aria-hidden="true" />}
              label="きを つける じかん"
              value={peakTimeSlot as string}
            />
          ) : null}
        </div>
      ) : (
        // データがないとき: やさしいフォロー（断定しない）
        <div
          className="relative mt-4 flex items-center gap-2.5 rounded-[16px] px-4 py-3"
          style={{ backgroundColor: "#FFFFFF", boxShadow: tokens.shadow.soft }}
        >
          <Sparkles
            className="h-5 w-5 shrink-0"
            style={{ color: C.accent }}
            aria-hidden="true"
          />
          <span className="text-[16px] font-bold" style={{ color: C.ink }}>
            まわりを よく
            <ruby>
              見<rt>み</rt>
            </ruby>
            て、ゆっくり あるく れんしゅうを しよう。
          </span>
        </div>
      )}
    </motion.section>
  )
}
