"use client"

import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { RouteHazardMarker } from "@/lib/types"

interface RouteHazardListProps {
  hazards: RouteHazardMarker[]
  onSelectHazard?: (hazard: RouteHazardMarker) => void
}

export function RouteHazardList({
  hazards,
  onSelectHazard,
}: RouteHazardListProps) {
  if (hazards.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">危険箇所一覧</p>
        <p className="text-xs text-muted-foreground">
          地図が苦手でも、通学路上の注意箇所を一覧で確認できます
        </p>
      </div>

      <div className="space-y-2">
        {hazards.map((hazard) => (
          <Button
            key={hazard.id}
            type="button"
            variant="outline"
            className="h-auto w-full justify-start rounded-xl border-slate-200 bg-slate-50 px-3 py-3 text-left hover:bg-slate-100"
            onClick={() => onSelectHazard?.(hazard)}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">{hazard.title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{hazard.summary}</p>
              </div>
            </div>
          </Button>
        ))}
      </div>
    </div>
  )
}
