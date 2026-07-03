"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Baby, Clock, ShieldAlert } from "lucide-react"

import type { HunterAccidentSummary } from "@/lib/hunter/types"
import { childRiskHint, kidAccidentLabel } from "@/lib/hunter/accident-context"

import { RubyText } from "./ruby-text"
import { PaperPanel, StatPill, tokens } from "./theme"

// きけんハンター「気をつけるカード」
// 子ども向け面は非断定・行動志向(childRiskHint)。件数や「非常に危険」等の
// 生情報・「AIは見逃すことがある」但し書きは保護者向け折りたたみへ分離する。

const C = tokens.color

export function CareCard({
  accident,
  compact = false,
}: {
  accident: HunterAccidentSummary
  /** true: 探索画面用のコンパクト表示(写真の邪魔をしない1〜2行) */
  compact?: boolean
}) {
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

  const kidMessage = hasData ? childRiskHint(riskScore) : accident.kidMessage

  return (
    <motion.section
      aria-label="気をつけるカード"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0.2 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <PaperPanel tone="accent" className={compact ? "px-4 py-3" : "px-4 py-4"}>
        {/* 子ども向けメッセージ(非断定・行動志向) */}
        <p
          className={`flex items-start gap-2.5 font-black leading-relaxed ${
            compact ? "text-[13.5px]" : "text-[15.5px]"
          }`}
          style={{ color: C.ink }}
        >
          <span
            aria-hidden="true"
            className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[15px]"
            style={{ background: C.accent, color: "#fff" }}
          >
            👀
          </span>
          <RubyText text={kidMessage} />
        </p>

        {/* 保護者向け: くわしい情報を折りたたみに分離 */}
        {hasData ? (
          <details
            className="mt-3 rounded-[14px] bg-white/80 px-3.5 py-2.5"
            style={{ boxShadow: tokens.shadow.soft }}
          >
            <summary
              className={`cursor-pointer list-none text-[12px] font-black ${tokens.cls.focus}`}
              style={{ color: C.inkSoft }}
            >
              おうちの人むけ（くわしく）▸
            </summary>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <StatPill tone="orange" label="この地点のめやす" value={riskLabel} />
              {showChildChip ? (
                <StatPill
                  tone="orange"
                  icon={<Baby className="h-3.5 w-3.5" aria-hidden="true" />}
                  label="こどもが かかわった"
                  value={`${childInvolved}けん`}
                />
              ) : null}
              {showTypeChip ? (
                <StatPill
                  tone="green"
                  icon={<ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />}
                  label="おおい できごと"
                  value={<RubyText text={kidAccidentLabel(topAccidentType)} />}
                />
              ) : null}
              {showTimeChip ? (
                <StatPill
                  tone="sun"
                  icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}
                  label="きを つける じかん"
                  value={peakTimeSlot as string}
                />
              ) : null}
            </div>
            <p className="mt-2.5 text-[11.5px] font-bold leading-relaxed" style={{ color: C.inkSoft }}>
              ※ AIは あぶないところを 見のがすことが あります。表示が なくても 安全とは
              かぎりません。おうちの人と いっしょに たしかめてください。
            </p>
          </details>
        ) : null}
      </PaperPanel>
    </motion.section>
  )
}
