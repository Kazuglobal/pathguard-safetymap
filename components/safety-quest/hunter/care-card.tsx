"use client"

import { motion, useReducedMotion, type Transition } from "framer-motion"
import { Baby, Clock, ShieldAlert, Sparkles } from "lucide-react"

import type { HunterAccidentSummary } from "@/lib/hunter/types"
import { childRiskHint, kidAccidentLabel } from "@/lib/hunter/accident-context"

import { RubyText } from "./ruby-text"
import { Mascot, StatPill, tokens } from "./theme"

// きけんハンター「気をつけるカード」
// 子ども向け面は非断定・行動志向(childRiskHint)。件数や「非常に危険」等の
// 生情報・「AIは見逃すことがある」但し書きは保護者向け折りたたみへ分離する。

const C = tokens.color

const SPRING: Transition = { type: "spring", stiffness: 260, damping: 18 }

export function CareCard({ accident }: { accident: HunterAccidentSummary }) {
  const reduce = useReducedMotion()

  const {
    hasData,
    riskScore,
    riskLabel,
    childInvolved,
    topAccidentType,
    peakTimeSlot,
  } = accident

  const showChildChip = hasData && childInvolved > 0
  const showTypeChip = hasData && topAccidentType !== null
  const showTimeChip = hasData && peakTimeSlot !== null

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

      {/* 上部: 子ども向けの やわらかいバッジ ＋ 見守るハンタくん */}
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
            👀
          </span>
          <span className="text-[15px] font-extrabold tracking-wide">きをつけよう</span>
        </div>

        <span className="-mt-1 -mr-1 shrink-0">
          <Mascot size="sm" mood="cheer" />
        </span>
      </div>

      {/* 中央: 子ども向けメッセージ(非断定・行動志向) */}
      <p
        className="relative mt-3 text-[20px] font-extrabold leading-[1.5]"
        style={{ color: C.ink }}
      >
        <RubyText text={hasData ? childRiskHint(riskScore) : accident.kidMessage} />
      </p>

      {!hasData ? (
        <div
          className="relative mt-4 flex items-center gap-2.5 rounded-[16px] px-4 py-3"
          style={{ backgroundColor: "#FFFFFF", boxShadow: tokens.shadow.soft }}
        >
          <Sparkles className="h-5 w-5 shrink-0" style={{ color: C.accent }} aria-hidden="true" />
          <span className="text-[16px] font-bold" style={{ color: C.ink }}>
            まわりを よく
            <ruby>
              見<rt>み</rt>
            </ruby>
            て、ゆっくり あるく れんしゅうを しよう。
          </span>
        </div>
      ) : null}

      {/* 保護者向け: くわしい情報(件数・リスク・AIの限界)を折りたたみに分離 */}
      {hasData ? (
        <details className="relative mt-4 rounded-[16px] bg-white px-4 py-3" style={{ boxShadow: tokens.shadow.soft }}>
          <summary
            className="cursor-pointer list-none text-[13px] font-extrabold"
            style={{ color: C.inkSoft }}
          >
            おうちの人むけ（くわしく）
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatPill tone="orange" label="この地点のめやす" value={riskLabel} />
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
                value={<RubyText text={kidAccidentLabel(topAccidentType)} />}
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
          <p className="mt-3 text-[12px] font-bold leading-relaxed" style={{ color: C.inkSoft }}>
            ※ AIは あぶないところを 見のがすことが あります。表示が なくても 安全とは
            かぎりません。おうちの人と いっしょに たしかめてください。
          </p>
        </details>
      ) : null}
    </motion.section>
  )
}
