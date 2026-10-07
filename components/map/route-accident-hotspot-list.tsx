"use client"

import { Car } from "lucide-react"

import { Button } from "@/components/ui/button"
import { HOTSPOT_ATTRIBUTION } from "@/lib/traffic-accident/hotspot-config"
import { hotspotBreakdown, hotspotOneLine } from "@/lib/traffic-accident/hotspot-presentation"
import type { AccidentHotspotSummary } from "@/lib/traffic-accident/hotspot-types"

interface RouteAccidentHotspotListProps {
  hotspots: AccidentHotspotSummary[]
  isLoading: boolean
  error: string | null
  onSelect?: (hotspot: AccidentHotspotSummary) => void
}

/** 通学路の近くを通る事故多発地点の一覧。ルート未選択・該当なし・読み込み中は何も出さない。 */
export function RouteAccidentHotspotList({ hotspots, isLoading, error, onSelect }: RouteAccidentHotspotListProps) {
  if (error) {
    return <p className="text-xs text-red-700" role="status">{error}</p>
  }
  if (isLoading || hotspots.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">この通学路の近くの事故多発地点（{hotspots.length}か所）</p>
        <p className="text-xs text-muted-foreground">
          通学路から50m以内にある、5年間で事故が5件以上起きた地点です。通るときは特に気をつけましょう
        </p>
      </div>

      <div className="space-y-2">
        {hotspots.map((hotspot) => {
          const breakdown = hotspotBreakdown(hotspot)
          return (
            <Button
              key={hotspot.id}
              type="button"
              variant="outline"
              className="h-auto w-full justify-start whitespace-normal rounded-xl border-orange-200 bg-orange-50 px-3 py-3 text-left hover:bg-orange-100"
              onClick={() => onSelect?.(hotspot)}
            >
              <div className="flex items-start gap-3">
                <Car className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900">{hotspotOneLine(hotspot)}</p>
                  {breakdown && <p className="text-xs leading-5 text-muted-foreground">{breakdown}</p>}
                </div>
              </div>
            </Button>
          )
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">{HOTSPOT_ATTRIBUTION}</p>
    </div>
  )
}
