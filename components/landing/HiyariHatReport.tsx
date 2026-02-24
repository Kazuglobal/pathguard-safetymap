"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ThumbsUp, AlertCircle, ChevronRight, MessageCircle, MapPin, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createBrowserClient } from "@supabase/ssr"
import type { DangerReport } from "@/lib/types"
import DangerReportDetailModal from "@/components/danger-report/danger-report-detail-modal"

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}分前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}時間前`
  const days = Math.floor(hours / 24)
  if (days === 1) return "昨日"
  return `${days}日前`
}

const DANGER_TYPE_LABELS: Record<string, string> = {
  traffic: "交通危険",
  crime: "防犯",
  disaster: "災害・自然",
  other: "その他",
}

const LANDING_REPORT_SELECT_COLUMNS = [
  "id",
  "title",
  "description",
  "danger_type",
  "danger_level",
  "status",
  "latitude",
  "longitude",
  "image_url",
  "processed_image_url",
  "processed_image_urls",
  "prefecture",
  "prefecture_code",
  "city",
  "municipality_code",
  "town",
  "postal_code",
  "created_at",
  "updated_at",
].join(", ")

export function HiyariHatReport() {
  const [reports, setReports] = React.useState<DangerReport[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [reactions, setReactions] = React.useState<Record<string, { helpful: boolean; caution: boolean }>>({})
  const [selectedReport, setSelectedReport] = React.useState<DangerReport | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const openReportModal = React.useCallback((report: DangerReport) => {
    setSelectedReport(report)
    setIsModalOpen(true)
  }, [])

  React.useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    async function fetchReports() {
      try {
        const { data, error } = await supabase
          .from("danger_reports")
          .select(LANDING_REPORT_SELECT_COLUMNS)
          .in("status", ["approved", "published", "resolved"])
          .order("created_at", { ascending: false })
          .limit(5)

        if (error) throw error
        setReports(data ?? [])
      } catch {
        // Silently fail — landing page continues to work
      } finally {
        setIsLoading(false)
      }
    }

    fetchReports()
  }, [])

  const toggleReaction = (postId: string, type: "helpful" | "caution") => {
    setReactions((prev) => ({
      ...prev,
      [postId]: {
        helpful: type === "helpful" ? !prev[postId]?.helpful : (prev[postId]?.helpful || false),
        caution: type === "caution" ? !prev[postId]?.caution : (prev[postId]?.caution || false),
      },
    }))
  }

  const thumbnailUrl = (report: DangerReport): string | undefined => {
    if (report.processed_image_urls && report.processed_image_urls.length > 0) {
      return report.processed_image_urls[0]
    }
    return report.image_url ?? undefined
  }

  return (
    <section className="py-6 md:py-10 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* セクションヘッダー */}
        <div className="flex items-center justify-between px-4 mb-4 md:mb-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
            <h2 className="text-lg md:text-xl font-bold text-gray-900">みんなのヒヤリハット報告</h2>
          </div>
          <Link
            href="/report"
            className="flex items-center gap-0.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            すべて見る
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 投稿リスト */}
        {isLoading ? (
          <div className="px-4 flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-red-500" />
          </div>
        ) : reports.length === 0 ? (
          <div className="px-4 text-center py-10 text-gray-500 text-sm">
            まだ報告がありません
          </div>
        ) : (
          <div className="px-4 space-y-4 md:space-y-0 md:grid md:grid-cols-3 md:gap-6">
            {reports.map((report) => {
              const thumb = thumbnailUrl(report)
              const dangerLabel = DANGER_TYPE_LABELS[report.danger_type ?? "other"] ?? "その他"
              const timeLabel = report.created_at ? formatRelativeTime(report.created_at) : ""

              return (
                <article
                  key={report.id}
                  role="button"
                  tabIndex={0}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openReportModal(report)}
                  onKeyDown={(e) => {
                    if (e.currentTarget !== e.target) return
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      openReportModal(report)
                    }
                  }}
                >
                  {/* ヘッダー */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
                      {dangerLabel}
                    </span>
                    <span className="text-xs text-gray-400">{timeLabel}</span>
                  </div>

                  {/* タイトル */}
                  <p className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">
                    {report.title ?? "ヒヤリハット報告"}
                  </p>

                  {/* 説明 */}
                  {report.description && (
                    <p className="text-sm text-gray-700 leading-relaxed mb-3 line-clamp-3">
                      {report.description}
                    </p>
                  )}

                  {/* 画像 */}
                  {thumb && (
                    <div className="relative aspect-[4/3] rounded-lg overflow-hidden mb-3">
                      <Image
                        src={thumb}
                        alt="投稿画像"
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 400px"
                      />
                    </div>
                  )}

                  {/* 場所タグ */}
                  {report.latitude != null && report.longitude != null && (
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                      <MapPin className="w-3 h-3" />
                      {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                    </div>
                  )}

                  {/* リアクションボタン */}
                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleReaction(report.id, "helpful") }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                        reactions[report.id]?.helpful
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      参考になった
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleReaction(report.id, "caution") }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                        reactions[report.id]?.caution
                          ? "bg-orange-100 text-orange-600"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      <AlertCircle className="w-4 h-4" />
                      気をつける
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* 投稿ボタン */}
        <div className="px-4 mt-4 md:mt-6">
          <Link
            href="/map"
            className="block w-full md:w-auto md:px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors text-center md:mx-auto md:inline-block"
          >
            ヒヤリハットを報告する
          </Link>
        </div>
      </div>

      <DangerReportDetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedReport(null)
        }}
        report={selectedReport}
      />
    </section>
  )
}
