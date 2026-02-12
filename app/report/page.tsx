"use client"

import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { useSupabase } from "@/components/providers/supabase-provider"
import type { DangerReport } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { AlertTriangle, Bookmark, Heart, Images, MapPin, MessageCircle, Loader2 } from "lucide-react"
import ImagePreviewDialog from "@/components/danger-report/image-preview-dialog"
import SharedGallery3D from "@/components/report/shared-gallery-3d"
import { LongPressZoomableImage } from "@/components/ui/long-press-zoomable-image"
import { CommentSection } from "@/components/comments/comment-section"
import { useReportInteractionsBatch } from "@/hooks/use-report-interactions"

interface PublicReport extends Pick<
  DangerReport,
  "id" | "title" | "description" | "danger_type" | "danger_level" | "latitude" | "longitude" | "status" | "image_url" | "processed_image_urls" | "created_at"
> {}

const DANGER_TYPE_META: Record<string, { label: string; accent: string; badge: string }> = {
  traffic: {
    label: "交通危険",
    accent: "from-orange-400 via-red-500 to-rose-500",
    badge: "bg-orange-500/90 text-white",
  },
  crime: {
    label: "不審者・犯罪",
    accent: "from-purple-500 via-indigo-500 to-blue-500",
    badge: "bg-indigo-500/90 text-white",
  },
  disaster: {
    label: "災害危険",
    accent: "from-amber-400 via-orange-500 to-red-500",
    badge: "bg-amber-500/90 text-slate-900",
  },
  other: {
    label: "その他",
    accent: "from-slate-400 via-slate-500 to-slate-600",
    badge: "bg-slate-500/90 text-white",
  },
}

const DEFAULT_DANGER_META = DANGER_TYPE_META.other
const APPROVED_STATUSES = ["approved", "published", "resolved"]

type ShareFeedEntry = {
  report: PublicReport
  cover: string | null
  meta: { label: string; accent: string; badge: string }
  tags: string[]
  coordinates: string | null
}

const extractHashTags = (description: string | null) =>
  description
    ? Array.from(new Set((description.match(/#[^\s#]+/g) ?? []).map((tag) => tag.replace(/^#/, ""))))
    : []

const getCoverImage = (report: PublicReport) =>
  report.processed_image_urls?.find((url) => url && url.length > 0) ?? report.image_url ?? null

const formatDate = (value: string | null) => {
  if (!value) return "日時不明"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString("ja-JP", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export default function ReportHubPage() {
  const { supabase } = useSupabase()
  const [reports, setReports] = useState<PublicReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [cautionStates, setCautionStates] = useState<Record<string, boolean>>({})
  const [selectedCategoryType, setSelectedCategoryType] = useState<string | null>(null)
  const [isCategorySheetOpen, setIsCategorySheetOpen] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [selectedReport, setSelectedReport] = useState<PublicReport | null>(null)
  const [isReportDetailOpen, setIsReportDetailOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    if (!supabase) return

    let isMounted = true

    const fetchReports = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from("danger_reports")
          .select(
            "id, title, description, danger_type, danger_level, latitude, longitude, status, image_url, processed_image_urls, created_at",
          )
          .in("status", APPROVED_STATUSES)
          .order("created_at", { ascending: false })
          .limit(60)

        if (!isMounted) return

        if (error) {
          console.error("危険報告の取得に失敗しました", error.message)
          setReports([])
        } else {
          setReports(data ?? [])
        }
      } catch (error) {
        console.error("危険報告の読み込みでエラーが発生しました", error)
        if (isMounted) {
          setReports([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchReports()

    // Check login status
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (isMounted) {
        setIsLoggedIn(!!user)
      }
    }
    checkAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (isMounted) {
        setIsLoggedIn(!!session?.user)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  // Report IDs for batch interactions hook
  const reportIds = useMemo(() => reports.map(r => r.id), [reports])

  // Use the batch hook for likes/saves
  const {
    interactions,
    isLoading: interactionsLoading,
    toggleLike,
    toggleSave,
  } = useReportInteractionsBatch(reportIds)

  const hazardCategories = useMemo(() => {
    if (!reports.length) {
      return Object.entries(DANGER_TYPE_META).map(([typeKey, meta]) => ({
        type: typeKey,
        label: meta.label,
        accent: meta.accent,
        badge: meta.badge,
        count: 0,
        cover: null as string | null,
        lastReportedAt: null as string | null,
      }))
    }

    const groups: Record<string, {
      type: string
      label: string
      accent: string
      badge: string
      count: number
      cover: string | null
      lastReportedAt: string | null
    }> = {}

    reports.forEach((report) => {
      const typeKey = report.danger_type ?? "other"
      const meta = DANGER_TYPE_META[typeKey] ?? DEFAULT_DANGER_META

      if (!groups[typeKey]) {
        groups[typeKey] = {
          type: typeKey,
          label: meta.label,
          accent: meta.accent,
          badge: meta.badge,
          count: 0,
          cover: null,
          lastReportedAt: null,
        }
      }

      const group = groups[typeKey]
      group.count += 1
      const cover = getCoverImage(report)
      if (!group.cover && cover) {
        group.cover = cover
      }
      if (report.created_at && (!group.lastReportedAt || new Date(report.created_at) > new Date(group.lastReportedAt))) {
        group.lastReportedAt = report.created_at
      }
    })

    return Object.values(groups).sort((a, b) => b.count - a.count)
  }, [reports])

  const shareFeed = useMemo<ShareFeedEntry[]>(() => {
    if (!reports.length) {
      return []
    }

    return reports.map((report) => {
      const typeKey = report.danger_type ?? "other"
      const meta = DANGER_TYPE_META[typeKey] ?? DEFAULT_DANGER_META
      const cover = getCoverImage(report)
      const hashTags = extractHashTags(report.description)
      const tags = Array.from(new Set([meta.label, `危険度${report.danger_level ?? "?"}`, ...hashTags])).filter(Boolean)
      const hasCoordinates = typeof report.latitude === "number" && typeof report.longitude === "number"

      return {
        report,
        cover,
        meta,
        tags,
        coordinates: hasCoordinates ? `${report.latitude.toFixed(3)}, ${report.longitude.toFixed(3)}` : null,
      }
    })
  }, [reports])

  const shareFeedByCategory = useMemo<Record<string, ShareFeedEntry[]>>(() => {
    const map: Record<string, ShareFeedEntry[]> = {}
    shareFeed.forEach((entry) => {
      const key = entry.report.danger_type ?? "other"
      if (!map[key]) {
        map[key] = []
      }
      map[key].push(entry)
    })
    return map
  }, [shareFeed])

  const selectedCategoryEntries = useMemo(() => {
    if (!selectedCategoryType) return []
    return shareFeedByCategory[selectedCategoryType] ?? []
  }, [shareFeedByCategory, selectedCategoryType])

  const selectedCategoryMeta = useMemo(() => {
    if (!selectedCategoryType) return null
    return DANGER_TYPE_META[selectedCategoryType] ?? DEFAULT_DANGER_META
  }, [selectedCategoryType])

  const handleCategoryOpen = (type: string) => {
    setSelectedCategoryType(type)
    setIsCategorySheetOpen(true)
  }

  const handleCautionAction = useCallback((reportId: string) => {
    setCautionStates(prev => ({
      ...prev,
      [reportId]: !prev[reportId],
    }))
  }, [])

  const handleReportClick = (report: PublicReport) => {
    setSelectedReport(report)
    setIsReportDetailOpen(true)
  }

  const renderShareCard = ({ report, cover, meta, tags, coordinates }: ShareFeedEntry) => {
    const interaction = interactions.get(report.id) ?? { liked: false, likeCount: 0, saved: false, saveCount: 0 }
    const isCaution = cautionStates[report.id] ?? false

    return (
      <div
        key={report.id}
        className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        data-testid="report-item"
        onClick={() => handleReportClick(report)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{report.title || "タイトル未設定"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{formatDate(report.created_at)}</span>
              {coordinates && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {coordinates}
                </span>
              )}
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${meta.badge}`}>{meta.label}</span>
        </div>
        {cover ? (
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            <LongPressZoomableImage
              src={cover}
              alt={`${meta.label}の共有画像`}
              wrapperClassName="overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              className="h-44 sm:h-56 md:h-64 lg:h-72 w-full object-cover object-center cursor-zoom-in"
              onClick={() => setPreviewImage(cover)}
            />
          </div>
        ) : (
          <div className={`mt-3 flex h-44 sm:h-56 md:h-64 lg:h-72 items-center justify-center rounded-xl bg-gradient-to-br ${meta.accent}`}>
            <Images className="h-10 w-10 text-white/90" />
          </div>
        )}
        {report.description && (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{report.description}</p>
        )}
        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={`${report.id}-${tag}`} variant="secondary" className="bg-sky-50 text-sky-600">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant={interaction.liked ? "default" : "ghost"}
            className={interaction.liked ? "bg-rose-500 text-white hover:bg-rose-500/90" : ""}
            onClick={(e) => { e.stopPropagation(); toggleLike(report.id) }}
            disabled={interactionsLoading}
          >
            {interactionsLoading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Heart className={`mr-1 h-4 w-4 ${interaction.liked ? "fill-current" : ""}`} />
            )}
            いいね {interaction.likeCount}
          </Button>
          <Button
            size="sm"
            variant={interaction.saved ? "default" : "ghost"}
            className={interaction.saved ? "bg-emerald-500 text-white hover:bg-emerald-500/90" : ""}
            onClick={(e) => { e.stopPropagation(); toggleSave(report.id) }}
            disabled={interactionsLoading}
          >
            {interactionsLoading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Bookmark className={`mr-1 h-4 w-4 ${interaction.saved ? "fill-current" : ""}`} />
            )}
            保存
          </Button>
          <Button
            size="sm"
            variant={isCaution ? "default" : "ghost"}
            className={isCaution ? "bg-amber-500 text-white hover:bg-amber-500/90" : ""}
            onClick={(e) => { e.stopPropagation(); handleCautionAction(report.id) }}
          >
            <AlertTriangle className="mr-1 h-4 w-4" />
            気をつけよう
          </Button>
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleReportClick(report) }}>
            <MessageCircle className="mr-1 h-4 w-4" />
            コメント
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-10">
        <Card variant="gradient" className="border-none bg-gradient-to-br from-sky-500 via-sky-400 to-sky-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl sm:text-3xl font-bold leading-tight">みんなの危険報告</CardTitle>
            <CardDescription className="text-sky-100">
              最新の危険箇所を確認して、通学路の安全をみんなで守りましょう。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap sm:gap-4">
            <div className="text-sm text-sky-100 sm:flex-1 min-w-0">
              {reports.length > 0 ? `${reports.length} 件の危険報告が共有されています。` : "まだ危険報告はありません。"}
            </div>
            <div className="flex w-full gap-3 flex-col sm:flex-row sm:w-auto sm:flex-wrap sm:justify-start">
              <Button asChild variant="secondary" className="w-full sm:w-auto whitespace-normal break-keep">
                <Link href="/map">危険箇所をマップで見る</Link>
              </Button>
              <Button asChild className="w-full bg-white text-sky-600 hover:bg-white/90 sm:w-auto whitespace-normal break-keep">
                <Link href="/hazard-game">投稿方法を学ぶ</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="gallery" className="w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">危険報告と共有</h2>
              <p className="text-sm text-slate-500">カテゴリ別に危険箇所を探したり、写真付きの共有をチェックできます。</p>
            </div>
            <TabsList className="grid h-11 w-full grid-cols-3 sm:w-auto">
              <TabsTrigger value="gallery">危険報告</TabsTrigger>
              <TabsTrigger value="share">共有フィード</TabsTrigger>
              <TabsTrigger value="3d-gallery">3Dギャラリー</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="gallery" className="mt-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>危険報告ギャラリー</CardTitle>
                    <CardDescription>種類ごとに集まった危険箇所の投稿</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-32 sm:h-40 md:h-44 lg:h-52 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {hazardCategories.map((category) => (
                      <button
                        key={category.type}
                        type="button"
                        onClick={() => handleCategoryOpen(category.type)}
                        className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                        aria-label={`${category.label}の投稿を表示`}
                      >
                        {category.cover ? (
                          <img src={category.cover} alt={`${category.label}の危険報告`} loading="lazy" className="h-32 sm:h-40 md:h-44 lg:h-52 w-full object-cover object-center" />
                        ) : (
                          <div className={`flex h-32 sm:h-40 md:h-44 lg:h-52 w-full items-center justify-center rounded-2xl bg-gradient-to-br ${category.accent}`}>
                            <AlertTriangle className="h-8 w-8 text-white" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 text-white">
                          <p className="text-sm font-semibold">{category.label}</p>
                          <p className="text-xs text-white/80">{category.count} 件</p>
                          {category.lastReportedAt && (
                            <p className="mt-1 text-[10px] text-white/70">最終更新 {formatDate(category.lastReportedAt)}</p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="share" className="mt-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>共有フィード</CardTitle>
                    <CardDescription>写真付きの危険箇所レポートとアクション</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <Skeleton key={index} className="h-44 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : shareFeed.length ? (
                  <div className="space-y-4">
                    {shareFeed.map(renderShareCard)}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">まだ共有はありません。危険箇所を写真と一緒に投稿してみましょう。</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="3d-gallery" className="mt-6">
            <SharedGallery3D />
          </TabsContent>
        </Tabs>

        <Sheet
          open={isCategorySheetOpen && !!selectedCategoryType}
          onOpenChange={(open) => {
            setIsCategorySheetOpen(open)
            if (!open) {
              setSelectedCategoryType(null)
            }
          }}
        >
          <SheetContent side="bottom" className="h-[75vh] w-full overflow-y-auto pb-24 sm:mx-auto sm:max-w-3xl sm:pb-6">
            <SheetHeader>
              <SheetTitle>{selectedCategoryMeta?.label ?? "危険報告"}</SheetTitle>
              <SheetDescription>
                {selectedCategoryEntries.length
                  ? `${selectedCategoryEntries.length} 件の投稿`
                  : "このカテゴリの投稿はまだありません。"}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              {selectedCategoryEntries.length ? (
                selectedCategoryEntries.map(renderShareCard)
              ) : (
                <p className="text-sm text-slate-500">危険箇所が投稿されるとここに表示されます。</p>
              )}
            </div>
          </SheetContent>
        </Sheet>

        {/* レポート詳細シート（コメント付き） */}
        <Sheet
          open={isReportDetailOpen && !!selectedReport}
          onOpenChange={(open) => {
            setIsReportDetailOpen(open)
            if (!open) {
              setSelectedReport(null)
            }
          }}
        >
          <SheetContent side="bottom" className="h-[85vh] w-full overflow-y-auto pb-24 sm:mx-auto sm:max-w-3xl sm:pb-6">
            {selectedReport && (
              <>
                <SheetHeader>
                  <SheetTitle>{selectedReport.title || "タイトル未設定"}</SheetTitle>
                  <SheetDescription>
                    {formatDate(selectedReport.created_at)}
                    {selectedReport.latitude && selectedReport.longitude && (
                      <span className="ml-2">
                        <MapPin className="inline-block h-3.5 w-3.5 mr-1" />
                        {selectedReport.latitude.toFixed(3)}, {selectedReport.longitude.toFixed(3)}
                      </span>
                    )}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-4 space-y-6">
                  {/* レポート画像 */}
                  {getCoverImage(selectedReport) && (
                    <LongPressZoomableImage
                      src={getCoverImage(selectedReport)!}
                      alt="危険報告の画像"
                      wrapperClassName="w-full overflow-hidden rounded-xl"
                      className="h-48 w-full object-cover object-center"
                      onClick={() => setPreviewImage(getCoverImage(selectedReport))}
                    />
                  )}

                  {/* レポート詳細 */}
                  {selectedReport.description && (
                    <p className="text-sm leading-relaxed text-slate-600">{selectedReport.description}</p>
                  )}

                  {/* 危険タイプとレベル */}
                  <div className="flex flex-wrap gap-2">
                    <Badge className={(DANGER_TYPE_META[selectedReport.danger_type ?? "other"] ?? DEFAULT_DANGER_META).badge}>
                      {(DANGER_TYPE_META[selectedReport.danger_type ?? "other"] ?? DEFAULT_DANGER_META).label}
                    </Badge>
                    <Badge variant="outline">危険度 {selectedReport.danger_level ?? "?"}</Badge>
                  </div>

                  {/* コメントセクション */}
                  <div className="border-t pt-6">
                    <CommentSection
                      spotId={selectedReport.id}
                      isLoggedIn={isLoggedIn}
                    />
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
      {/* 画像プレビュー（拡大表示） */}
      <ImagePreviewDialog isOpen={!!previewImage} imageUrl={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  )
}
