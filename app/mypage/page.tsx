
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useGamification } from "@/hooks/use-gamification"
import { useMissions } from "@/hooks/use-missions"
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
  ShieldCheck,
  Target,
  Trophy,
  Upload,
  Images,
  ArrowRight,
  Clock,
  Edit,
  LogOut,
} from "lucide-react"

interface ReportSummary extends Pick<
  DangerReport,
  "id" | "title" | "created_at" | "status" | "image_url" | "processed_image_urls"
> {}

const STATUS_LABEL: Record<string, { label: string; variant: "outline" | "secondary" | "destructive" | "default" }> = {
  pending: { label: "審査中", variant: "outline" },
  reviewing: { label: "確認中", variant: "outline" },
  approved: { label: "公開中", variant: "secondary" },
  published: { label: "公開中", variant: "secondary" },
  resolved: { label: "解決", variant: "default" },
  rejected: { label: "差し戻し", variant: "destructive" },
}

export default function MyPage() {
  const { supabase } = useSupabase()
  const router = useRouter()
  const { level, points, isLoading: isGamificationLoading } = useGamification()
  const { missions, progress, isLoading: isMissionsLoading } = useMissions()

  const [reports, setReports] = useState<ReportSummary[]>([])
  const [userName, setUserName] = useState("ゲスト")
  const [isReportsLoading, setIsReportsLoading] = useState(true)
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
          // "Auth session missing"は未ログインなのでエラーログ不要
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

  const safeLevel = Math.max(level, 1)
  const previousThreshold = Math.max((safeLevel - 1) * 500, 0)
  const nextThreshold = Math.max(safeLevel * 500, previousThreshold + 100)
  const pointsTowardsLevel = Math.max(points - previousThreshold, 0)
  const levelProgress = Math.min(pointsTowardsLevel / (nextThreshold - previousThreshold), 1)
  const pointsToNextLevel = Math.max(nextThreshold - points, 0)

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
      return <p className="text-sm text-slate-500">挑戦中のミッションはありません。新しいタスクにチャレンジしましょう。</p>
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
            <div key={mission.id} className="rounded-xl border border-slate-100 bg-white/70 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{mission.title}</p>
                  {mission.description && (
                    <p className="text-xs text-slate-500 mt-1">{mission.description}</p>
                  )}
                </div>
                {record?.completed && <Badge variant="secondary">達成</Badge>}
              </div>
              <div className="mt-3 space-y-2">
                <Progress value={percent} className="h-2" />
                <div className="flex justify-between text-xs text-slate-500">
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
      return <p className="text-sm text-slate-500">まだアップロードがありません。気づいた危険箇所を共有してみましょう。</p>
    }

    return (
      <div className="space-y-3">
        {recentUploads.map((report) => {
          const statusInfo = STATUS_LABEL[report.status] ?? {
            label: report.status,
            variant: "outline" as const,
          }
          return (
            <div key={report.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white/70 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{report.title || "タイトル未設定"}</p>
                <p className="text-xs text-slate-500 mt-1">{formatDate(report.created_at)}</p>
              </div>
              <Badge variant={statusInfo.variant} className="whitespace-nowrap">{statusInfo.label}</Badge>
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
      return <p className="text-sm text-slate-500">保存された画像はまだありません。加工画像をアップロードするとここにコレクションされます。</p>
    }

    return (
      <div className="grid grid-cols-3 gap-2">
        {collectionImages.map((item) => (
          <div key={item.id} className="overflow-hidden rounded-xl border border-slate-100 bg-white">
            <img
              src={item.src}
              alt="アップロード画像"
              loading="lazy"
              className="h-20 w-full object-cover"
            />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-32 pt-8 md:pb-16">
        <section>
          <Card variant="gradient" className="relative overflow-hidden bg-gradient-to-br from-sky-500 via-sky-400 to-sky-600 text-white shadow-xl">
            <div className="absolute -right-16 -top-10 h-36 w-36 rounded-full bg-white/20 blur-2xl" />
            <CardHeader className="relative pb-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="text-sm uppercase tracking-wide text-white/80">{userName} さんのレベル</span>
                  <CardTitle className="text-4xl font-black tracking-tight">Lv. {level}</CardTitle>
                  <CardDescription className="text-white/80">
                    次のレベルまであと {pointsToNextLevel} pt
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 text-white hover:bg-white/30"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    aria-label="マイページからログアウト"
                    data-testid="mypage-logout-button"
                  >
                    <LogOut className="mr-1 h-4 w-4" />
                    {isSigningOut ? "ログアウト中..." : "ログアウト"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setIsEditDialogOpen(true)}
                    data-testid="profile-edit-button"
                    aria-label="プロフィール編集"
                  >
                    <Edit className="h-5 w-5" />
                  </Button>
                  <CardIcon icon={<ShieldCheck className="h-6 w-6" />} color="info" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative space-y-6">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-5xl font-extrabold">{points} pt</span>
                <span className="text-sm text-white/80">累計ポイント</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span>現在の進捗</span>
                  <span>Lv.{safeLevel + 1}</span>
                </div>
                <Progress value={Math.round(levelProgress * 100)} className="h-3 bg-white/30" />
              </div>
              {isGamificationLoading && <p className="text-xs text-white/80">レベル情報を更新中...</p>}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>ミッション</CardTitle>
                  <CardDescription>
                    達成 {completedMissionCount} / {missions.length} 件
                  </CardDescription>
                </div>
                <CardIcon icon={<Target className="h-5 w-5" />} color="warning" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderMissionList()}
            </CardContent>
            <CardFooter className="justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href="/missions">
                  すべてのミッションを見る
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>ランキング</CardTitle>
                  <CardDescription>安全活動のスコアを仲間と競いましょう</CardDescription>
                </div>
                <CardIcon icon={<Trophy className="h-5 w-5" />} color="info" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">現在のステータス</p>
                <ul className="mt-2 space-y-1">
                  <li>・累計ポイント: {points} pt</li>
                  <li>・レベル: Lv.{level}</li>
                  <li>・達成ミッション: {completedMissionCount} 件</li>
                </ul>
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href="/leaderboard">
                  ランキングを見る
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>アップロード履歴</CardTitle>
                  <CardDescription>最近報告した危険箇所を確認できます</CardDescription>
                </div>
                <CardIcon icon={<Upload className="h-5 w-5" />} color="primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderRecentUploads()}
            </CardContent>
            <CardFooter className="justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">
                  ダッシュボードで詳しく見る
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>画像コレクション</CardTitle>
                  <CardDescription>アップロードしたオリジナル・加工画像を振り返りましょう</CardDescription>
                </div>
                <CardIcon icon={<Images className="h-5 w-5" />} color="success" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderCollection()}
            </CardContent>
            <CardFooter className="justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard">
                  画像を管理する
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </section>

        <section>
          <Card className="bg-slate-900 text-white">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <CardIcon icon={<Clock className="h-5 w-5" />} color="info" />
                <div>
                  <CardTitle className="text-white">次にできること</CardTitle>
                  <CardDescription className="text-slate-200">
                    危険箇所の共有や画像アップロードで、地域の安全をさらに高めましょう。
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button asChild size="sm" variant="secondary">
                <Link href="/map">MAPで報告する</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href="/hazard-game">キケン発見ゲームで学ぶ</Link>
              </Button>
              <Button asChild size="sm" variant="secondary">
                <Link href="/badges">バッジコレクションを見る</Link>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>

      <ProfileEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onProfileUpdated={() => {
          setProfileKey((k) => k + 1)
          // Reload profile data
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
