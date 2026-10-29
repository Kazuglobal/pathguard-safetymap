"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { motion, useReducedMotion } from "framer-motion"
import { useSupabase } from "@/components/providers/supabase-provider"
import { useOptionalAuth } from "@/components/providers/auth-context"
import { ProfileEditDialog } from "@/components/profile/profile-edit-dialog"
import { isReportUnderReview } from "@/components/danger-report/detail/report-detail-utils"
import { useToast } from "@/components/ui/use-toast"
import { useGamification } from "@/hooks/use-gamification"
import { useMissions } from "@/hooks/use-missions"
import { usePushSubscription } from "@/hooks/use-push-subscription"
import { useUserRoutes } from "@/hooks/use-user-routes"
import { LOGGED_OUT_PATH } from "@/lib/auth/login-path"
import { BRAND } from "@/lib/brand"
import { useDangerReportSignedImageUrls } from "@/lib/danger-report-image-access"
import { tankenTokens } from "@/lib/design/tanken"
import { isMaskedMediaKey } from "@/lib/media/url"
import { clearAllLocalRouteGeometry } from "@/lib/route-local-geometry"
import { MypageNotificationCard } from "./mypage-notification-card"
import { MypagePlay } from "./mypage-play"
import { MypageRecords } from "./mypage-records"
import { MYPAGE_NOTIFICATIONS_ID, MypageSettings, needsNotificationSetup } from "./mypage-settings"
import { MypageSetupSteps, buildSetupSteps } from "./mypage-setup-steps"
import { startOfThisWeek } from "./mypage-shared"
import { MYPAGE_REPORT_LIMIT, useMypagePersonalData } from "./use-mypage-personal-data"

const t = tankenTokens

/** 画像コレクションに並べる枚数 */
const COLLECTION_SIZE = 6
/** ミッションのカードに並べる件数 */
const UPCOMING_MISSION_COUNT = 3

/**
 * マイページ(UIUX改装 項目6・7・37)。
 * 通知が未設定なら、いちばん上に通知のカードを出す。そのあとに「自分の記録」「あそぶ」「設定」の3つのグループを並べる。
 */
export default function MyPage() {
  const { supabase } = useSupabase()
  const router = useRouter()
  const reduceMotion = useReducedMotion()
  const { toast } = useToast()
  const auth = useOptionalAuth()
  const { level, points, isLoading: isGamificationLoading } = useGamification()
  const { missions, progress, isLoading: isMissionsLoading } = useMissions()
  const { routes, isLoading: isRoutesLoading } = useUserRoutes()
  const push = usePushSubscription()

  const [profileKey, setProfileKey] = useState(0)
  const { reports, removeReport, userName, isNameLoaded, isReportsLoading } = useMypagePersonalData(profileKey)
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const signOutInFlightRef = useRef(false)

  const completedMissionCount = useMemo(
    () => Object.values(progress).filter((item) => item?.completed).length,
    [progress],
  )

  const upcomingMissions = useMemo(
    () => missions.filter((mission) => !progress[String(mission.id)]?.completed).slice(0, UPCOMING_MISSION_COUNT),
    [missions, progress],
  )

  const reportsThisWeek = useMemo(() => {
    const monday = startOfThisWeek().getTime()
    return reports.filter((report) => {
      if (!report.created_at) return false
      const time = new Date(report.created_at).getTime()
      return !Number.isNaN(time) && time >= monday
    }).length
  }, [reports])

  // 状態の判定は getReportStatusPresentation 系に一元化(ローカル辞書を新設しない)
  const reviewingCount = useMemo(() => reports.filter((report) => isReportUnderReview(report)).length, [reports])

  // 画像コレクションには、端末でぼかした写真(と、そこから作ったもしも画像)だけを並べる(UIUX改装 項目57)
  const collectionImages = useMemo(() => {
    const images: { src: string; id: string }[] = []
    reports.forEach((report) => {
      if (report.image_url && isMaskedMediaKey(report.image_url)) {
        images.push({ src: report.image_url, id: `${report.id}-original` })
      }
      ;(report.processed_image_urls ?? []).forEach((url, index) => {
        if (url && isMaskedMediaKey(url)) {
          images.push({ src: url, id: `${report.id}-processed-${index}` })
        }
      })
    })
    return images.slice(0, COLLECTION_SIZE)
  }, [reports])

  // danger-reports バケット非公開化に備え、コレクション表示直前にDB保存済みの
  // 公開URL文字列を短TTLの署名URLへ差し替える(取得中/失敗時は null)。
  const collectionImageUrls = useMemo(() => collectionImages.map((item) => item.src), [collectionImages])
  const signedCollectionImageUrls = useDangerReportSignedImageUrls(supabase, collectionImageUrls)
  const collection = useMemo(
    () => collectionImages.map((item, index) => ({ id: item.id, src: signedCollectionImageUrls[index] ?? null })),
    [collectionImages, signedCollectionImageUrls],
  )

  const setupSteps = useMemo(
    () => buildSetupSteps({ routeCount: routes.length, reportCount: reports.length }),
    [routes.length, reports.length],
  )
  const setupLoading = isRoutesLoading || isReportsLoading
  const allStepsDone = !setupLoading && setupSteps.every((step) => step.done)

  // ナビのベルの「通知の設定」(/mypage#notifications)から来たら、ページの中身がそろってから通知のカードへ動かす
  const isPageSettled = push.state !== "loading" && !isReportsLoading && !isRoutesLoading && !isMissionsLoading
  const scrolledToNotificationsRef = useRef(false)
  useEffect(() => {
    if (!isPageSettled || scrolledToNotificationsRef.current) return
    if (window.location.hash !== `#${MYPAGE_NOTIFICATIONS_ID}`) return
    scrolledToNotificationsRef.current = true
    document.getElementById(MYPAGE_NOTIFICATIONS_ID)?.scrollIntoView({ block: "start" })
  }, [isPageSettled])

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
      const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
        method: "DELETE", credentials: "same-origin",
      })
      const payload = await response.json().catch(() => ({})) as { mediaDeleteFailed?: boolean; error?: string }
      if (!response.ok) throw new Error(payload.error ?? "Delete failed")

      removeReport(reportId)
      toast({
        title: "削除しました",
        description: payload.mediaDeleteFailed
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
    // ログアウトはヘッダーと同じ入口に揃える(行き先も全画面で LOGGED_OUT_PATH)
    if (auth) {
      await auth.logout()
      return
    }
    if (!supabase || signOutInFlightRef.current) return
    signOutInFlightRef.current = true
    setIsSigningOut(true)
    try {
      await supabase.auth.signOut()
      // この端末に残した通学路の元の線(自宅・学校の位置)も消す
      clearAllLocalRouteGeometry()
      router.replace(LOGGED_OUT_PATH)
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

  return (
    <div className="min-h-screen" style={{ background: t.color.paper, color: t.color.ink }}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-32 pt-8 md:pb-16">
        {/* あいさつ */}
        <motion.header {...fade(0)} className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: t.color.inkSoft }}>わが家の{BRAND.notebook}</p>
          <h1 className="truncate text-2xl font-black tracking-tight" style={{ color: t.color.ink }}>
            {userName ? `こんにちは、${userName}さん` : "こんにちは"}
          </h1>
          {isNameLoaded && !userName && (
            <button
              type="button"
              className={`mt-1 text-sm font-bold underline underline-offset-4 ${t.cls.focus}`}
              style={{ color: t.color.primaryStrong }}
              onClick={() => setIsEditDialogOpen(true)}
            >
              表示名を設定する
            </button>
          )}
        </motion.header>

        {/* 通知が未設定なら、いちばん上に通知のカード(受け取れない環境では理由を出す) */}
        {needsNotificationSetup(push.state) && (
          <motion.div {...fade(1)} id={MYPAGE_NOTIFICATIONS_ID} className="scroll-mt-20">
            <MypageNotificationCard push={push} />
          </motion.div>
        )}

        {/* はじめの一歩(全部すんだら出さない) */}
        {!allStepsDone && (
          <motion.div {...fade(1)}>
            <MypageSetupSteps steps={setupSteps} isLoading={setupLoading} />
          </motion.div>
        )}

        <motion.div {...fade(2)}>
          <MypageRecords
            points={points}
            level={level}
            isGamificationLoading={isGamificationLoading}
            reports={reports}
            isReportsLoading={isReportsLoading}
            isReportListCapped={reports.length >= MYPAGE_REPORT_LIMIT}
            reportListLimit={MYPAGE_REPORT_LIMIT}
            reviewingCount={reviewingCount}
            reportsThisWeek={reportsThisWeek}
            routesCount={routes.length}
            isRoutesLoading={isRoutesLoading}
            deletingReportId={deletingReportId}
            onDeleteReport={handleDeleteReport}
            collection={collection}
          />
        </motion.div>

        <motion.div {...fade(3)}>
          <MypagePlay
            upcomingMissions={upcomingMissions}
            progress={progress}
            completedMissionCount={completedMissionCount}
            missionCount={missions.length}
            isMissionsLoading={isMissionsLoading}
          />
        </motion.div>

        <motion.div {...fade(4)}>
          <MypageSettings
            push={push}
            onEditProfile={() => setIsEditDialogOpen(true)}
            onSignOut={handleSignOut}
            isSigningOut={auth?.isLoggingOut ?? isSigningOut}
          />
        </motion.div>
      </div>

      <ProfileEditDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onProfileUpdated={() => {
          setProfileKey((k) => k + 1)
          // ヘッダーの呼び名も同じ値に揃える
          void auth?.refreshProfile()
        }}
      />
    </div>
  )
}
