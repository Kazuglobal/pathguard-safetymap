"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { ThumbsUp, AlertCircle, ChevronRight, MessageCircle, MapPin, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createBrowserClient } from "@supabase/ssr"
import type { DangerReport } from "@/lib/types"
import DangerReportDetailModal from "@/components/danger-report/danger-report-detail-modal"
import { useLandingReportReactions } from "@/hooks/use-landing-report-reactions"
import { tankenTokens } from "@/lib/design/tanken"
import { NATIONWIDE } from "@/lib/user-region"
import { useReportRegionFilter } from "@/hooks/use-report-region-filter"
import { ReportRegionFilter } from "@/components/region/report-region-filter"

const C = tankenTokens.color

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
  suspicious: "不審者情報",
  disaster: "災害・自然",
  other: "その他",
}

// danger_reports_public_preview VIEW には image_url / processed_image_url /
// processed_image_urls を含めていない(danger-reports storage バケットは非公開化
// されており、匿名ユーザーは元々これらのURLへアクセスできないため)。
// 存在しない列を SELECT すると PostgREST がエラーを返し、報告一覧全体が
// 空表示になってしまうので、ここでは列一覧から除外する。
const LANDING_REPORT_SELECT_COLUMNS = [
  "id",
  "title",
  "description",
  "danger_type",
  "danger_level",
  "status",
  "latitude",
  "longitude",
  "prefecture",
  "prefecture_code",
  "city",
  "municipality_code",
  "town",
  "postal_code",
  "created_at",
  "updated_at",
].join(", ")

const LANDING_PUBLIC_STATUSES = ["approved", "published", "resolved"] as const

const LANDING_REPORT_DISPLAY_LIMIT = 5

// 学校周辺モードは矩形取得後に距離で絞るため、多めに取得してから絞り込む。
// 矩形は円よりも広く、高密度地域では円外の新着が上位を占めうるため余裕を持たせる
const SCHOOL_MODE_FETCH_LIMIT = 100

/** 親が読める場所表示。住所があれば住所、なければ座標にフォールバック。 */
function formatPlace(report: DangerReport): string | null {
  const address = [report.prefecture, report.city, report.town]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
  if (address) return address
  if (report.latitude != null && report.longitude != null) {
    return `${report.latitude.toFixed(4)}, ${report.longitude.toFixed(4)}`
  }
  return null
}

export function HiyariHatReport() {
  const [reports, setReports] = React.useState<DangerReport[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedReport, setSelectedReport] = React.useState<DangerReport | null>(null)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const reportIds = React.useMemo(() => reports.map((report) => report.id), [reports])
  const { reactions, toggleReaction } = useLandingReportReactions(reportIds)
  const openReportModal = React.useCallback((report: DangerReport) => {
    setSelectedReport(report)
    setIsModalOpen(true)
  }, [])

  // Supabase クライアントはブラウザ専用のためマウント後に一度だけ生成する
  const [supabase, setSupabase] = React.useState<ReturnType<typeof createBrowserClient> | null>(null)
  React.useEffect(() => {
    setSupabase(
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    )
  }, [])

  const region = useReportRegionFilter({
    client: supabase,
    table: "danger_reports_public_preview",
    statuses: LANDING_PUBLIC_STATUSES,
  })
  const {
    mounted,
    school,
    scopeLabel,
    applyRegionFilter,
    refineBySchool,
  } = region

  React.useEffect(() => {
    if (!mounted || !supabase) return

    const abortController = new AbortController()
    let ignore = false

    async function fetchReports() {
      setIsLoading(true)
      try {
        // 未ログイン(anon)からは緯度経度を約1.1km四方へ丸めた公開プレビュー
        // VIEW (danger_reports_public_preview) のみを参照する。
        // ベーステーブル danger_reports への anon SELECT は閉じている
        // (supabase/migrations/20260704090300_restrict_public_read_and_storage.sql)。
        const query = applyRegionFilter(
          supabase!
            .from("danger_reports_public_preview")
            .select(LANDING_REPORT_SELECT_COLUMNS)
            .in("status", [...LANDING_PUBLIC_STATUSES])
            .abortSignal(abortController.signal)
        )

        const { data, error } = await query
          .order("created_at", { ascending: false })
          .limit(school ? SCHOOL_MODE_FETCH_LIMIT : LANDING_REPORT_DISPLAY_LIMIT)

        if (error) throw error
        if (ignore || abortController.signal.aborted) return
        const rows = refineBySchool((data ?? []) as unknown as DangerReport[])
        setReports(rows.slice(0, LANDING_REPORT_DISPLAY_LIMIT))
      } catch (error) {
        if (ignore || abortController.signal.aborted) return
        // Silently fail — landing page continues to work
      } finally {
        if (ignore || abortController.signal.aborted) return
        setIsLoading(false)
      }
    }

    fetchReports()
    return () => {
      ignore = true
      abortController.abort()
    }
  }, [mounted, supabase, school, applyRegionFilter, refineBySchool])

  const thumbnailUrl = (report: DangerReport): string | undefined => {
    if (report.processed_image_urls && report.processed_image_urls.length > 0) {
      return report.processed_image_urls[0]
    }
    return report.image_url ?? undefined
  }

  return (
    <section className="py-6 md:py-10" style={{ background: C.paperDeep }}>
      <div className="mx-auto max-w-6xl">
        {/* セクションヘッダー */}
        <div className="mb-4 flex items-center justify-between px-4 md:mb-6">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 md:h-6 md:w-6" style={{ color: C.accent }} aria-hidden="true" />
            <h2 className="text-lg font-black md:text-xl" style={{ color: C.ink }}>
              みんなのヒヤリハット報告
            </h2>
          </div>
          <Link
            href="/report"
            className={`flex items-center gap-0.5 rounded-full text-sm font-bold ${tankenTokens.cls.focus}`}
            style={{ color: C.primaryStrong }}
          >
            すべて見る
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {/* 地域フィルター(県 → 市町村 → 学校周辺) */}
        {mounted && (
          <div className="mb-4 px-4">
            <ReportRegionFilter
              prefecture={region.prefecture}
              city={region.city}
              school={region.school}
              cityOptions={region.cityOptions}
              onPrefectureChange={region.handlePrefectureChange}
              onCityChange={region.handleCityChange}
              onSchoolChange={region.handleSchoolChange}
              variant="tanken"
            />
          </div>
        )}

        {/* 投稿リスト */}
        {isLoading ? (
          <div className="flex items-center justify-center px-4 py-12">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: C.accent }} aria-hidden="true" />
            <span className="sr-only">読み込み中</span>
          </div>
        ) : reports.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm" style={{ color: C.inkSoft }}>
            {scopeLabel === NATIONWIDE
              ? "まだ報告がありません。最初の「気をつけて」を地図に残してみましょう。"
              : `${scopeLabel}ではまだ報告がありません。最初の「気をつけて」を地図に残してみましょう。`}
          </div>
        ) : (
          <div className="grid gap-4 px-4 md:grid-cols-3 md:gap-6">
            {reports.map((report) => {
              const thumb = thumbnailUrl(report)
              const dangerLabel = DANGER_TYPE_LABELS[report.danger_type ?? "other"] ?? "その他"
              const timeLabel = report.created_at ? formatRelativeTime(report.created_at) : ""
              const placeLabel = formatPlace(report)

              return (
                <article
                  key={report.id}
                  role="button"
                  tabIndex={0}
                  className={`flex cursor-pointer flex-col rounded-[22px] border p-4 transition-transform hover:-translate-y-0.5 ${tankenTokens.cls.focus}`}
                  style={{
                    background: C.card,
                    borderColor: tankenTokens.border.faint,
                    boxShadow: tankenTokens.shadow.soft,
                  }}
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
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{ background: C.accentSoft, color: C.accentStrong }}
                    >
                      {dangerLabel}
                    </span>
                    <span className="text-xs" style={{ color: C.inkFaint }}>
                      {timeLabel}
                    </span>
                  </div>

                  {/* タイトル */}
                  <p className="mb-2 line-clamp-2 text-sm font-bold" style={{ color: C.ink }}>
                    {report.title ?? "ヒヤリハット報告"}
                  </p>

                  {/* 説明 */}
                  {report.description && (
                    <p className="mb-3 line-clamp-2 text-sm leading-relaxed" style={{ color: C.inkSoft }}>
                      {report.description}
                    </p>
                  )}

                  {/* 画像 */}
                  {thumb && (
                    <div className="relative mb-3 aspect-[4/3] overflow-hidden rounded-[14px]">
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
                  {placeLabel && (
                    <div className="mb-3 flex items-center gap-1 text-xs" style={{ color: C.inkSoft }}>
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {placeLabel}
                    </div>
                  )}

                  {/* リアクションボタン(カード下端に揃える) */}
                  <div
                    className="mt-auto flex items-center gap-3 border-t pt-3"
                    style={{ borderColor: tankenTokens.border.faint }}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleReaction(report.id, "helpful") }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors",
                        tankenTokens.cls.focus,
                        reactions[report.id]?.helpful
                          ? "bg-blue-100 text-blue-600"
                          : "bg-[#F3EAD6] text-[#847661] hover:bg-[#EDE2C8]"
                      )}
                    >
                      <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                      参考になった
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleReaction(report.id, "caution") }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition-colors",
                        tankenTokens.cls.focus,
                        reactions[report.id]?.caution
                          ? "bg-orange-100 text-orange-600"
                          : "bg-[#F3EAD6] text-[#847661] hover:bg-[#EDE2C8]"
                      )}
                    >
                      <AlertCircle className="h-4 w-4" aria-hidden="true" />
                      気をつける
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {/* 投稿ボタン */}
        <div className="mt-4 px-4 text-center md:mt-6">
          <Link
            href="/map"
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-8 py-3 text-base font-bold text-white transition-transform active:translate-y-1 active:shadow-none md:w-auto ${tankenTokens.cls.focus}`}
            style={{ background: C.accent, boxShadow: tankenTokens.shadow.pressAccent }}
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
