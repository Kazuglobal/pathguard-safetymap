"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import { AlertTriangle, MapPin, User } from "lucide-react"

type ReportStatus = "pending" | "approved" | "published" | "resolved" | "rejected"

interface AdminReport {
  id: string
  title: string | null
  description: string | null
  danger_type: string | null
  danger_level: number | null
  status: string
  latitude: number | null
  longitude: number | null
  created_at: string
  profiles: { display_name: string | null } | null
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "審査中",
  approved: "承認済",
  published: "公開中",
  resolved: "解決済",
  rejected: "却下",
}

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  published: "bg-green-100 text-green-800",
  resolved: "bg-gray-100 text-gray-800",
  rejected: "bg-red-100 text-red-800",
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const { toast } = useToast()

  const fetchReports = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/admin/reports")
      if (!res.ok) throw new Error("レポートの取得に失敗しました")
      const data = await res.json()
      setReports(data.reports ?? [])
    } catch (err) {
      toast({
        title: "エラー",
        description: err instanceof Error ? err.message : "取得に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleStatusChange = useCallback(
    async (reportId: string, newStatus: string) => {
      setUpdatingIds((prev) => {
        const next = new Set(prev)
        next.add(reportId)
        return next
      })
      try {
        const res = await fetch("/api/admin/reports", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId, newStatus }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? "更新に失敗しました")
        }
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
        )
        toast({ title: "ステータスを更新しました", duration: 2000 })
      } catch (err) {
        toast({
          title: "エラー",
          description: err instanceof Error ? err.message : "更新に失敗しました",
          variant: "destructive",
        })
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev)
          next.delete(reportId)
          return next
        })
      }
    },
    [toast]
  )

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold">ヒヤリハット報告管理</h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchReports}>
          更新
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <p className="text-center text-gray-500 py-12">レポートがありません</p>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const status = report.status as ReportStatus
            const statusLabel = STATUS_LABELS[status] ?? report.status
            const statusColor = STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800"

            return (
              <div
                key={report.id}
                className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}
                      >
                        {statusLabel}
                      </span>
                      {report.danger_level && (
                        <span className="text-xs text-gray-500">
                          危険度 {report.danger_level}
                        </span>
                      )}
                    </div>

                    <p className="font-medium text-gray-900 truncate">
                      {report.title ?? "（タイトルなし）"}
                    </p>

                    {report.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {report.description}
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {report.profiles?.display_name ?? "匿名"}
                      </span>
                      {report.latitude != null && report.longitude != null && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                        </span>
                      )}
                      <span>
                        {new Date(report.created_at).toLocaleDateString("ja-JP")}
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <Select
                      value={report.status}
                      onValueChange={(val) => handleStatusChange(report.id, val)}
                      disabled={updatingIds.has(report.id)}
                    >
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">審査中</SelectItem>
                        <SelectItem value="approved">承認済</SelectItem>
                        <SelectItem value="published">公開中</SelectItem>
                        <SelectItem value="resolved">解決済</SelectItem>
                        <SelectItem value="rejected">却下</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
