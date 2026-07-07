"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  X,
  Navigation,
  AlertCircle,
  Settings,
  Compass,
  RefreshCw,
  ShieldCheck,
  Map
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useOptionalSupabase } from "@/components/providers/supabase-provider"
import type { ARViewProps } from "@/lib/ar-view-types"
import type { DangerReport } from "@/lib/types"
import { calculateARHazardData, getARVisibilityOptions, type ARHazardData } from "@/lib/ar-utils"
import { formatHeadingDisplay } from "@/lib/ar-display-utils"
import {
  buildARLearningTourStops,
  summarizeARLearningTour,
  type ARLearningTourStatus,
} from "@/lib/ar-learning-tour"
import { buildKidsChecklist, generateKidsQuiz } from "@/lib/ar-learning-quiz"
import { summarizeRouteLearningProgress } from "@/lib/ar-learning-route-progress"
import { drawHazardOverlay } from "@/lib/ar-canvas-renderer"
import {
  type ARError,
  DEFAULT_MAX_DISTANCE,
  DEFAULT_FOV,
  CAMERA_IDEAL_WIDTH,
  CAMERA_IDEAL_HEIGHT,
  DRAW_TARGET_FPS,
  WALKING_SPEED_KMH,
} from "@/lib/ar-constants"
import { useARCamera } from "@/hooks/use-ar-camera"
import { useARLocation } from "@/hooks/use-ar-location"
import { useAROrientation } from "@/hooks/use-ar-orientation"
import { useARLearningSession } from "@/hooks/use-ar-learning-session"
import { createKidsHazardCue, isApproachingHazard } from "@/lib/ar-learning-tour-kids"
import { trackEvent } from "@/lib/analytics"
import { buildRouteLearningSessionPayload } from "@/lib/route-learning-session-payload"
import { getARSafetySuppression } from "@/lib/ar-safety"
import { ARSafetySuppressionNotice } from "./ar-safety-suppression-notice"
import { ARSettingsPanel } from "./ar-settings-panel"
import { ARPrimaryHazardCard, ARSecondaryHazardCard } from "./ar-hazard-card"
import { ARLearningReviewCard } from "./ar-learning-review"

function calculateEstimatedTime(distance: number): number {
  return Math.round((distance / 1000 / WALKING_SPEED_KMH) * 60)
}

function createManualHazardData(reports: DangerReport[]): ARHazardData[] {
  return reports.map((report, index) => ({
    report,
    distance: 0,
    bearing: 0,
    relativeAngle: 0,
    x: 0,
    y: 0,
    z: Math.min((index + 1) / Math.max(reports.length, 1), 1),
  }))
}

export default function ARView({ mode, onClose }: ARViewProps) {
  const isParentChildMode = mode.kind === "parent_child_route"
  const reports = mode.reports
  const parentRouteId = isParentChildMode ? mode.routeId : null
  const parentChildId = isParentChildMode ? mode.childId : null
  const parentChildName = isParentChildMode ? mode.childName : null
  const parentSessionId = isParentChildMode ? mode.sessionId : null
  const [hasSafetyAcknowledged, setHasSafetyAcknowledged] = useState(!isParentChildMode)
  const [guardianConsent, setGuardianConsent] = useState(false)
  const [manualLocationMode, setManualLocationMode] = useState(false)
  const sensorsEnabled = !isParentChildMode || hasSafetyAcknowledged
  const optionalSupabase = useOptionalSupabase()

  // フック
  const {
    videoRef,
    isCameraActive,
    isLoading,
    loadingStep,
    estimatedFov,
    cameraPermission,
    error: cameraError,
    stopCamera,
    retry: retryCamera,
  } = useARCamera({ enabled: sensorsEnabled })
  const { userLocation, locationPermission, error: locationError, retry: retryLocation } = useARLocation({
    enabled: sensorsEnabled && !manualLocationMode,
  })
  const {
    userHeading,
    orientationPermission,
    error: orientationError,
    retry: retryOrientation,
  } = useAROrientation({ enabled: sensorsEnabled })
  const learningSession = useARLearningSession({
    routeId: isParentChildMode ? mode.routeId : "nearby",
    sessionId: isParentChildMode ? mode.sessionId : "nearby",
    enabled: sensorsEnabled,
  })

  // ローカルstate
  const dialogRef = useRef<HTMLDivElement>(null)
  const lastActiveElementRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const sessionCompletedTrackedRef = useRef(false)
  const remoteSavedQuizCompletedAtRef = useRef<string | null>(null)
  const [maxDistance, setMaxDistance] = useState<number>(DEFAULT_MAX_DISTANCE)
  const [showSettings, setShowSettings] = useState(false)
  const [fov, setFov] = useState<number>(DEFAULT_FOV)
  const [localTourProgress, setLocalTourProgress] = useState<Record<string, ARLearningTourStatus>>({})
  const [activeStopId, setActiveStopId] = useState<string | null>(null)
  const approachedReportIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    setHasSafetyAcknowledged(!isParentChildMode)
    setGuardianConsent(false)
    setManualLocationMode(false)
  }, [isParentChildMode, parentRouteId])

  const tourProgress = isParentChildMode ? learningSession.state.progress : localTourProgress
  // 安全抑制はモードを問わず適用する(個人利用の歩きスマホ対策。lib/ar-safety.ts に一元化)
  const { isLocationAccuracyLow, isMovingTooFast } = getARSafetySuppression(userLocation)
  const canUpdateTourStatus = !isParentChildMode || learningSession.hasHydrated
  const isLocationFallbackAvailable =
    isParentChildMode &&
    Boolean(locationError) &&
    !manualLocationMode &&
    !cameraError

  // エラー集約: カメラエラーを優先
  const arError: ARError | null =
    cameraError ??
    (isParentChildMode && !manualLocationMode ? orientationError : null) ??
    (manualLocationMode && isParentChildMode ? null : locationError) ??
    null
  const hasPositionContext = Boolean(userLocation) || (isParentChildMode && manualLocationMode)
  const canRenderHazardContent = sensorsEnabled && !arError && isCameraActive && hasPositionContext

  // パーミッション集約
  const permissions = useMemo(() => ({
    camera: cameraPermission,
    location: locationPermission,
    orientation: orientationPermission,
  }), [cameraPermission, locationPermission, orientationPermission])

  // カメラ推定FOVの統合
  useEffect(() => {
    if (estimatedFov !== null) {
      setFov(estimatedFov)
    }
  }, [estimatedFov])

  // AR危険個所データの計算
  const arHazards = useMemo(() => {
    if (isParentChildMode && manualLocationMode) {
      return createManualHazardData(reports)
    }

    if (!userLocation || reports.length === 0) {
      return []
    }
    return calculateARHazardData(
      userLocation.lat,
      userLocation.lon,
      userHeading,
      reports,
      getARVisibilityOptions({
        orientationPermission,
        maxDistance,
        fov,
      })
    )
  }, [
    fov,
    isParentChildMode,
    manualLocationMode,
    maxDistance,
    orientationPermission,
    reports,
    userHeading,
    userLocation,
  ])

  const learningStops = useMemo(() => {
    return buildARLearningTourStops(arHazards, tourProgress)
  }, [arHazards, tourProgress])

  useEffect(() => {
    if (learningStops.length === 0) {
      setActiveStopId(null)
      return
    }

    if (activeStopId && learningStops.some((stop) => stop.report.id === activeStopId)) {
      return
    }

    const nextPendingStop = learningStops.find((stop) => stop.status === "pending")
    setActiveStopId(nextPendingStop?.report.id ?? learningStops[0].report.id)
  }, [activeStopId, learningStops])

  const activeStop = useMemo(() => {
    if (learningStops.length === 0) return null
    return (
      learningStops.find((stop) => stop.report.id === activeStopId) ??
      learningStops.find((stop) => stop.status === "pending") ??
      learningStops[0]
    )
  }, [activeStopId, learningStops])

  const activeStopIndex = useMemo(() => {
    if (!activeStop) return -1
    return learningStops.findIndex((stop) => stop.report.id === activeStop.report.id)
  }, [activeStop, learningStops])

  const nextStop = useMemo(() => {
    if (activeStopIndex === -1) return null
    return learningStops[activeStopIndex + 1] ?? null
  }, [activeStopIndex, learningStops])

  const learningSummary = useMemo(() => summarizeARLearningTour(learningStops), [learningStops])
  const routeProgressSummary = useMemo(
    () => summarizeRouteLearningProgress(reports, tourProgress),
    [reports, tourProgress]
  )
  const kidsQuiz = useMemo(() => {
    if (!isParentChildMode) return null
    return generateKidsQuiz(reports, {
      seed: `${parentRouteId ?? "route"}:${learningSession.state.startedAt}`,
    })
  }, [isParentChildMode, learningSession.state.startedAt, parentRouteId, reports])
  const isTourComplete = isParentChildMode
    ? routeProgressSummary.isComplete
    : learningStops.length > 0 && learningStops.every((stop) => stop.status !== "pending")
  const activeStopKidsCue = useMemo(() => {
    if (!isParentChildMode || !activeStop) return undefined
    return createKidsHazardCue(activeStop.report)
  }, [activeStop, isParentChildMode])
  // 接近強調は通常モードでも表示する(安全抑制の対象もモード共通)。
  // ar_hazard_approached の計測は従来どおり親子モード限定(下のeffect)
  const isActiveStopApproaching =
    Boolean(activeStop) &&
    !manualLocationMode &&
    !isLocationAccuracyLow &&
    !isMovingTooFast &&
    isApproachingHazard(activeStop!.hazard.distance)

  useEffect(() => {
    if (!isParentChildMode || !hasSafetyAcknowledged) return
    trackEvent("ar_parent_mode_started", {
      route_id: parentRouteId,
      child_id: parentChildId,
    })
  }, [hasSafetyAcknowledged, isParentChildMode, parentChildId, parentRouteId])

  useEffect(() => {
    if (!isParentChildMode || !activeStop || !isActiveStopApproaching) return
    if (approachedReportIdsRef.current.has(activeStop.report.id)) return

    approachedReportIdsRef.current.add(activeStop.report.id)
    trackEvent("ar_hazard_approached", {
      distance_m: Math.round(activeStop.hazard.distance),
      hazard_id: activeStop.report.id,
      danger_type: activeStop.report.danger_type,
    })
  }, [activeStop, isActiveStopApproaching, isParentChildMode])

  useEffect(() => {
    if (!isParentChildMode || !isTourComplete || sessionCompletedTrackedRef.current) return

    sessionCompletedTrackedRef.current = true
    const startedAt = new Date(learningSession.state.startedAt).getTime()
    const durationSeconds = Number.isFinite(startedAt)
      ? Math.max(0, Math.round((Date.now() - startedAt) / 1000))
      : 0

    trackEvent("ar_session_completed", {
      reviewed_count: routeProgressSummary.reviewedCount,
      saved_count: routeProgressSummary.savedCount,
      duration_s: durationSeconds,
    })
  }, [
    isParentChildMode,
    isTourComplete,
    learningSession.state.startedAt,
    routeProgressSummary.reviewedCount,
    routeProgressSummary.savedCount,
  ])

  useEffect(() => {
    if (
      !isParentChildMode ||
      !isTourComplete ||
      !learningSession.hasHydrated ||
      learningSession.state.checklist.length > 0
    ) {
      return
    }

    learningSession.setChecklist(buildKidsChecklist(reports))
  }, [
    isParentChildMode,
    isTourComplete,
    learningSession,
    learningSession.hasHydrated,
    learningSession.state.checklist.length,
    reports,
  ])

  useEffect(() => {
    const quizCompletedAt = learningSession.state.quizCompletedAt
    if (
      !isParentChildMode ||
      !quizCompletedAt ||
      !parentRouteId ||
      !parentSessionId ||
      remoteSavedQuizCompletedAtRef.current === quizCompletedAt ||
      !optionalSupabase?.supabase
    ) {
      return
    }

    remoteSavedQuizCompletedAtRef.current = quizCompletedAt

    const saveRemoteSession = async () => {
      const supabase = optionalSupabase.supabase
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const payload = buildRouteLearningSessionPayload({
        checklist: learningSession.state.checklist,
        progress: learningSession.state.progress,
      })

      await supabase.from("route_learning_sessions").upsert(
        {
          user_id: user.id,
          route_id: parentRouteId,
          session_id: parentSessionId,
          child_id: parentChildId,
          child_name: parentChildName,
          schema_version: payload.schemaVersion,
          started_at: learningSession.state.startedAt,
          completed_at: learningSession.state.completedAt ?? quizCompletedAt,
          reviewed_count: routeProgressSummary.reviewedCount,
          saved_count: routeProgressSummary.savedCount,
          quiz_score: learningSession.state.quizScore,
          quiz_total: learningSession.state.quizTotal,
          checklist: payload.checklist,
          stop_results: payload.stopResults,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,route_id,session_id" }
      )
    }

    saveRemoteSession().catch(() => {
      remoteSavedQuizCompletedAtRef.current = null
    })
  }, [
    isParentChildMode,
    learningSession.state.checklist,
    learningSession.state.completedAt,
    learningSession.state.progress,
    learningSession.state.quizCompletedAt,
    learningSession.state.quizScore,
    learningSession.state.quizTotal,
    learningSession.state.startedAt,
    optionalSupabase,
    parentChildId,
    parentChildName,
    parentRouteId,
    parentSessionId,
    routeProgressSummary.reviewedCount,
    routeProgressSummary.savedCount,
  ])

  // Canvas描画エラーハンドラー
  const handleCanvasError = useCallback((message: string) => {
    // Canvas描画エラーは致命的ではないがログに残す
    if (process.env.NODE_ENV === "development") {
      console.error(`AR Canvas: ${message}`)
    }
  }, [])

  // キャンバスへの描画
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !isCameraActive) {
      return
    }

    const canvas = canvasRef.current
    const video = videoRef.current
    let lastDrawTime = 0
    const frameInterval = 1000 / DRAW_TARGET_FPS
    let stopped = false

    const draw = (timestamp: number) => {
      if (stopped) return
      if (timestamp - lastDrawTime < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }
      lastDrawTime = timestamp

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        handleCanvasError("描画コンテキストが失われました")
        stopped = true
        return
      }

      const videoWidth = video.videoWidth || CAMERA_IDEAL_WIDTH
      const videoHeight = video.videoHeight || CAMERA_IDEAL_HEIGHT
      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth
        canvas.height = videoHeight
      }

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      } catch {
        handleCanvasError("描画に失敗しました")
        stopped = true
        return
      }

      drawHazardOverlay(ctx, arHazards, canvas.width, canvas.height, fov, maxDistance)

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    animationFrameRef.current = requestAnimationFrame(draw)

    return () => {
      stopped = true
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isCameraActive, arHazards, fov, maxDistance, videoRef, handleCanvasError])

  // イベントハンドラー
  const handleClose = useCallback(() => {
    stopCamera()
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    onClose()
  }, [onClose, stopCamera])

  // Escapeキーハンドラ + フォーカストラップ
  useEffect(() => {
    lastActiveElementRef.current = document.activeElement as HTMLElement

    // ダイアログ内の最初のフォーカス可能要素にフォーカス
    const focusableSelector =
      'button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'

    const timer = setTimeout(() => {
      if (dialogRef.current) {
        const focusable = dialogRef.current.querySelector<HTMLElement>(focusableSelector)
        focusable?.focus()
      }
    }, 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        handleClose()
        return
      }

      if (event.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)
        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault()
          lastElement.focus()
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("keydown", handleKeyDown)
      if (lastActiveElementRef.current && document.body.contains(lastActiveElementRef.current)) {
        lastActiveElementRef.current.focus()
      }
    }
  }, [handleClose])

  const handleRetry = useCallback(() => {
    if (!arError) return

    const errorType = arError.type
    if (errorType.startsWith("camera")) {
      retryCamera()
    } else if (errorType.startsWith("location")) {
      setManualLocationMode(false)
      retryLocation()
    } else if (errorType.startsWith("orientation")) {
      retryOrientation()
    } else {
      // unknown エラー: 全初期化を再実行
      retryCamera()
      retryLocation()
      retryOrientation()
    }
  }, [arError, retryCamera, retryLocation, retryOrientation])

  const handleUseManualLocationMode = useCallback(() => {
    setManualLocationMode(true)
    setActiveStopId(
      reports.find((report) => tourProgress[report.id] === undefined)?.id ??
      reports[0]?.id ??
      null
    )
  }, [reports, tourProgress])

  const handleAcknowledgeSafety = useCallback(() => {
    if (!guardianConsent) return
    setHasSafetyAcknowledged(true)
  }, [guardianConsent])

  const updateTourStatus = useCallback(
    (status: ARLearningTourStatus) => {
      if (!activeStop) return

      const nextStops = learningStops.map((stop) =>
        stop.report.id === activeStop.report.id
          ? { ...stop, status }
          : stop
      )

      if (isParentChildMode) {
        learningSession.markStop(activeStop.report.id, status)
        trackEvent(status === "reviewed" ? "ar_hazard_confirmed" : "ar_hazard_saved", {
          hazard_id: activeStop.report.id,
        })
      } else {
        setLocalTourProgress((current) => ({
          ...current,
          [activeStop.report.id]: status,
        }))
      }

      setActiveStopId(
        nextStops.find((stop) => stop.status === "pending")?.report.id ??
        activeStop.report.id
      )
    },
    [activeStop, isParentChildMode, learningSession, learningStops]
  )

  const handleRestartTour = useCallback(() => {
    if (isParentChildMode) {
      learningSession.reset()
    } else {
      setLocalTourProgress({})
    }
    setActiveStopId(learningStops[0]?.report.id ?? null)
  }, [isParentChildMode, learningSession, learningStops])

  const handleQuizLinkClick = useCallback(() => {
    if (!isParentChildMode) return
    trackEvent("ar_quiz_link_clicked", {
      route_id: mode.routeId,
    })
  }, [isParentChildMode, mode])

  const handleCompleteQuiz = useCallback(
    (answers: Record<string, string>, score: number, total: number) => {
      if (!isParentChildMode) return

      learningSession.completeQuiz(answers, score, total)
      trackEvent("ar_quiz_completed", {
        route_id: mode.routeId,
        score,
        total,
      })
    },
    [isParentChildMode, learningSession, mode]
  )

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ar-view-title"
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      {/* ヘッダー */}
      <div className="absolute top-0 left-0 right-0 z-40 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-white" />
          <h2 id="ar-view-title" className="text-lg font-semibold text-white">
            {isParentChildMode ? "親子で通学路確認" : "AR危険個所ビュー"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className="text-white hover:bg-white/20"
            aria-label="AR設定"
            aria-expanded={showSettings}
            aria-controls="ar-settings-panel"
          >
            <Settings className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white hover:bg-white/20"
            aria-label="ARビューを閉じる"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {isParentChildMode && !hasSafetyAcknowledged && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <Card
            className="w-full max-w-md rounded-3xl border-amber-200 bg-white p-5 shadow-2xl"
            role="alertdialog"
            aria-labelledby="ar-safety-title"
            aria-describedby="ar-safety-description"
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <ShieldCheck className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 id="ar-safety-title" className="text-lg font-bold text-slate-950">
                  立ち止まって親子で確認
                </h3>
                <p id="ar-safety-description" className="mt-2 text-sm leading-6 text-slate-700">
                  歩きながら画面を見続けないでください。危険ポイントでは必ず立ち止まり、保護者が周囲を確認してから子どもと一緒に内容を見てください。
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 shrink-0 rounded border-slate-400"
                checked={guardianConsent}
                onChange={(event) => setGuardianConsent(event.target.checked)}
              />
              <span>
                保護者として、AR確認中に子どもの位置情報を取得することに同意します。
              </span>
            </label>

            <div className="mt-5 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 flex-1 rounded-2xl"
                onClick={handleClose}
              >
                閉じる
              </Button>
              <Button
                type="button"
                className="min-h-11 flex-1 rounded-2xl"
                disabled={!guardianConsent}
                onClick={handleAcknowledgeSafety}
              >
                同意して開始
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* 設定パネル */}
      {showSettings && (
        <ARSettingsPanel
          maxDistance={maxDistance}
          onMaxDistanceChange={setMaxDistance}
          fov={fov}
          onFovChange={setFov}
          permissions={permissions}
        />
      )}

      {/* 方向インジケーター */}
      {sensorsEnabled && isCameraActive && userLocation && !arError && (
        <div className="absolute top-16 left-4 z-20">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg p-2 text-white text-xs">
            <div className="flex items-center gap-2">
              <Compass className="h-3 w-3" aria-hidden="true" />
              <span>{formatHeadingDisplay(userHeading)}</span>
            </div>
          </div>
        </div>
      )}

      {isParentChildMode && !arError && hasSafetyAcknowledged && (
        <div className="absolute right-4 top-16 z-20 max-w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-black/70 p-3 text-white shadow-lg backdrop-blur-sm">
          <p className="text-xs font-semibold tracking-wide text-amber-200">選択中の通学路</p>
          <p className="mt-1 text-sm font-bold">{mode.routeName}</p>
          {mode.childName && <p className="mt-1 text-xs text-slate-200">{mode.childName}</p>}
          <ARSafetySuppressionNotice
            isLocationAccuracyLow={isLocationAccuracyLow}
            isMovingTooFast={isMovingTooFast}
            className="mt-2"
          />
          {manualLocationMode && (
            <p className="mt-2 text-xs text-amber-100">位置情報なし: 手動確認中</p>
          )}
        </div>
      )}

      {/* 通常モードの安全抑制インジケータ(親子モードは上のパネル内に表示) */}
      {!isParentChildMode && !arError && (isLocationAccuracyLow || isMovingTooFast) && (
        <div
          className="absolute right-4 top-16 z-20 max-w-[min(20rem,calc(100vw-2rem))] rounded-2xl bg-black/70 p-3 text-white shadow-lg backdrop-blur-sm"
          role="status"
        >
          <ARSafetySuppressionNotice
            isLocationAccuracyLow={isLocationAccuracyLow}
            isMovingTooFast={isMovingTooFast}
            showWalkPrompt
          />
        </div>
      )}

      {/* スクリーンリーダー向け危険個所数通知 */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {canRenderHazardContent && (
          arHazards.length > 0
            ? `${arHazards.length}件の危険個所が検出されました`
            : "近くに危険個所はありません"
        )}
      </div>

      {/* カメラビュー */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ pointerEvents: "none" }}
          aria-hidden="true"
        />

        {/* ローディング状態 */}
        {sensorsEnabled && isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70" role="status" aria-live="polite">
            <div className="text-center text-white max-w-xs">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent mx-auto" aria-hidden="true" />
              <p className="text-sm font-medium mb-2">{loadingStep}</p>
              <p className="text-xs text-gray-400">
                カメラと位置情報の許可が必要です
              </p>
            </div>
          </div>
        )}

        {/* エラー状態 */}
        {sensorsEnabled && arError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <Card className="max-w-md p-6" role="alertdialog" aria-labelledby="ar-error-title">
              <div className="mb-4 flex items-center gap-2 text-red-600">
                <AlertCircle className="h-6 w-6" aria-hidden="true" />
                <h3 id="ar-error-title" className="font-semibold text-lg">{arError.message}</h3>
              </div>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700 whitespace-pre-line">
                  {arError.suggestion}
                </p>
              </div>
              {isLocationFallbackAvailable && (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                  GPSが使えない場合でも、現地で立ち止まって手動確認できます。危険ポイントに着いたら「ここに着いた」を押してください。
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                {isLocationFallbackAvailable && (
                  <Button
                    type="button"
                    onClick={handleUseManualLocationMode}
                    className="min-h-11 flex-1"
                  >
                    <Map className="h-4 w-4 mr-2" />
                    手動で確認を続ける
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="min-h-11 flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  再試行
                </Button>
                <Button onClick={handleClose} className="min-h-11 flex-1">
                  閉じる
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* 主要危険地点カード */}
        {canRenderHazardContent && activeStop && (
          <ARPrimaryHazardCard
            hazard={activeStop.hazard}
            estimatedTimeMinutes={calculateEstimatedTime(activeStop.hazard.distance)}
            distanceLabel={manualLocationMode ? "手動確認" : undefined}
            estimatedTimeLabel={manualLocationMode ? "現地で確認" : undefined}
            learningContent={activeStop.content}
            childCue={activeStopKidsCue}
            isApproaching={isActiveStopApproaching}
            progressLabel={`${Math.max(activeStopIndex + 1, 1)} / ${learningStops.length}`}
            markReviewedLabel={manualLocationMode ? "ここに着いた" : "確認した"}
            onMarkReviewed={canUpdateTourStatus ? () => updateTourStatus("reviewed") : undefined}
            onSaveForLater={canUpdateTourStatus ? () => updateTourStatus("saved") : undefined}
          />
        )}

        {/* 次の危険地点カード */}
        {canRenderHazardContent && nextStop && !isTourComplete && (
          <ARSecondaryHazardCard hazard={nextStop.hazard} />
        )}

        {/* 危険地点がない場合 */}
        {canRenderHazardContent && arHazards.length === 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
            <Card className="bg-white/95 backdrop-blur-sm rounded-t-3xl shadow-2xl m-4 pointer-events-auto">
              <div className="p-6 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">近くに危険個所はありません</p>
              </div>
            </Card>
          </div>
        )}

        {canRenderHazardContent && isTourComplete && (
          <ARLearningReviewCard
            isParentChildMode={isParentChildMode}
            routeId={parentRouteId}
            routeProgressSummary={routeProgressSummary}
            learningSummary={learningSummary}
            checklist={learningSession.state.checklist}
            quiz={kidsQuiz}
            quizAnswers={learningSession.state.quizAnswers}
            quizScore={learningSession.state.quizScore}
            quizTotal={learningSession.state.quizTotal}
            quizCompletedAt={learningSession.state.quizCompletedAt}
            onToggleChecklistItem={learningSession.toggleChecklistItem}
            onCompleteQuiz={handleCompleteQuiz}
            onRestartTour={handleRestartTour}
            onClose={handleClose}
            onQuizLinkClick={handleQuizLinkClick}
          />
        )}

        {/* 中央の十字線 */}
        {sensorsEnabled && !arError && isCameraActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <div className="h-1 w-16 border-t-2 border-white/50" />
            <div className="absolute h-16 w-1 border-l-2 border-white/50" />
          </div>
        )}
      </div>
    </div>
  )
}
