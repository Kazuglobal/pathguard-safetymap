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
      className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
    >
      <span className="text-sm font-medium text-slate-700">表示する子ども</span>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm transition-colors",
            selectedChildId === option.id
              ? "border-sky-600 bg-sky-600 text-white"
              : "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-sky-700"
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
