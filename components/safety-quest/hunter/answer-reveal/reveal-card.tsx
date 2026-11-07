"use client"

// =============================================
// こたえあわせ: 1 つの危険のカード(写真のスポットライトと連動)
//  まえ/つぎ ボタン(48px)と、横スワイプでめくる。番号は写真のマーカーと同じ。
// =============================================

import { useRef, type ReactNode } from "react"
import { ChevronLeft, ChevronRight, HelpCircle, Lightbulb, ShieldCheck } from "lucide-react"

import type { RevealItem } from "@/lib/hunter/reveal"
import type { HunterAccidentSummary } from "@/lib/hunter/types"

import { RubyText } from "../ruby-text"
import { PaperPanel, tokens } from "../theme"
import { ParentDetail } from "./parent-notes"
import { STATUS_STYLE } from "./reveal-status"

const C = tokens.color
/** これ以上 横に動かしたら めくる(px)。 */
const SWIPE_PX = 56

function statusLine(item: RevealItem): string {
  if (item.status === "understood") return "ばしょも りゆうも わかったね！"
  if (item.status === "found") return "ばしょは みつけたね！ りゆうも おぼえよう。"
  return "ここも きを つけたい ところだよ。つぎは みつけてみよう。"
}

export function RevealCard({
  item,
  index,
  total,
  onPrev,
  onNext,
  parentMode,
  accident,
}: {
  item: RevealItem
  index: number
  total: number
  onPrev: () => void
  onNext: () => void
  parentMode: boolean
  accident: HunterAccidentSummary | null
}) {
  const startX = useRef<number | null>(null)
  const style = STATUS_STYLE[item.status]

  return (
    <div
      onPointerDown={(e) => {
        startX.current = e.clientX
      }}
      onPointerUp={(e) => {
        const from = startX.current
        startX.current = null
        if (from === null) return
        const dx = e.clientX - from
        if (dx <= -SWIPE_PX && index < total - 1) onNext()
        else if (dx >= SWIPE_PX && index > 0) onPrev()
      }}
      style={{ touchAction: "pan-y" }}
    >
      <PaperPanel className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[16px] font-black"
            style={{ background: style.bg, color: style.fg, border: `2.5px solid ${item.status === "missed" ? C.sunDeep : "#fff"}`, boxShadow: tokens.shadow.soft }}
          >
            {item.number}
          </span>
          <h3 className="min-w-0 flex-1 text-[16.5px] font-black leading-snug" style={{ color: C.ink }}>
            <RubyText text={item.hazard.type} />
          </h3>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-black"
            style={{ background: style.bg, color: style.fg, border: item.status === "missed" ? `2px solid ${C.sunDeep}` : undefined }}
          >
            {style.label}
          </span>
        </div>

        <p className="mt-1.5 text-[13px] font-bold" style={{ color: C.inkSoft }}>
          {statusLine(item)}
        </p>

        {item.reason ? (
          <Row icon={<HelpCircle className="h-4 w-4" aria-hidden="true" style={{ color: C.accent }} />} title="どうして あぶない？">
            <RubyText text={item.reason} />
          </Row>
        ) : null}
        <Row icon={<Lightbulb className="h-4 w-4" aria-hidden="true" style={{ color: C.sunDeep }} />} title="この しゃしんでは">
          <RubyText text={item.hazard.kidExplanation} />
        </Row>
        <Row icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" style={{ color: C.primary }} />} title="つぎに すること">
          <RubyText text={item.hazard.safeAction} />
        </Row>

        {parentMode ? <ParentDetail item={item} accident={accident} /> : null}

        <div className="mt-3.5 flex items-center justify-between gap-2">
          <NavButton label="まえの きけん" disabled={index <= 0} onClick={onPrev}>
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            まえ
          </NavButton>
          <span className="text-[13px] font-black tabular-nums" style={{ color: C.inkSoft }} aria-live="polite">
            {index + 1} / {total}
          </span>
          <NavButton label="つぎの きけん" disabled={index >= total - 1} onClick={onNext}>
            つぎ
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </NavButton>
        </div>
      </PaperPanel>
    </div>
  )
}

function Row({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="mt-2.5">
      <p className="flex items-center gap-1.5 text-[12.5px] font-black" style={{ color: C.inkSoft }}>
        {icon}
        {title}
      </p>
      <p className="mt-0.5 text-[14.5px] font-bold leading-relaxed" style={{ color: C.ink }}>
        {children}
      </p>
    </div>
  )
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[48px] min-w-[88px] touch-manipulation items-center justify-center gap-1 rounded-full border-2 bg-white px-4 text-[14px] font-black ${tokens.cls.focus}`}
      style={{
        borderColor: "rgba(67,57,43,.16)",
        color: disabled ? "#8F8672" : C.ink,
        background: disabled ? "#EDE5D3" : "#FFFFFF",
        boxShadow: disabled ? "none" : tokens.shadow.pressPaper,
      }}
    >
      {children}
    </button>
  )
}
