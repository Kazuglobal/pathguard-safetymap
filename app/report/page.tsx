"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSupabase } from "@/components/providers/supabase-provider"
import type { DangerReport } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Bookmark, Heart, Images, MapPin, MessageCircle } from "lucide-react"

interface PublicReport
  extends Pick<
    DangerReport,
    | "id"
    | "title"
    | "description"
    | "danger_type"
    | "danger_level"
    | "latitude"
    | "longitude"
    | "status"
    | "image_url"
    | "processed_image_urls"
    | "created_at"
  > {}

const DANGER_TYPE_META: Record<string, { label: string; accent: string; badge: string }> = {
  traffic: {
    label: "交通危険",
    accent: "from-orange-400 via-red-500 to-red-600",
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

type ShareActionState = {
  liked: boolean
  likes: number
  saved: boolean
  caution: boolean
  comments: number
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
  const [shareStats, setShareStats] = useState<Record<string, ShareActionState>>({})

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

    return () => {
      isMounted = false
    }
  }, [supabase])

  useEffect(() => {
    setShareStats((previous) => {
      const next: Record<string, ShareActionState> = {}
      reports.forEach((report) => {
        const existing = previous[report.id]
        const baseLikes = Math.max(1, (report.danger_level ?? 1) * 2)
        const baseComments = extractHashTags(report.description).length
        next[report.id] =
          existing ?? { liked: false, likes: baseLikes, saved: false, caution: false, comments: baseComments }
      })
      return next
    })
  }, [reports])

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

    const groups: Record<string, { type: string; label: string; accent: string; badge: string; count: number; cover: string | null; lastReportedAt: string | null }> = {}

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

  const shareFeed = useMemo(() => {
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

  const handleShareAction = (reportId: string, action: "like" | "save" | "caution") => {
    setShareStats((prev) => {
      const current = prev[reportId]
      if (!current) {
        return prev
      }

      const updated: ShareActionState = { ...current }

      if (action === "like") {
        updated.liked = !updated.liked
        updated.likes = Math.max(0, updated.likes + (updated.liked ? 1 : -1))
      }

      if (action === "save") {
        updated.saved = !updated.saved
      }

      if (action === "caution") {
        updated.caution = !updated.caution
      }

      return { ...prev, [reportId]: updated }
    })
  }

  const handleCommentAction = (reportId: string) => {
    setShareStats((prev) => {
      const current = prev[reportId]
      if (!current) {
        return prev
      }

      const updated: ShareActionState = { ...current, comments: current.comments + 1 }
      return { ...prev, [reportId]: updated }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white pb-28">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pt-10">
        <Card variant="gradient" className="border-none bg-gradient-to-br from-sky-500 via-sky-400 to-sky-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-3xl font-bold">みんなの危険報告</CardTitle>
            <CardDescription className="text-sky-100">
              最新の危険箇所を確認して、通学路の安全をみんなで守りましょう。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-sky-100">
              {reports.length > 0 ? `${reports.length} 件の危険報告が共有されています。` : "まだ危険報告はありません。"}
            </div>
            <div className="flex w-full gap-3 sm:w-auto">
              <Button asChild variant="secondary" className="w-full sm:w-auto">
                <Link href="/map">危険箇所をマップで見る</Link>
              </Button>
              <Button asChild className="w-full bg-white text-sky-600 hover:bg-white/90 sm:w-auto">
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
            <TabsList className="grid h-11 w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="gallery">危険報告</TabsTrigger>
              <TabsTrigger value="share">共有フィード</TabsTrigger>
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
                      <Skeleton key={index} className="h-28 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {hazardCategories.map((category) => (
                      <div key={category.type} className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
                        {category.cover ? (
                          <img src={category.cover} alt={`${category.label}の危険報告`} loading="lazy" className="h-32 w-full object-cover" />
                        ) : (
                          <div className={`flex h-32 w-full items-center justify-center rounded-2xl bg-gradient-to-br ${category.accent}`}>
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
                      </div>
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
                    {shareFeed.map(({ report, cover, meta, tags, coordinates }) => {
                      const stats =
                        shareStats[report.id] ?? ({ liked: false, likes: 0, saved: false, caution: false, comments: 0 } as ShareActionState)
                      return (
                        <div key={report.id} className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm">
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
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta.badge}`}>{meta.label}</span>
                          </div>
                          {cover ? (
                            <div className="mt-3 overflow-hidden rounded-xl">
                              <img src={cover} alt={`${meta.label}の共有画像`} loading="lazy" className="h-40 w-full object-cover" />
                            </div>
                          ) : (
                            <div className={`mt-3 flex h-40 items-center justify-center rounded-xl bg-gradient-to-br ${meta.accent}`}>
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
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              variant={stats.liked ? "default" : "ghost"}
                              className={stats.liked ? "bg-rose-500 text-white hover:bg-rose-500/90" : ""}
                              onClick={() => handleShareAction(report.id, "like")}
                            >
                              <Heart className={`mr-1 h-4 w-4 ${stats.liked ? "fill-current" : ""}`} />
                              いいね {stats.likes}
                            </Button>
                            <Button
                              size="sm"
                              variant={stats.saved ? "default" : "ghost"}
                              className={stats.saved ? "bg-emerald-500 text-white hover:bg-emerald-500/90" : ""}
                              onClick={() => handleShareAction(report.id, "save")}
                            >
                              <Bookmark className={`mr-1 h-4 w-4 ${stats.saved ? "fill-current" : ""}`} />
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant={stats.caution ? "default" : "ghost"}
                              className={stats.caution ? "bg-amber-500 text-white hover:bg-amber-500/90" : ""}
                              onClick={() => handleShareAction(report.id, "caution")}
                            >
                              <AlertTriangle className="mr-1 h-4 w-4" />
                              気をつけよう
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCommentAction(report.id)}>
                              <MessageCircle className="mr-1 h-4 w-4" />
                              コメント {stats.comments}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">まだ共有はありません。危険箇所を写真と一緒に投稿してみましょう。</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
