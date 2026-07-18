"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

import { ReportModerationQueue } from "@/components/admin/report-moderation-queue"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import type { AdminModerationReport } from "@/lib/admin-report-moderation-queue"

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminModerationReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const fetchReports = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const response = await fetch("/api/admin/reports")
      if (!response.ok) throw new Error("レポートの取得に失敗しました")
      const data = await response.json()
      setReports(data.reports ?? [])
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "取得に失敗しました"
      setLoadError(message)
      toast({ title: "エラー", description: message, variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleStatusChange = useCallback(
    async (reportId: string, newStatus: string) => {
      setUpdatingIds((current) => new Set(current).add(reportId))
      try {
        const response = await fetch("/api/admin/reports", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId, newStatus }),
        })
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error ?? "更新に失敗しました")
        }
        setReports((current) =>
          current.map((report) =>
            report.id === reportId
              ? { ...report, status: newStatus }
              : report,
          ),
        )
        toast({ title: "ステータスを更新しました", duration: 2000 })
      } catch (error) {
        toast({
          title: "エラー",
          description:
            error instanceof Error ? error.message : "更新に失敗しました",
          variant: "destructive",
        })
      } finally {
        setUpdatingIds((current) => {
          const next = new Set(current)
          next.delete(reportId)
          return next
        })
      }
    },
    [toast],
  )

  return (
    <main className="container mx-auto max-w-6xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle
              className="h-6 w-6 text-orange-500"
              aria-hidden="true"
            />
            <h1 className="text-2xl font-bold">ヒヤリハット報告管理</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            AI一次審査の例外を優先順に確認し、必要に応じて公開状態を変更します。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchReports}
          disabled={isLoading}
        >
          <RefreshCw
            className={`mr-1.5 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          更新
        </Button>
      </header>

      {isLoading ? (
        <div
          className="space-y-3"
          aria-busy="true"
          aria-label="レポートを読み込んでいます"
        >
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-36 w-full" />
          ))}
        </div>
      ) : loadError ? (
        <div
          role="alert"
          className="border border-red-200 bg-red-50 p-6 text-center"
        >
          <p className="text-sm text-red-800">{loadError}</p>
          <Button className="mt-3" variant="outline" onClick={fetchReports}>
            再読み込み
          </Button>
        </div>
      ) : (
        <ReportModerationQueue
          reports={reports}
          updatingIds={updatingIds}
          onStatusChange={handleStatusChange}
        />
      )}
    </main>
  )
}
