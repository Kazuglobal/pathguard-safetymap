"use client"

import NextImage from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Camera, Footprints, Sparkles, TriangleAlert } from "lucide-react"

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
    <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                投稿前プレビュー
              </p>
              <CardTitle className="text-base text-slate-900">子ども目線シミュレーション</CardTitle>
            </div>
          </div>
          <Badge variant="secondary" className="bg-white/80 text-emerald-700">
            家族向け
          </Badge>
        </div>
      </CardHeader>
      <CardContent className={contentPadding}>
        {imageUrl ? (
          <div className="overflow-hidden rounded-xl border border-emerald-100 bg-white">
            <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs font-medium text-emerald-800">
              <Camera className="h-3.5 w-3.5" />
              子ども目線シミュレーション
            </div>
            <div className="relative aspect-[16/9] w-full bg-slate-100">
              <NextImage
                src={imageUrl}
                alt="子ども目線シミュレーション"
                fill
                className="object-cover"
              />
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-amber-100 bg-white/90 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <TriangleAlert className="h-4 w-4 text-amber-500" />
            危険要約
          </div>
          <p className="text-sm leading-6 text-slate-700">{summary}</p>
        </div>

        {action ? (
          <div className="rounded-xl border border-sky-100 bg-white/90 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Footprints className="h-4 w-4 text-sky-500" />
              回避行動
            </div>
            <p className="text-sm leading-6 text-slate-700">{action}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default SimulationQuickSummary
