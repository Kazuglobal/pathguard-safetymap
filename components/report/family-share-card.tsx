"use client"

import { forwardRef } from "react"
import { MapPin, MessageSquareShare, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export interface FamilyShareCardProps {
  title: string
  summary: string
  action?: string | null
  mapLabel: string
  imageUrl?: string | null
  className?: string
}

export const FamilyShareCard = forwardRef<HTMLDivElement, FamilyShareCardProps>(
  function FamilyShareCard(
    { title, summary, action = null, mapLabel, imageUrl = null, className },
    ref,
  ) {
    return (
      <Card
        ref={ref}
        data-testid="family-share-card"
        className={[
          "overflow-hidden border-emerald-200 bg-white shadow-sm",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="bg-gradient-to-r from-emerald-500 via-sky-500 to-blue-500 px-4 py-3 text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                  Family Share
                </p>
                <h3 className="break-words text-base font-bold leading-tight">{title}</h3>
              </div>
            </div>
            <Badge className="shrink-0 border-white/20 bg-white/15 text-white hover:bg-white/15">
              家族向け
            </Badge>
          </div>
        </div>

        <CardContent className="space-y-4 p-4">
          {imageUrl ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                <MapPin className="h-3.5 w-3.5" />
                {mapLabel}
              </div>
              <div className="relative aspect-[16/9] w-full bg-slate-200">
                <img
                  src={imageUrl}
                  alt={`${title}の共有カード画像`}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="flex items-center gap-2 font-medium text-slate-700">
                <MapPin className="h-4 w-4 text-sky-600" />
                {mapLabel}
              </div>
              <p className="mt-2 leading-6">家族で地図を見ながら危険地点を確認してください。</p>
            </div>
          )}

          <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquareShare className="h-4 w-4 text-amber-500" />
              危険の要点
            </div>
            <p className="text-sm leading-6 text-slate-700">{summary}</p>
          </div>

          {action ? (
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
              <p className="text-sm font-semibold text-slate-900">次に家族で確認したいこと</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{action}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    )
  },
)

export default FamilyShareCard
