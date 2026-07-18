"use client"

import { useMemo, useState } from "react"
import { Shuffle } from "lucide-react"

import { ReportModerationCard } from "@/components/admin/report-moderation-card"
import { Button } from "@/components/ui/button"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  countModerationQueues,
  filterModerationQueue,
  sampleApprovedReports,
  type AdminModerationReport,
  type ModerationQueue,
} from "@/lib/admin-report-moderation-queue"

const TAB_DETAILS: Array<{
  value: ModerationQueue
  label: string
  empty: string
}> = [
  {
    value: "escalated",
    label: "エスカレーション",
    empty: "エスカレーションされた報告はありません",
  },
  {
    value: "needs_review",
    label: "要確認",
    empty: "確認待ちの報告はありません",
  },
  {
    value: "approved",
    label: "AI承認済み",
    empty: "AIが承認した報告はありません",
  },
  { value: "all", label: "すべて", empty: "レポートがありません" },
]

export function ReportModerationQueue(props: {
  reports: AdminModerationReport[]
  updatingIds: Set<string>
  onStatusChange: (reportId: string, status: string) => void
}) {
  const { reports, updatingIds, onStatusChange } = props
  const [activeQueue, setActiveQueue] =
    useState<ModerationQueue>("escalated")
  const [auditSample, setAuditSample] =
    useState<AdminModerationReport[] | null>(null)
  const counts = useMemo(() => countModerationQueues(reports), [reports])

  const visibleReports = useMemo(() => {
    if (activeQueue === "approved" && auditSample) return auditSample
    return filterModerationQueue(reports, activeQueue)
  }, [activeQueue, auditSample, reports])

  return (
    <Tabs
      value={activeQueue}
      onValueChange={(value) => setActiveQueue(value as ModerationQueue)}
    >
      <div className="overflow-x-auto pb-1">
        <TabsList className="h-auto min-w-max justify-start">
          {TAB_DETAILS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
              {tab.label}
              <span
                className="min-w-5 rounded-full bg-muted px-1.5 text-center text-xs tabular-nums text-foreground"
                aria-label={`${counts[tab.value]}件`}
              >
                {counts[tab.value]}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {TAB_DETAILS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.value === "approved" && counts.approved > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAuditSample(sampleApprovedReports(reports))}
              >
                <Shuffle className="mr-1.5 h-4 w-4" aria-hidden="true" />
                ランダム10件を表示
              </Button>
              {auditSample && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAuditSample(null)}
                >
                  全件表示に戻す
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                週次のスポットチェック用です。
              </p>
            </div>
          )}

          {visibleReports.length === 0 ? (
            <div
              role="status"
              className="border border-dashed border-border py-12 text-center text-sm text-muted-foreground"
            >
              {tab.empty}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleReports.map((report) => (
                <ReportModerationCard
                  key={report.id}
                  report={report}
                  updating={updatingIds.has(report.id)}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}
