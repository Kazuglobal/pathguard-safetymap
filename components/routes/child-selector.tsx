"use client"

import { cn } from "@/lib/utils"
import type { RouteChildProfile } from "@/lib/types"

interface ChildSelectorProps {
  options: RouteChildProfile[]
  selectedChildId: string
  onSelectChild: (childId: string) => void
}

export function ChildSelector({
  options,
  selectedChildId,
  onSelectChild,
}: ChildSelectorProps) {
  if (options.length <= 1) {
    return null
  }

  return (
    <div
      data-testid="child-selector"
      className="flex flex-wrap items-center gap-2 rounded-[16px] border p-3"
      style={{ borderColor: "rgba(67,57,43,.1)", background: "#F3EAD6" }}
    >
      <span className="text-sm font-bold" style={{ color: "#847661" }}>表示する子ども</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={cn(
            "chunky-press rounded-full border-2 px-3 py-1.5 text-sm font-black transition-colors",
            selectedChildId === option.id
              ? "border-[#0C7A55] bg-[#159E72] text-white shadow-[0_3px_0_#0C7A55]"
              : "border-[rgba(67,57,43,.14)] bg-white text-[#847661] shadow-[0_3px_0_rgba(67,57,43,.14)] hover:text-[#0C7A55]"
          )}
          aria-pressed={selectedChildId === option.id}
          aria-label={`${option.label}を表示`}
          onClick={() => onSelectChild(option.id)}
        >
          {option.label}
          <span className="ml-1 text-xs opacity-80">({option.routeCount})</span>
        </button>
      ))}
    </div>
  )
}
