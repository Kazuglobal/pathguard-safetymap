"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, Footprints, ClipboardList, TriangleAlert } from "lucide-react"

interface SimulationQuickSummaryProps {
  summary: string
  action?: string | null
  imageUrl?: string | null
  compact?: boolean
}

export function SimulationQuickSummary({
  summary,
  action,
  imageUrl = null,
  compact = false,
}: SimulationQuickSummaryProps) {
  const contentPadding = compact ? "space-y-3" : "space-y-4"

  return (
    <Card className="border-slate-200 bg-white">
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-slate-100">
            <ClipboardList className="h-4 w-4 text-slate-600" />
          </div>
          <CardTitle className="text-base text-slate-900">シミュレーション要約</CardTitle>
        </div>
      </CardHeader>
      <CardContent className={contentPadding}>
        {imageUrl ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
              <Camera className="h-3.5 w-3.5" />
              参考シミュレーション画像
            </div>
            <div className="relative aspect-[16/9] w-full bg-slate-100">
              <img
                src={imageUrl}
                alt="参考シミュレーション画像"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
            </div>
          </div>
        ) : null}

        <div className="border-t border-slate-100 pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <TriangleAlert className="h-3.5 w-3.5 text-amber-500" />
            危険要約
          </p>
          <p className="text-sm leading-6 text-slate-700">{summary}</p>
        </div>

        {action ? (
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <Footprints className="h-3.5 w-3.5 text-slate-400" />
              回避行動
            </p>
            <p className="text-sm leading-6 text-slate-700">{action}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default SimulationQuickSummary
