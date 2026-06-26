"use client"

import type { JSX } from "react"
import { Baby, Clock, ShieldAlert, Sparkles } from "lucide-react"

import type { HunterAccidentSummary } from "@/lib/hunter/types"

// きけんハンター「気をつけるカード」
// 子ども向け・やさしい・断定しないトーンで、地点の事故サマリを表示する。
// 配色パレット: 青 #0d66c4 / オレンジ #f97316 / 黄 #ffcf35 / 紺 #0b2551

const PALETTE = {
  blue: "#0d66c4",
  orange: "#f97316",
  yellow: "#ffcf35",
  navy: "#0b2551",
} as const

interface CareChipProps {
  readonly icon: JSX.Element
  readonly label: string
  readonly value: string
  readonly accent: string
}

function CareChip({ icon, label, value, accent }: CareChipProps): JSX.Element {
  return (
    <div
      className="flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-sm ring-1 ring-black/5"
      style={{ color: PALETTE.navy }}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: accent }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-[11px] font-bold opacity-70">{label}</span>
        <span className="text-sm font-black">{value}</span>
      </span>
    </div>
  )
}

export function CareCard({ accident }: { accident: HunterAccidentSummary }): JSX.Element {
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
    <section
      className="relative overflow-hidden rounded-[20px] bg-white/95 p-5 shadow-lg ring-1 ring-black/5 backdrop-blur"
      aria-label="気をつけるカード"
    >
      {/* 上部: 危険レベルのバッジ */}
      <div
        className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-white shadow-sm"
        style={{ backgroundColor: PALETTE.blue }}
      >
        <span className="text-lg leading-none" aria-hidden="true">
          {riskEmoji}
        </span>
        <span className="text-sm font-black tracking-wide">{riskLabel}</span>
      </div>

      {/* 中央: 子ども向けメッセージ */}
      <p
        className="mt-4 text-xl font-black leading-snug"
        style={{ color: PALETTE.navy }}
      >
        {kidMessage}
      </p>

      {/* データがあるとき: 気をつけるポイントのチップ */}
      {hasAnyChip ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {showChildChip ? (
            <CareChip
              icon={<Baby className="h-4 w-4" aria-hidden="true" />}
              label="こどもがかかわった"
              value={`${childInvolved}けん`}
              accent={PALETTE.orange}
            />
          ) : null}
          {showTypeChip ? (
            <CareChip
              icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
              label="おおいできごと"
              value={topAccidentType as string}
              accent={PALETTE.blue}
            />
          ) : null}
          {showTimeChip ? (
            <CareChip
              icon={<Clock className="h-4 w-4" aria-hidden="true" />}
              label="きをつけるじかん"
              value={peakTimeSlot as string}
              accent={PALETTE.navy}
            />
          ) : null}
        </div>
      ) : (
        // データがないとき: やさしいフォロー
        <div
          className="mt-4 flex items-center gap-2 rounded-2xl px-4 py-3"
          style={{ backgroundColor: `${PALETTE.yellow}33`, color: PALETTE.navy }}
        >
          <Sparkles
            className="h-5 w-5 shrink-0"
            style={{ color: PALETTE.orange }}
            aria-hidden="true"
          />
          <span className="text-sm font-bold">
            まわりをよく見て、ゆっくりあるこうね。
          </span>
        </div>
      )}
    </section>
  )
}
