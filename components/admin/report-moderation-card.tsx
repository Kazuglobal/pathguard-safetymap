"use client"

import { useState } from "react"
import {
  AlertOctagon,
  Bot,
  CheckCircle2,
  Clock3,
  MapPin,
  User,
} from "lucide-react"

import { useMaskedPhotoPicker } from "@/components/media/use-masked-photo-picker"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type AdminModerationReport,
  type AiModerationStatus,
} from "@/lib/admin-report-moderation-queue"
import { cn, formatDate } from "@/lib/utils"

type ReportStatus =
  | "pending"
  | "approved"
  | "published"
  | "resolved"
  | "rejected"

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "審査中",
  approved: "承認済",
  published: "公開中",
  resolved: "解決済",
  rejected: "却下",
}

const STATUS_STYLES: Record<ReportStatus, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-blue-50 text-blue-800 ring-blue-200",
  published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  resolved: "bg-slate-100 text-slate-700 ring-slate-200",
  rejected: "bg-red-50 text-red-800 ring-red-200",
}

const AI_PRESENTATION: Record<
  Exclude<AiModerationStatus, null>,
  { label: string; className: string; icon: typeof Bot }
> = {
  pending: {
    label: "AI審査待ち",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    icon: Clock3,
  },
  approved: {
    label: "AI承認",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    icon: CheckCircle2,
  },
  needs_review: {
    label: "要確認",
    className: "bg-amber-50 text-amber-900 ring-amber-200",
    icon: Bot,
  },
  escalated: {
    label: "エスカレーション",
    className: "bg-red-50 text-red-900 ring-red-200",
    icon: AlertOctagon,
  },
}

export function ReportModerationCard(props: {
  report: AdminModerationReport
  updating: boolean
  onStatusChange: (reportId: string, status: string) => void
  /** 写真をぼかし直して置き換えたあと(一覧を読み直す) */
  onRemasked?: (reportId: string) => void
}) {
  const { report, updating, onStatusChange, onRemasked } = props
  const { requestMaskedPhoto, photoMaskerDialog } = useMaskedPhotoPicker()
  const [remasking, setRemasking] = useState(false)
  const [remaskError, setRemaskError] = useState<string | null>(null)

  // 既存の(ぼかしていない)写真を、管理者の端末でぼかして置き換える(UIUX改装 項目57)
  const remask = async () => {
    if (!report.image_url) return
    setRemaskError(null)
    try {
      const original = await fetch(report.image_url, { credentials: "same-origin" })
      if (!original.ok) throw new Error(`original ${original.status}`)
      const blob = await original.blob()
      const masked = await requestMaskedPhoto(new File([blob], "original", { type: blob.type || "image/webp" }))
      if (!masked) return
      setRemasking(true)
      const form = new FormData()
      form.set("file", masked.file)
      form.set("reportId", report.id)
      form.set("masked", "1")
      const response = await fetch("/api/admin/reports/remask", { method: "POST", body: form, credentials: "same-origin" })
      if (!response.ok) throw new Error(`remask ${response.status}`)
      onRemasked?.(report.id)
    } catch {
      setRemaskError("写真を置き換えられませんでした。時間をおいてもう一度お試しください。")
    } finally {
      setRemasking(false)
    }
  }
  const status = report.status as ReportStatus
  const ai = report.ai_moderation_status
    ? AI_PRESENTATION[report.ai_moderation_status]
    : null
  const AiIcon = ai?.icon ?? Bot

  return (
    <article
      data-testid="admin-report-card"
      className={cn(
        "border bg-background p-4",
        report.ai_moderation_status === "escalated"
          ? "border-red-300"
          : "border-border",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                STATUS_STYLES[status] ??
                  "bg-slate-100 text-slate-700 ring-slate-200",
              )}
            >
              {STATUS_LABELS[status] ?? report.status}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                ai?.className ??
                  "bg-slate-100 text-slate-700 ring-slate-200",
              )}
            >
              <AiIcon className="h-3 w-3" aria-hidden="true" />
              {ai?.label ?? "未審査"}
            </span>
            {report.danger_level != null && (
              <span className="text-xs text-muted-foreground">
                危険度 {report.danger_level}
              </span>
            )}
          </div>

          <h2 className="truncate text-sm font-semibold text-foreground">
            {report.title ?? "（タイトルなし）"}
          </h2>
          {report.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {report.description}
            </p>
          )}

          {report.image_url && (
            <div className="mt-3 flex flex-wrap items-start gap-3" data-testid="admin-report-photo">
              {/* 管理者だけに見える写真。ぼかしていない写真もここでは表示する */}
              <img src={report.image_url} alt="報告の写真(管理者だけに表示)" loading="lazy" decoding="async" className="h-24 w-32 rounded object-cover" />
              {report.image_masked === false && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-amber-800">ぼかし待ち(ほかの人には写真を出していません)</p>
                  <button
                    type="button"
                    onClick={() => { void remask() }}
                    disabled={remasking}
                    className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
                  >
                    {remasking ? "置き換え中…" : "ぼかして公開する"}
                  </button>
                  {remaskError && <p role="alert" className="text-xs text-red-700">{remaskError}</p>}
                </div>
              )}
            </div>
          )}

          {report.ai_moderation_reason && (
            <div className="mt-3 border-l-2 border-border pl-3">
              <p className="text-xs font-medium text-foreground">AI判定理由</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {report.ai_moderation_reason}
              </p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {report.ai_moderation_score != null && (
                  <span>
                    AIスコア {Math.round(report.ai_moderation_score * 100)}%
                  </span>
                )}
                {report.ai_moderation_checked_at && (
                  <span>
                    審査日時 {formatDate(report.ai_moderation_checked_at)}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" aria-hidden="true" />
              {report.profiles?.display_name ?? "匿名"}
            </span>
            {report.latitude != null && report.longitude != null && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
              </span>
            )}
            <span>投稿日 {formatDate(report.created_at)}</span>
          </div>
        </div>

        <Select
          value={report.status}
          onValueChange={(value) => onStatusChange(report.id, value)}
          disabled={updating}
        >
          <SelectTrigger
            className="h-9 w-full text-xs sm:w-32"
            aria-label={`${report.title ?? "報告"}の公開ステータス`}
          >
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
      {photoMaskerDialog}
    </article>
  )
}
