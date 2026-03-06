"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  X,
  Navigation,
  AlertCircle,
  Settings,
  Compass,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import type { DangerReport } from "@/lib/types"
import { calculateARHazardData, getARVisibilityOptions } from "@/lib/ar-utils"
import { formatHeadingDisplay } from "@/lib/ar-display-utils"
import {
  buildARLearningTourStops,
  summarizeARLearningTour,
  type ARLearningTourStatus,
} from "@/lib/ar-learning-tour"
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
import { ARSettingsPanel } from "./ar-settings-panel"
import { ARPrimaryHazardCard, ARSecondaryHazardCard } from "./ar-hazard-card"

interface ARViewProps {
  reports: DangerReport[]
  onClose: () => void
}

function calculateEstimatedTime(distance: number): number {
  return Math.round((distance / 1000 / WALKING_SPEED_KMH) * 60)
}

export default function ARView({ reports, onClose }: ARViewProps) {
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
  } = useARCamera()
  const { userLocation, locationPermission, error: locationError, retry: retryLocation } = useARLocation()
  const { userHeading, orientationPermission, retry: retryOrientation } = useAROrientation()

  // ローカルstate
  const dialogRef = useRef<HTMLDivElement>(null)
  const lastActiveElementRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationFrameRef = useRef<number | null>(null)
  const [maxDistance, setMaxDistance] = useState<number>(DEFAULT_MAX_DISTANCE)
  const [showSettings, setShowSettings] = useState(false)
  const [fov, setFov] = useState<number>(DEFAULT_FOV)
  const [tourProgress, setTourProgress] = useState<Record<string, ARLearningTourStatus>>({})
  const [activeStopId, setActiveStopId] = useState<string | null>(null)

  // エラー集約: カメラエラーを優先
  const arError: ARError | null = cameraError ?? locationError ?? null

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
  }, [userLocation, userHeading, reports, orientationPermission, maxDistance, fov])

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
  const isTourComplete = learningStops.length > 0 && learningStops.every((stop) => stop.status !== "pending")

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

  const updateTourStatus = useCallback(
    (status: ARLearningTourStatus) => {
      if (!activeStop) return

      const nextStops = learningStops.map((stop) =>
        stop.report.id === activeStop.report.id
          ? { ...stop, status }
          : stop
      )

      setTourProgress((current) => ({
        ...current,
        [activeStop.report.id]: status,
      }))

      setActiveStopId(
        nextStops.find((stop) => stop.status === "pending")?.report.id ??
        activeStop.report.id
      )
    },
    [activeStop, learningStops]
  )

  const handleRestartTour = useCallback(() => {
    setTourProgress({})
    setActiveStopId(learningStops[0]?.report.id ?? null)
  }, [learningStops])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ar-view-title"
      className="fixed inset-0 z-50 flex flex-col bg-black"
    >
      {/* ヘッダー */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-white" />
          <h2 id="ar-view-title" className="text-lg font-semibold text-white">AR危険個所ビュー</h2>
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
      {isCameraActive && userLocation && !arError && (
        <div className="absolute top-16 left-4 z-20">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg p-2 text-white text-xs">
            <div className="flex items-center gap-2">
              <Compass className="h-3 w-3" aria-hidden="true" />
              <span>{formatHeadingDisplay(userHeading)}</span>
            </div>
          </div>
        </div>
      )}

      {/* スクリーンリーダー向け危険個所数通知 */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {isCameraActive && userLocation && !arError && (
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
        {isLoading && (
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
        {arError && (
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
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  再試行
                </Button>
                <Button onClick={handleClose} className="flex-1">
                  閉じる
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* 主要危険地点カード */}
        {!arError && isCameraActive && userLocation && activeStop && (
          <ARPrimaryHazardCard
            hazard={activeStop.hazard}
            estimatedTimeMinutes={calculateEstimatedTime(activeStop.hazard.distance)}
            learningContent={activeStop.content}
            progressLabel={`${Math.max(activeStopIndex + 1, 1)} / ${learningStops.length}`}
            onMarkReviewed={() => updateTourStatus("reviewed")}
            onSaveForLater={() => updateTourStatus("saved")}
          />
        )}

        {/* 次の危険地点カード */}
        {!arError && isCameraActive && userLocation && nextStop && !isTourComplete && (
          <ARSecondaryHazardCard hazard={nextStop.hazard} />
        )}

        {/* 危険地点がない場合 */}
        {!arError && isCameraActive && userLocation && arHazards.length === 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
            <Card className="bg-white/95 backdrop-blur-sm rounded-t-3xl shadow-2xl m-4 pointer-events-auto">
              <div className="p-6 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">近くに危険個所はありません</p>
              </div>
            </Card>
          </div>
        )}

        {!arError && isCameraActive && userLocation && isTourComplete && (
          <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
            <Card className="pointer-events-auto rounded-3xl bg-white/95 p-5 shadow-2xl backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold tracking-[0.2em] text-emerald-600">TOUR SUMMARY</p>
                  <h3 className="text-lg font-bold text-slate-900">通学路の振り返り</h3>
                </div>
                <Badge className="rounded-full bg-emerald-600 text-white">
                  {learningSummary.reviewedCount + learningSummary.savedCount}/{learningSummary.totalCount}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-slate-100 px-3 py-3">
                  <p className="text-xs text-slate-500">確認済み</p>
                  <p className="text-lg font-bold text-slate-900">{learningSummary.reviewedCount}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 px-3 py-3">
                  <p className="text-xs text-amber-700">見返し</p>
                  <p className="text-lg font-bold text-amber-900">{learningSummary.savedCount}</p>
                </div>
                <div className="rounded-2xl bg-rose-50 px-3 py-3">
                  <p className="text-xs text-rose-700">最重要</p>
                  <p className="text-sm font-bold text-rose-900">
                    {learningSummary.highestRiskStop?.report.title ?? "なし"}
                  </p>
                </div>
              </div>

              {learningSummary.revisitStops.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500">あとで見返す地点</p>
                  <div className="flex flex-wrap gap-2">
                    {learningSummary.revisitStops.map((stop) => (
                      <Badge key={stop.report.id} variant="secondary" className="rounded-full">
                        {stop.report.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <Button type="button" className="flex-1 rounded-2xl" onClick={handleRestartTour}>
                  もう一度見る
                </Button>
                <Button type="button" variant="outline" className="flex-1 rounded-2xl" onClick={handleClose}>
                  閉じる
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* 中央の十字線 */}
        {!arError && isCameraActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <div className="h-1 w-16 border-t-2 border-white/50" />
            <div className="absolute h-16 w-1 border-l-2 border-white/50" />
          </div>
        )}
      </div>
    </div>
  )
}
