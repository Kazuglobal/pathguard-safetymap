"use client"

import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { RouteSafetySummary } from "@/lib/safety-scoring/route-safety-scorer"

interface RouteSafetySummaryCardProps {
  summary: RouteSafetySummary
  compact?: boolean
}

const statusStyles: Record<
  RouteSafetySummary["status"],
  {
    container: string
    badge: string
    icon: typeof ShieldAlert
  }
> = {
  loading: {
    container: "border-sky-200 bg-white/95 text-slate-900",
    badge: "bg-sky-50 text-sky-900 border-sky-200",
    icon: Loader2,
  },
  safe: {
    container: "border-emerald-200 bg-emerald-50/95 text-emerald-950",
    badge: "bg-white text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  caution: {
    container: "border-amber-200 bg-amber-50/95 text-amber-950",
    badge: "bg-white text-amber-800 border-amber-200",
    icon: AlertTriangle,
  },
  danger: {
    container: "border-rose-200 bg-rose-50/95 text-rose-950",
    badge: "bg-white text-rose-700 border-rose-200",
    icon: ShieldAlert,
  },
}

export function RouteSafetySummaryCard({
  summary,
  compact = false,
}: RouteSafetySummaryCardProps) {
  const style = statusStyles[summary.status]
  const Icon = style.icon

  return (
    <div
      data-testid="route-safety-summary-card"
      className={`rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-sm ${style.container}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Icon
              className={`h-4 w-4 ${
                summary.status === "loading" ? "animate-spin text-sky-700" : ""
              }`}
            />
            <p className="text-sm font-semibold">{summary.headline}</p>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{summary.detail}</p>
        </div>
        <Badge variant="outline" className={style.badge}>
          {summary.label}
        </Badge>
      </div>

      {!compact && summary.reasons.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {summary.reasons.map((reason) => (
            <Badge key={reason} variant="outline" className="bg-white/70">
              {reason}
            </Badge>
          ))}
        </div>
      )}

      {compact && summary.reasons.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">{summary.reasons[0]}</p>
      )}
    </div>
  )
}
