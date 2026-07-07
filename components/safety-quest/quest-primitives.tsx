"use client"

import { ArrowLeft, CircleHelp } from "lucide-react"
import { cn } from "@/lib/utils"
import { PlayerFace } from "@/components/safety-quest/quest-characters"

export const SAFETY_QUEST_HELP_EVENT = "safety-quest-help"

export function GameHeader({
  title,
  subtitle,
  compact = false,
  onBack,
  right,
}: {
  title: string
  subtitle?: string
  compact?: boolean
  onBack?: () => void
  right?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-white/60 bg-gradient-to-b from-white/95 to-white/72 px-4 backdrop-blur",
        compact ? "h-14" : "h-[70px]",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={!onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-[#c9e5fb] bg-white text-[#0d4f92] shadow-sm"
          aria-label="戻る"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black leading-tight text-[#0b2551] sm:text-xl">{title}</h2>
          {subtitle && <p className="truncate text-xs font-bold text-[#52708f]">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(SAFETY_QUEST_HELP_EVENT))}
          className="grid h-9 w-9 place-items-center rounded-full border-2 border-[#c9e5fb] bg-white text-[#0d4f92] shadow-sm"
          aria-label="ヘルプ"
        >
          <CircleHelp className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

export function StatusPill({ icon, value, className }: { icon: React.ReactNode; value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-10 items-center gap-2 rounded-full border-2 border-[#d5e9fb] bg-white px-3 text-[#102a55] shadow-sm",
        className,
      )}
    >
      {icon}
      {value}
    </span>
  )
}

export function ProgressBar({ value, color = "#17b26a" }: { value: number; color?: string }) {
  return (
    <div className="h-3 overflow-hidden rounded-full bg-[#d7e9f7] shadow-inner">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, value)}%`, background: color }} />
    </div>
  )
}

export function BattleHp({ name, hp, value, align = "left" }: { name: string; hp: string; value: number; align?: "left" | "right" }) {
  return (
    <div className={cn("rounded-[18px] border-2 border-white bg-white/88 p-2 shadow-lg", align === "right" && "text-right")}>
      <div className={cn("mb-1 flex items-center gap-2", align === "right" && "flex-row-reverse")}>
        <PlayerFace size="sm" className={align === "right" ? "bg-[#c4b5fd]" : undefined} />
        <span className="text-sm font-black">{name}</span>
      </div>
      <ProgressBar value={value} color={align === "right" ? "#22c55e" : "#ef4444"} />
      <p className="mt-1 text-xs font-black text-[#52708f]">HP {hp}</p>
    </div>
  )
}

export function ItemChip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-[16px] border-2 border-[#0d66c4] bg-[#f8fbff] p-3">
      {icon}
      <div>
        <p className="text-xs font-black text-[#31516f]">{label}</p>
        <p className="text-sm font-black">{value}</p>
      </div>
    </div>
  )
}

export function RewardStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[24px] border-2 border-[#d8e8f7] bg-white p-4 shadow-sm">
      {icon}
      <div>
        <p className="text-xs font-black text-[#52708f]">{label}</p>
        <p className="text-3xl font-black text-[#f97316]">{value}</p>
      </div>
    </div>
  )
}

export function MissionLine({ label, value, progress }: { label: string; value: number; progress: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-sm font-black">
        <span>{label}</span>
        <span>{progress}</span>
      </div>
      <ProgressBar value={value} color="#14b8a6" />
    </div>
  )
}
