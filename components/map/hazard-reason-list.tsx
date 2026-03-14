"use client"

import { Clock3, FileText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { RouteSafetyEvidenceItem } from "@/lib/safety-scoring/route-safety-scorer"

interface HazardReasonListProps {
  items: RouteSafetyEvidenceItem[]
}

export function HazardReasonList({ items }: HazardReasonListProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">判定の根拠</p>
        <p className="text-xs text-muted-foreground">
          どの情報をもとに注意判定しているかを確認できます
        </p>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border border-slate-200 bg-slate-50/90 px-3 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-900">{item.title}</p>
                <p className="text-xs leading-5 text-muted-foreground">{item.reason}</p>
              </div>
              <Badge variant="outline" className="bg-white">
                {item.kind === "hazard" ? "ハザード" : "危険報告"}
              </Badge>
            </div>
            <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3" />
                <span>{`情報源: ${item.source}`}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-3 w-3" />
                <span>{`更新: ${item.updatedLabel}`}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
