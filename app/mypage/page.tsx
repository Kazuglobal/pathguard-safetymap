"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useGamification } from "@/hooks/use-gamification"
import { useMissions } from "@/hooks/use-missions"
import { useUserRoutes } from "@/hooks/use-user-routes"
import { usePushSubscription } from "@/hooks/use-push-subscription"
import type { DangerReport } from "@/lib/types"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardIcon,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ProfileEditDialog } from "@/components/profile/profile-edit-dialog"
import {
  Target,
  Trophy,
  Upload,
  Images,
  ArrowRight,
  Edit,
  Gamepad2,
  Award,
  MapPin,
  Flag,
  Bell,
  Check,
  Compass,
  Sparkles,
  Trash2,
} from "lucide-react"
import { tankenTokens } from "@/lib/design/tanken"
import { MypageNotificationCard } from "./mypage-notification-card"
import { useToast } from "@/components/ui/use-toast"
import { extractStoragePathFromPublicUrl } from "@/lib/storage-path"
import { useDangerReportSignedImageUrls } from "@/lib/danger-report-image-access"

interface ReportSummary extends Pick<
  DangerReport,
  "id" | "title" | "created_at" | "status" | "image_url" | "processed_image_urls"
> {}

const t = tankenTokens

const cardStyle = {
  background: t.color.card,
  borderColor: t.border.soft,
  boxShadow: t.shadow.card,
  borderRadius: t.radius.card,
} as const

const innerPanelStyle = {
  background: t.color.paper,
  borderColor: t.border.faint,
  borderRadius: t.radius.panel,
} as const

const STATUS_LABEL: Record<string, { label: string; variant: "outline" | "secondary" | "destructive" | "default" }> = {
  pending: { label: "審査中", variant: "outline" },
  reviewing: { label: "確認中", variant: "outline" },
  approved: { label: "公開中", variant: "secondary" },
  published: { label: "公開中", variant: "secondary" },
  resolved: { label: "解決", variant: "default" },
  rejected: { label: "差し戻し", variant: "destructive" },
}

function startOfThisWeek(): Date {
  const now = new Date()
  const day = now.getDay() // 0=日
  const diffToMonday = (day + 6) % 7
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday)
  return monday
}

export default function MyPage() {
  const { supabase } = useSupabase()
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const { toast } = useToast()
  const { level, points, isLoading: isGamificationLoading } = useGamification()
  const { missions, progress, isLoading: isMissionsLoading } = useMissions()
  const { routes, isLoading: isRoutesLoading } = useUserRoutes()
  const push = usePushSubscription()

  const [reports, setReports] = useState<ReportSummary[]>([])
  const [userName, setUserName] = useState("ゲスト")
  const [isReportsLoading, setIsReportsLoading] = useState(true)
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [profileKey, setProfileKey] = useState(0)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const signOutInFlightRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    const loadPersonalData = async () => {
      if (!supabase) return
      setIsReportsLoading(true)

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser()

        if (userError) {
          if (!userError.message?.includes("Auth session missing")) {
            console.error("ユーザー情報の取得に失敗しました", userError)
          }
        }

        if (!user) {
          if (isMounted) {
            setUserName("ゲスト")
            setReports([])
            setIsReportsLoading(false)
          }
          return
        }

        const fallbackName = user.email?.split("@")[0] ?? "ユーザー"

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle()

        if (profileError) {
          console.warn("プロフィール名の取得に失敗しました", profileError.message)
        }

        const resolvedName = profileData?.display_name ?? fallbackName

        const { data: reportRows, error: reportError } = await supabase
          .from("danger_reports")
          .select("id, title, created_at, status, image_url, processed_image_urls")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10)

        if (reportError) {
          console.error("アップロード履歴の取得に失敗しました", reportError.message)
        }

        if (isMounted) {
          setUserName(resolvedName)
          setReports(reportRows ?? [])
          setIsReportsLoading(false)
        }
      } catch (error) {
        console.error("マイページ情報の取得に失敗しました", error)
        if (isMounted) {
          setReports([])
          setIsReportsLoading(false)
        }
      }
    }

    loadPersonalData()

    return () => {
      isMounted = false
    }
  }, [supabase])

  const completedMissionCount = useMemo(
    () => Object.values(progress).filter((item) => item?.completed).length,
    [progress],
  )

  const upcomingMissions = useMemo(() => {
    if (!missions.length) return []
    return missions
      .filter((mission: any) => {
        const missionId = Number(mission.id)
        const record = progress[missionId]
        return !record?.completed
      })
      .slice(0, 3)
  }, [missions, progress])

  const recentUploads = useMemo(() => reports.slice(0, 3), [reports])

  const reportsThisWeek = useMemo(() => {
    const monday = startOfThisWeek().getTime()
    return reports.filter((report) => {
      if (!report.created_at) return false
      const time = new Date(report.created_at).getTime()
      return !Number.isNaN(time) && time >= monday
    }).length
  }, [reports])

  const collectionImages = useMemo(() => {
    const images: { src: string; id: string }[] = []
    reports.forEach((report) => {
      if (report.image_url) {
        images.push({ src: report.image_url, id: `${report.id}-original` })
      }
      ;(report.processed_image_urls ?? []).forEach((url, index) => {
        if (url) {
          images.push({ src: url, id: `${report.id}-processed-${index}` })
        }
      })
    })
    return images.slice(0, 6)
  }, [reports])

  // danger-reports バケット非公開化に備え、コレクション表示直前にDB保存済みの
  // 公開URL文字列を短TTLの署名URLへ差し替える(取得中/失敗時は null)。
  const collectionImageUrls = useMemo(() => collectionImages.map((item) => item.src), [collectionImages])
  const signedCollectionImageUrls = useDangerReportSignedImageUrls(supabase, collectionImageUrls)

  // レベル/ポイントは脇役。進捗バーの計算のみ残す。
  const safeLevel = Math.max(level, 1)
  const previousThreshold = Math.max((safeLevel - 1) * 500, 0)
  const nextThreshold = Math.max(safeLevel * 500, previousThreshold + 100)
  const pointsTowardsLevel = Math.max(points - previousThreshold, 0)
  const levelProgress = Math.min(pointsTowardsLevel / (nextThreshold - previousThreshold), 1)
  const pointsToNextLevel = Math.max(nextThreshold - points, 0)

  // はじめの一歩チェックリスト。完了状態はすべて実データから判定する。
  const setupSteps = useMemo(() => {
    const steps: { id: string; label: string; hint: string; done: boolean; href: string; icon: React.ReactNode }[] = [
      {
        id: "route",
        label: "通学路を登録する",
        hint: "おうちと学校をつないで、見守りの土台をつくろう",
        done: routes.length > 0,
        href: "/routes",
        icon: <MapPin className="h-4 w-4" />,
      },
      {
        id: "report",
        label: "気になる場所を1件報告する",
        hint: "地図で見つけた「ヒヤリ」をみんなに共有しよう",
        done: reports.length > 0,
        href: "/map",
        icon: <Flag className="h-4 w-4" />,
      },
    ]
    if (push.state !== "unsupported") {
      steps.push({
        id: "notify",
        label: "お知らせをオンにする",
        hint: "通学路の近くで危険報告が出たらすぐ気づける",
        done: push.state === "subscribed",
        href: "#notifications",
        icon: <Bell className="h-4 w-4" />,
      })
    }
    return steps
  }, [routes.length, reports.length, push.state])

  const setupLoading = isRoutesLoading || isReportsLoading || push.state === "loading"
  const completedSteps = setupSteps.filter((step) => step.done).length
  const allStepsDone = !setupLoading && completedSteps === setupSteps.length

  // 自分の投稿（審査中のもののみ）を削除する。DB側のRLSも「本人のpendingレポートのみ」削除可能に制限されている。
  const handleDeleteReport = async (reportId: string) => {
    if (!supabase) return
    const target = reports.find((r) => r.id === reportId)
    if (!target) return
    if (target.status !== "pending") return // 審査中以外は削除不可（ボタンも出さないが念のため）

    const confirmed = window.confirm(
      `「${target.title || "タイトル未設定"}」を削除しますか？\n\nこの操作は元に戻せません。`,
    )
    if (!confirmed) return

    setDeletingReportId(reportId)
    try {
      const { error: deleteError } = await supabase.from("danger_reports").delete().eq("id", reportId)
      if (deleteError) throw deleteError

      // 関連画像をストレージから削除（ベストエフォート。失敗してもDB削除自体は成功扱い）
      let storageDeleteFailed = false
      const imageUrls = [target.image_url, ...(target.processed_image_urls ?? [])].filter(
        (url): url is string => Boolean(url),
      )
      if (imageUrls.length > 0) {
        const storagePaths = imageUrls
          .map((url) => extractStoragePathFromPublicUrl(url, "danger-reports"))
          .filter((path): path is string => Boolean(path))
        if (storagePaths.length > 0) {
          const { error: storageError } = await supabase.storage.from("danger-reports").remove(storagePaths)
          if (storageError) {
            console.error("投稿画像の削除に失敗しました", storageError)
            storageDeleteFailed = true
          }
        }
      }

      setReports((prev) => prev.filter((r) => r.id !== reportId))
      toast({
        title: "削除しました",
        description: storageDeleteFailed
          ? "投稿を削除しました。（画像の削除は一部失敗しました）"
          : "投稿を削除しました。",
      })
    } catch (error) {
      console.error("投稿の削除に失敗しました", error)
      toast({ title: "削除に失敗しました", description: "もう一度お試しください。", variant: "destructive" })
    } finally {
      setDeletingReportId(null)
    }
  }

  const handleSignOut = async () => {
    if (!supabase || signOutInFlightRef.current) return
    signOutInFlightRef.current = true
    setIsSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.replace("/login")
      router.refresh()
    } catch (error) {
      console.error("サインアウトに失敗しました", error)
    } finally {
      signOutInFlightRef.current = false
      setIsSigningOut(false)
    }
  }

  const fade = (index: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.28, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] as const },
        }

  const renderSummaryTile = (label: string, value: React.ReactNode, loading: boolean) => (
    <div className="flex flex-1 flex-col gap-1 rounded-2xl border px-4 py-3" style={innerPanelStyle}>
      <span className="text-xs font-semibold" style={{ color: t.color.inkSoft }}>
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <span className="text-2xl font-black leading-none" style={{ color: t.color.ink }}>
          {value}
        </span>
      )}
    </div>
  )

  const renderMissionList = () => {
    if (isMissionsLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )
    }

    if (!upcomingMissions.length) {
      return (
        <p className="text-sm" style={{ color: t.color.inkSoft }}>
          今日のミッションはこれから届きます。まずは地図で通学路をのぞいてみよう。
        </p>
      )
    }

    return (
      <div className="space-y-3">
        {upcomingMissions.map((mission: any) => {
          const missionId = Number(mission.id)
          const record = progress[missionId]
          const current = record?.progress ?? 0
          const total = mission.target_value ?? 1
          const percent = Math.min(Math.round((current / total) * 100), 100)
          return (
            <div key={mission.id} className="rounded-xl border p-4" style={innerPanelStyle}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: t.color.ink }}>{mission.title}</p>
                  {mission.description && (
                    <p className="mt-1 text-xs" style={{ color: t.color.inkSoft }}>{mission.description}</p>
                  )}
                </div>
                {record?.completed && <Badge variant="secondary">達成</Badge>}
              </div>
              <div className="mt-3 space-y-2">
                <Progress value={percent} className="h-2" />
                <div className="flex justify-between text-xs" style={{ color: t.color.inkSoft }}>
                  <span>
                    進行度 {current} / {total}
                  </span>
                  <span>{percent}%</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderRecentUploads = () => {
    if (isReportsLoading) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )
    }

    if (!recentUploads.length) {
      return (
        <p className="text-sm" style={{ color: t.color.inkSoft }}>
          まだ報告はありません。通学路で気づいた「ヒヤリ」を1件、地図から共有してみよう。
        </p>
      )
    }

    return (
      <div className="space-y-3">
        {recentUploads.map((report) => {
          const statusInfo = STATUS_LABEL[report.status] ?? {
            label: report.status,
            variant: "outline" as const,
          }
          const canDelete = report.status === "pending"
          return (
            <div
              key={report.id}
              className="flex items-center justify-between gap-3 rounded-xl border p-4"
              style={innerPanelStyle}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: t.color.ink }}>{report.title || "タイトル未設定"}</p>
                <p className="mt-1 text-xs" style={{ color: t.color.inkSoft }}>{formatDate(report.created_at)}</p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <Badge variant={statusInfo.variant} className="whitespace-nowrap">{statusInfo.label}</Badge>
                {canDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:bg-red-50"
                    onClick={() => handleDeleteReport(report.id)}
                    disabled={deletingReportId === report.id}
                    aria-label="この投稿を削除"
                    title="審査中の投稿を削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderCollection = () => {
    if (isReportsLoading) {
      return (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 w-full" />
          ))}
        </div>
      )
    }

    if (!collectionImages.length) {
      return (
        <p className="text-sm" style={{ color: t.color.inkSoft }}>
          報告した写真はここにコレクションされます。最初の1枚をアップロードしてみよう。
        </p>
      )
    }

    return (
      <div className="grid grid-cols-3 gap-2">
        {collectionImages.map((item, index) => {
          const signedSrc = signedCollectionImageUrls[index] ?? null
          return (
            <div key={item.id} className="overflow-hidden rounded-xl border" style={innerPanelStyle}>
              {signedSrc ? (
                <img
                  src={signedSrc}
                  alt="アップロード画像"
                  loading="lazy"
                  className="h-20 w-full object-cover"
                />
              ) : (
                <div className="flex h-20 w-full items-center justify-center bg-gray-50">
                  <Skeleton className="h-full w-full" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: t.color.paper, color: t.color.ink }}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-32 pt-8 md:pb-16">
        {/* ヘッダー: あいさつ + レベルチップ + 編集 */}
        <motion.header {...fade(0)} className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold" style={{ color: t.color.inkSoft }}>わが家の見守りノート</p>
            <h1 className="truncate text-2xl font-black tracking-tight" style={{ color: t.color.ink }}>
              こんにちは、{userName}さん
            </h1>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
              style={{ background: t.color.sunSoft, color: t.color.inkSoft, borderRadius: t.radius.chip }}
              aria-label={`レベル${level}、${points}ポイント`}
            >
              <Sparkles className="h-3.5 w-3.5" style={{ color: t.color.sunDeep }} />
              Lv.{level} · {points}pt
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={t.cls.focus}
              style={{ color: t.color.inkSoft }}
              onClick={() => setIsEditDialogOpen(true)}
              data-testid="profile-edit-button"
              aria-label="プロフィール編集"
            >
              <Edit className="h-5 w-5" />
            </Button>
          </div>
        </motion.header>

        {/* 今週のわが家の見守り */}
        <motion.section {...fade(1)}>
          <Card className="border" style={cardStyle}>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <CardIcon icon={<Compass className="h-5 w-5" />} color="primary" />
                <div>
                  <CardTitle style={{ color: t.color.ink }}>今週のわが家の見守り</CardTitle>
                  <CardDescription style={{ color: t.color.inkSoft }}>
                    {allStepsDone
                      ? "準備はばっちり。今週も通学路の変化に気づいていこう。"
                      : "小さな一歩の積み重ねが、毎日の安心につながります。"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="flex flex-wrap gap-3">
                {renderSummaryTile("今週の報告", `${reportsThisWeek}件`, isReportsLoading)}
                {renderSummaryTile("登録した通学路", `${routes.length}本`, isRoutesLoading)}
                {renderSummaryTile(
                  "達成ミッション",
                  isMissionsLoading ? "" : `${completedMissionCount}/${missions.length}`,
                  isMissionsLoading,
                )}
              </div>
              <div className="space-y-2 rounded-2xl border px-4 py-3" style={innerPanelStyle}>
                <div className="flex items-center justify-between text-xs" style={{ color: t.color.inkSoft }}>
                  <span>Lv.{level} の進捗</span>
                  <span>あと {pointsToNextLevel}pt で Lv.{safeLevel + 1}</span>
                </div>
                <Progress value={Math.round(levelProgress * 100)} className="h-2.5" />
                <p className="text-xs" style={{ color: t.color.inkFaint }}>
                  ポイントは報告やミッション達成でたまり、レベルとバッジに反映されます。
                  {isGamificationLoading && "（更新中…）"}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.section>

        {/* はじめての3ステップ（全部完了したら非表示） */}
        {!allStepsDone && (
          <motion.section {...fade(2)}>
            <Card className="border" style={cardStyle}>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle style={{ color: t.color.ink }}>はじめての3ステップ</CardTitle>
                    <CardDescription style={{ color: t.color.inkSoft }}>
                      {setupLoading
                        ? "準備状況を確認しています…"
                        : `${completedSteps}/${setupSteps.length} 完了 — 次の一歩へ進もう`}
                    </CardDescription>
                  </div>
                  <CardIcon icon={<Flag className="h-5 w-5" />} color="warning" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {setupSteps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 rounded-2xl border p-3"
                    style={innerPanelStyle}
                  >
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white"
                      style={{
                        background: step.done ? t.color.primary : t.color.sun,
                        color: step.done ? "#fff" : t.color.ink,
                      }}
                      aria-hidden
                    >
                      {step.done ? <Check className="h-4 w-4" /> : step.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-sm font-bold"
                        style={{ color: step.done ? t.color.inkSoft : t.color.ink }}
                      >
                        {step.label}
                      </p>
                      <p className="text-xs" style={{ color: t.color.inkFaint }}>
                        {step.done ? "完了ずみ。ありがとう！" : step.hint}
                      </p>
                    </div>
                    {step.done ? (
                      <Badge variant="secondary" className="flex-shrink-0">完了</Badge>
                    ) : step.id === "notify" ? (
                      <Button
                        size="sm"
                        className={`flex-shrink-0 text-white ${t.cls.focus}`}
                        style={{ background: t.color.primary, boxShadow: t.shadow.pressGreen }}
                        onClick={() => push.subscribe()}
                      >
                        オンにする
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline" className={`flex-shrink-0 ${t.cls.focus}`}>
                        <Link href={step.href}>
                          進む
                          <ArrowRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.section>
        )}

        {/* 活動カード群 */}
        <motion.section {...fade(3)} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="border" style={cardStyle}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle style={{ color: t.color.ink }}>ミッション</CardTitle>
                  <CardDescription style={{ color: t.color.inkSoft }}>
                    達成 {completedMissionCount} / {missions.length} 件
                  </CardDescription>
                </div>
                <CardIcon icon={<Target className="h-5 w-5" />} color="warning" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">{renderMissionList()}</CardContent>
            <CardFooter className="justify-end pt-4">
              <Button asChild variant="outline" size="sm" className={t.cls.focus}>
                <Link href="/missions">
                  すべてのミッションを見る
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="border" style={cardStyle}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle style={{ color: t.color.ink }}>ランキング</CardTitle>
                  <CardDescription style={{ color: t.color.inkSoft }}>安全活動のスコアを仲間と見くらべよう</CardDescription>
                </div>
                <CardIcon icon={<Trophy className="h-5 w-5" />} color="info" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="rounded-xl border p-4 text-sm" style={innerPanelStyle}>
                <p className="font-semibold" style={{ color: t.color.ink }}>いまのわが家</p>
                <ul className="mt-2 space-y-1" style={{ color: t.color.inkSoft }}>
                  <li>・累計ポイント: {points} pt</li>
                  <li>・レベル: Lv.{level}</li>
                  <li>・達成ミッション: {completedMissionCount} 件</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="justify-end pt-4">
              <Button asChild variant="outline" size="sm" className={t.cls.focus}>
                <Link href="/leaderboard">
                  ランキングを見る
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="border" style={cardStyle}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle style={{ color: t.color.ink }}>アップロード履歴</CardTitle>
                  <CardDescription style={{ color: t.color.inkSoft }}>最近報告した危険箇所を確認できます</CardDescription>
                </div>
                <CardIcon icon={<Upload className="h-5 w-5" />} color="primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">{renderRecentUploads()}</CardContent>
            <CardFooter className="justify-end pt-4">
              <Button asChild variant="outline" size="sm" className={t.cls.focus}>
                <Link href="/dashboard">
                  ダッシュボードで詳しく見る
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="border" style={cardStyle}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle style={{ color: t.color.ink }}>画像コレクション</CardTitle>
                  <CardDescription style={{ color: t.color.inkSoft }}>報告したオリジナル・加工画像を振り返ろう</CardDescription>
                </div>
                <CardIcon icon={<Images className="h-5 w-5" />} color="success" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">{renderCollection()}</CardContent>
            <CardFooter className="justify-end pt-4">
              <Button asChild variant="outline" size="sm" className={t.cls.focus}>
                <Link href="/dashboard">
                  画像を管理する
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </motion.section>

        <motion.section {...fade(4)} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card className="border" style={cardStyle}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle style={{ color: t.color.ink }}>キケン発見ゲーム</CardTitle>
                  <CardDescription style={{ color: t.color.inkSoft }}>ゲームで危険感度を高めよう</CardDescription>
                </div>
                <CardIcon icon={<Gamepad2 className="h-5 w-5" />} color="warning" />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm" style={{ color: t.color.inkSoft }}>
                写真から危険箇所を発見するトレーニングゲーム。プレイするたびにポイントを獲得できます。
              </p>
            </CardContent>
            <CardFooter className="justify-end pt-4">
              <Button asChild variant="outline" size="sm" className={t.cls.focus}>
                <Link href="/hazard-game">
                  ゲームをプレイ
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card className="border" style={cardStyle}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle style={{ color: t.color.ink }}>バッジ・ランキング</CardTitle>
                  <CardDescription style={{ color: t.color.inkSoft }}>獲得バッジとスコアを確認</CardDescription>
                </div>
                <CardIcon icon={<Award className="h-5 w-5" />} color="info" />
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 pt-0">
              <Button asChild size="sm" variant="outline" className={t.cls.focus}>
                <Link href="/leaderboard">ランキングを見る</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className={t.cls.focus}>
                <Link href="/badges">バッジコレクション</Link>
              </Button>
            </CardContent>
            <CardFooter className="justify-end pt-4">
              <Button asChild variant="outline" size="sm" className={t.cls.focus}>
                <Link href="/missions">
                  全ミッションを見る
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </motion.section>

        {/* 通知 */}
        <motion.section {...fade(5)} id="notifications">
          <MypageNotificationCard push={push} />
        </motion.section>

        {/* 次にできること */}
        <motion.section {...fade(6)}>
          <Card
            className="border text-white"
            style={{
              background: `linear-gradient(150deg, ${t.color.accent} 0%, ${t.color.accentStrong} 100%)`,
              borderColor: t.border.soft,
              boxShadow: t.shadow.card,
              borderRadius: t.radius.card,
            }}
          >
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-12 w-12 items-center justify-center rounded-xl"
                  style={{ background: "rgba(255,255,255,.22)" }}
                >
                  <Sparkles className="h-6 w-6" />
                </span>
                <div>
                  <CardTitle className="text-white">次にできること</CardTitle>
                  <CardDescription className="text-white/85">
                    危険箇所の共有やゲームで、地域の安全をもっと高めよう。
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 pt-0">
              <Button asChild size="sm" variant="secondary" className={t.cls.focus}>
                <Link href="/map">MAPで報告する</Link>
              </Button>
              <Button asChild size="sm" variant="secondary" className={t.cls.focus}>
                <Link href="/hazard-game">キケン発見ゲームで学ぶ</Link>
              </Button>
              <Button asChild size="sm" variant="secondary" className={t.cls.focus}>
                <Link href="/badges">バッジコレクションを見る</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.section>

        {/* ログアウト（控えめに最下部へ） */}
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={t.cls.focus}
            style={{ color: t.color.inkSoft }}
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-label="マイページからログアウト"
            data-testid="mypage-logout-button"
          >
            {isSigningOut ? "ログアウト中..." : "ログアウト"}
          </Button>
        </div>
      </div>

      <ProfileEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onProfileUpdated={() => {
          setProfileKey((k) => k + 1)
          if (supabase) {
            supabase.auth.getUser().then(({ data: { user } }: any) => {
              if (user) {
                supabase
                  .from("profiles")
                  .select("display_name")
                  .eq("id", user.id)
                  .maybeSingle()
                  .then(({ data }: any) => {
                    if (data?.display_name) {
                      setUserName(data.display_name)
                    }
                  })
              }
            })
          }
        }}
      />
    </div>
  )
}

function formatDate(value: string | null): string {
  if (!value) return "日時不明"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }
  return parsed.toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}
