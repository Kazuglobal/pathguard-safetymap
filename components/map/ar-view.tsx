"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  X,
  Navigation,
  MapPin,
  AlertCircle,
  TreePine,
  Settings,
  Compass,
  RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import type { DangerReport } from "@/lib/types"
import {
  calculateARHazardData,
  formatDistance,
  formatBearing,
  type ARHazardData,
} from "@/lib/ar-utils"
import { getReportImages } from "@/lib/ar-image-utils"
import {
  translateDangerType,
  getDangerLevelLabel,
  getDangerLevelColor,
  formatHeadingDisplay,
} from "@/lib/ar-display-utils"
import { ARImageGallery } from "./ar-image-gallery"
import { useToast } from "@/components/ui/use-toast"

interface ARViewProps {
  reports: DangerReport[]
  onClose: () => void
}

// パフォーマンス最適化: throttle関数
type Throttled<T extends (...args: any[]) => void> = ((...args: Parameters<T>) => void) & {
  cancel: () => void
}

function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): Throttled<T> {
  let inThrottle = false
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const throttled = ((...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      timeoutId = setTimeout(() => {
        inThrottle = false
        timeoutId = null
      }, limit)
    }
  }) as Throttled<T>
  throttled.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = null
    inThrottle = false
  }
  return throttled
}

const DEFAULT_MAX_DISTANCE = 500
const DEFAULT_FOV = 60
const CAMERA_IDEAL_WIDTH = 1280
const CAMERA_IDEAL_HEIGHT = 720
const DRAW_TARGET_FPS = 30
const ORIENTATION_THROTTLE_MS = 33
const LOCATION_MAX_AGE_MS = 2000
const LOCATION_TIMEOUT_MS = 10000
const SCREEN_X_SCALE = 0.7
const SCREEN_Y_OFFSET = 0.3
const SCREEN_Y_SCALE = 0.4
const SCREEN_X_MARGIN = 50
const ROAD_Y_RATIO = 0.85
const MAX_ANGLE_DEGREES = 90
const WALKING_SPEED_KMH = 4
const DISTANCE_MIN = 100
const DISTANCE_MAX = 1000
const DISTANCE_STEP = 50
const FOV_MIN = 40
const FOV_MAX = 90
const FOV_STEP = 5

// エラータイプの定義
type ARErrorType =
  | "camera_denied"
  | "camera_unavailable"
  | "location_denied"
  | "location_unavailable"
  | "orientation_denied"
  | "orientation_unavailable"
  | "unknown"

interface ARError {
  type: ARErrorType
  message: string
  suggestion: string
}

export default function ARView({ reports, onClose }: ARViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [userLocation, setUserLocation] = useState<{
    lat: number
    lon: number
    accuracy?: number
  } | null>(null)
  const [userHeading, setUserHeading] = useState<number>(0)
  const [arError, setArError] = useState<ARError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStep, setLoadingStep] = useState<string>("カメラを初期化しています...")

  // 設定関連のstate
  const [maxDistance, setMaxDistance] = useState<number>(DEFAULT_MAX_DISTANCE)
  const [showSettings, setShowSettings] = useState(false)
  const [fov, setFov] = useState<number>(DEFAULT_FOV)

  // パーミッション状態
  const [permissions, setPermissions] = useState({
    camera: false,
    location: false,
    orientation: false,
  })

  const { toast } = useToast()
  const animationFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const lastHeadingUpdateRef = useRef<number>(0)
  const isDev = process.env.NODE_ENV === "development"

  // エラーヘルパー関数
  const setError = useCallback((type: ARErrorType, customMessage?: string) => {
    const errorMessages: Record<ARErrorType, ARError> = {
      camera_denied: {
        type: "camera_denied",
        message: "カメラへのアクセスが拒否されました",
        suggestion:
          "設定アプリを開き、このサイトのカメラ許可を有効にしてください。\niOS: 設定 > Safari > カメラ\nAndroid: 設定 > サイトの設定 > カメラ",
      },
      camera_unavailable: {
        type: "camera_unavailable",
        message: "カメラが利用できません",
        suggestion:
          "背面カメラが搭載されていないか、他のアプリで使用中です。他のアプリを閉じてお試しください。",
      },
      location_denied: {
        type: "location_denied",
        message: "位置情報へのアクセスが拒否されました",
        suggestion:
          "設定アプリを開き、位置情報サービスを有効にしてください。\niOS: 設定 > プライバシー > 位置情報サービス\nAndroid: 設定 > 位置情報",
      },
      location_unavailable: {
        type: "location_unavailable",
        message: "位置情報を取得できません",
        suggestion:
          "GPS信号が弱い可能性があります。屋外に出るか、窓際で試してください。",
      },
      orientation_denied: {
        type: "orientation_denied",
        message: "デバイスの向き検出が拒否されました",
        suggestion:
          "方向検出なしでも利用可能ですが、精度が低下します。設定から許可を有効にすることをお勧めします。",
      },
      orientation_unavailable: {
        type: "orientation_unavailable",
        message: "デバイスの向き検出がサポートされていません",
        suggestion:
          "お使いのデバイスはコンパス機能に対応していません。危険個所は表示されますが、方向の精度が低くなります。",
      },
      unknown: {
        type: "unknown",
        message: customMessage || "予期しないエラーが発生しました",
        suggestion: "ページを再読み込みするか、しばらくしてからお試しください。",
      },
    }
    setArError(errorMessages[type])
  }, [])

  // カメラの初期化（エラーハンドリング強化）
  useEffect(() => {
    const initCamera = async () => {
      setLoadingStep("カメラを初期化しています...")

      // MediaDevices APIが利用可能か確認
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError("camera_unavailable")
        setIsLoading(false)
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment", // 背面カメラを使用
            width: { ideal: CAMERA_IDEAL_WIDTH },
            height: { ideal: CAMERA_IDEAL_HEIGHT },
          },
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
          setIsCameraActive(true)
          setPermissions((prev) => ({ ...prev, camera: true }))

          // カメラの視野角を取得（対応デバイスのみ）
          try {
            const videoTrack = stream.getVideoTracks()[0]
            const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & {
              // 非標準だが一部ブラウザでサポート
              fieldOfView?: { min: number; max: number }
            }
            if (capabilities?.fieldOfView) {
              const estimatedFov = (capabilities.fieldOfView.min + capabilities.fieldOfView.max) / 2
              setFov(estimatedFov)
            }
          } catch {
            // 視野角取得に失敗してもデフォルト値を使用
            if (isDev) {
              console.log(`カメラの視野角を取得できませんでした。デフォルト値(${DEFAULT_FOV}°)を使用します。`)
            }
          }

          setArError(null)
        }
      } catch (err) {
        if (isDev) {
          console.error("カメラアクセスエラー:", err)
        }
        const error = err as Error & { name?: string }

        if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
          setError("camera_denied")
        } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
          setError("camera_unavailable")
        } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
          setError("camera_unavailable")
        } else {
          setError("unknown", `カメラエラー: ${error.message}`)
        }
        setIsCameraActive(false)
      } finally {
        setIsLoading(false)
      }
    }

    initCamera()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [setError])

  // 位置情報の取得（エラーハンドリング強化）
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("location_unavailable")
      return
    }

    setLoadingStep("位置情報を取得しています...")

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
        setPermissions((prev) => ({ ...prev, location: true }))
        // 位置情報取得成功時にエラーをクリア（カメラエラー以外）
        if (arError?.type.startsWith("location")) {
          setArError(null)
        }
      },
      (err) => {
        if (isDev) {
          console.error("位置情報エラー:", err)
        }
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError("location_denied")
            break
          case err.POSITION_UNAVAILABLE:
            setError("location_unavailable")
            break
          case err.TIMEOUT:
            // タイムアウトの場合は警告を表示するがエラーにしない
            toast({
              title: "位置情報の取得に時間がかかっています",
              description: "GPS信号が弱い可能性があります",
              variant: "destructive",
            })
            break
          default:
            setError("location_unavailable")
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: LOCATION_MAX_AGE_MS,
        timeout: LOCATION_TIMEOUT_MS,
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [arError?.type, setError, toast])

  // デバイスの向きの取得（throttle処理追加、エラーハンドリング強化）
  useEffect(() => {
    setLoadingStep("デバイスの向きを検出しています...")

    if (typeof window === "undefined" || !window.DeviceOrientationEvent) {
      // デバイス向きAPIが利用できない場合
      if (isDev) {
        console.warn("DeviceOrientationEvent is not supported")
      }
      setPermissions((prev) => ({ ...prev, orientation: false }))
      // 致命的ではないのでエラーは設定しない（トーストで通知）
      toast({
        title: "方向検出が利用できません",
        description: "危険個所は表示されますが、方向の精度が低くなります",
      })
      return
    }

    // throttleされた向き更新ハンドラー（30fps相当 = 約33ms）
    const handleOrientation = throttle((event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        // alpha: 0-360度（Z軸周りの回転、コンパス方向）
        setUserHeading(event.alpha)
        lastHeadingUpdateRef.current = Date.now()
      }
    }, ORIENTATION_THROTTLE_MS)

    // 許可を求める（iOS 13+）
    const DeviceOrientationEventWithPermission = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<PermissionState>
    }

    const setupOrientationListener = () => {
      window.addEventListener("deviceorientation", handleOrientation as EventListener)
      setPermissions((prev) => ({ ...prev, orientation: true }))
    }

    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEventWithPermission.requestPermission === "function"
    ) {
      DeviceOrientationEventWithPermission
        .requestPermission()
        .then((response: PermissionState) => {
          if (response === "granted") {
            setupOrientationListener()
          } else {
            // 拒否されたが致命的ではない
            toast({
              title: "方向検出が許可されていません",
              description: "設定から許可を有効にすると精度が向上します",
            })
          }
        })
        .catch((err: Error) => {
          if (isDev) {
            console.error("デバイス向きの許可エラー:", err)
          }
          toast({
            title: "方向検出の設定に失敗しました",
            description: "危険個所は表示されますが、方向の精度が低くなります",
          })
        })
    } else {
      setupOrientationListener()
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation as EventListener)
      handleOrientation.cancel()
    }
  }, [toast])

  // AR危険個所データの計算（useMemoでメモ化してパフォーマンス最適化）
  const arHazards = useMemo(() => {
    if (!userLocation || reports.length === 0) {
      return []
    }

    return calculateARHazardData(
      userLocation.lat,
      userLocation.lon,
      userHeading,
      reports,
      {
        maxDistance, // 設定可能な最大表示距離
        maxAngle: MAX_ANGLE_DEGREES, // 前方90度以内のみ表示（通過した地点は非表示）
        showBehind: false,
      }
    )
  }, [userLocation, userHeading, reports, maxDistance])

  // キャンバスへの描画（パフォーマンス最適化版）
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !isCameraActive) {
      return
    }

    const canvas = canvasRef.current
    const video = videoRef.current
    // 描画のフレームレート制御（30fpsに制限）
    let lastDrawTime = 0
    const frameInterval = 1000 / DRAW_TARGET_FPS
    let stopped = false

    const draw = (timestamp: number) => {
      if (stopped) return
      // フレームレート制御
      if (timestamp - lastDrawTime < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }
      lastDrawTime = timestamp

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        setError("unknown", "キャンバスの描画コンテキストが失われました。")
        stopped = true
        return
      }

      // キャンバスサイズをビデオサイズに合わせる（変更時のみ）
      const videoWidth = video.videoWidth || CAMERA_IDEAL_WIDTH
      const videoHeight = video.videoHeight || CAMERA_IDEAL_HEIGHT
      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth
        canvas.height = videoHeight
      }

      // ビデオフレームを描画
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      } catch (err) {
        if (isDev) {
          console.error("キャンバス描画中にエラーが発生しました:", err)
        }
        setError("unknown", "キャンバス描画に失敗しました。再読み込みしてください。")
        stopped = true
        return
      }

      // AR危険個所を描画
      arHazards.forEach((hazard) => {
        // 画面中央を原点として、相対角度に基づいて位置を計算
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2

        // 視野角を考慮して、画面内の位置を計算（設定から取得）
        const screenX =
          centerX +
          (hazard.relativeAngle / fov) * canvas.width * SCREEN_X_SCALE // 画面幅の70%を視野角に使用

        // Y位置は距離に応じて調整（遠いほど下に）
        const safeMaxDistance = Math.max(1, maxDistance)
        const normalizedDistance = Math.min(hazard.distance / safeMaxDistance, 1)
        const screenY = centerY + (normalizedDistance - SCREEN_Y_OFFSET) * canvas.height * SCREEN_Y_SCALE

        // 画面外の場合は描画しない（X方向のみチェック、Yは道路まで表示）
        if (screenX < -SCREEN_X_MARGIN || screenX > canvas.width + SCREEN_X_MARGIN) {
          return
        }

        // 危険個所のアイコンと情報を描画
        drawHazardMarker(ctx, screenX, screenY, hazard, canvas.height)
      })

      animationFrameRef.current = requestAnimationFrame(draw)
    }

    animationFrameRef.current = requestAnimationFrame(draw)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isCameraActive, arHazards, fov, maxDistance, setError])

  // 危険個所マーカーの描画（改善版）
  const drawHazardMarker = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    hazard: ARHazardData,
    canvasHeight: number
  ) => {
    const { report, distance } = hazard

    // 画面下部（道路の位置）を基準にマーカーを配置
    const roadY = canvasHeight * ROAD_Y_RATIO // 画面の85%の位置を道路と仮定
    const markerY = Math.min(y, roadY - 20) // マーカーは道路より少し上

    // アイコンのサイズ（距離に応じて調整）
    const iconSize = Math.max(24, 48 - distance / 15)
    const iconRadius = iconSize / 2

    // 危険レベルに応じた色
    const colors = {
      1: "#22c55e", // 低危険度: 緑
      2: "#f59e0b", // 中危険度: オレンジ
      3: "#ef4444", // 高危険度: 赤
      4: "#dc2626", // 非常に高危険度: 濃い赤
      5: "#991b1b", // 極めて高危険度: 非常に濃い赤
    }
    const color = colors[report.danger_level as keyof typeof colors] || colors[1]

    // 道路からマーカーへの線を描画（白い線）
    ctx.beginPath()
    ctx.moveTo(x, roadY)
    ctx.lineTo(x, markerY)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)"
    ctx.lineWidth = 2
    ctx.setLineDash([5, 5]) // 破線
    ctx.stroke()
    ctx.setLineDash([]) // 破線をリセット

    // 背景円を描画（白い外枠付き）
    ctx.beginPath()
    ctx.arc(x, markerY, iconRadius + 2, 0, Math.PI * 2)
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
    ctx.fill()

    ctx.beginPath()
    ctx.arc(x, markerY, iconRadius, 0, Math.PI * 2)
    ctx.fillStyle = color + "CC" // 透明度80%
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.stroke()

    // アイコンを描画（警告マーク）
    ctx.beginPath()
    ctx.moveTo(x, markerY - iconRadius * 0.5)
    ctx.lineTo(x - iconRadius * 0.4, markerY + iconRadius * 0.3)
    ctx.lineTo(x + iconRadius * 0.4, markerY + iconRadius * 0.3)
    ctx.closePath()
    ctx.fillStyle = "#ffffff"
    ctx.fill()

    // 距離テキストを描画（背景付き）
    const distanceText = formatDistance(distance)
    ctx.font = "bold 12px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    
    const textMetrics = ctx.measureText(distanceText)
    const textWidth = textMetrics.width
    const textHeight = 16
    const padding = 4

    // テキスト背景を描画
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
    ctx.fillRect(
      x - textWidth / 2 - padding,
      markerY + iconRadius + 5,
      textWidth + padding * 2,
      textHeight
    )

    // テキストを描画
    ctx.fillStyle = "#ffffff"
    ctx.fillText(distanceText, x, markerY + iconRadius + 5 + padding)
  }

  // 最も近い危険地点と次の危険地点を取得
  const primaryHazard = useMemo(() => {
    return arHazards.length > 0 ? arHazards[0] : null
  }, [arHazards])

  const secondaryHazard = useMemo(() => {
    return arHazards.length > 1 ? arHazards[1] : null
  }, [arHazards])

  // 推定移動時間を計算（歩行速度4km/hを想定）
  const calculateEstimatedTime = (distance: number): number => {
    const walkingSpeedKmh = WALKING_SPEED_KMH // 時速4km
    const timeInHours = distance / 1000 / walkingSpeedKmh
    return Math.round(timeInHours * 60) // 分に変換
  }

  const handleClose = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    onClose()
  }, [onClose])

  // 再試行ハンドラー
  const handleRetry = useCallback(() => {
    setArError(null)
    setIsLoading(true)
    setLoadingStep("再初期化しています...")
    // ページを再読み込み（簡易的な再試行）
    window.location.reload()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* ヘッダー */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-white" />
          <h2 className="text-lg font-semibold text-white">AR危険個所ビュー</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* 設定ボタン */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className="text-white hover:bg-white/20"
          >
            <Settings className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* 設定パネル */}
      {showSettings && (
        <div className="absolute top-16 right-4 z-30 w-72">
          <Card className="bg-white/95 backdrop-blur-sm p-4 shadow-2xl">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">AR設定</h3>

            {/* 表示距離 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-600">表示距離</label>
                <span className="text-xs font-medium text-gray-900">{maxDistance}m</span>
              </div>
              <Slider
                value={[maxDistance]}
                onValueChange={(values) => setMaxDistance(values[0])}
                min={DISTANCE_MIN}
                max={DISTANCE_MAX}
                step={DISTANCE_STEP}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{DISTANCE_MIN}m</span>
                <span>{DISTANCE_MAX}m</span>
              </div>
            </div>

            {/* 視野角 */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-600">視野角</label>
                <span className="text-xs font-medium text-gray-900">{fov}°</span>
              </div>
              <Slider
                value={[fov]}
                onValueChange={(values) => setFov(values[0])}
                min={FOV_MIN}
                max={FOV_MAX}
                step={FOV_STEP}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{FOV_MIN}°</span>
                <span>{FOV_MAX}°</span>
              </div>
            </div>

            {/* パーミッション状態 */}
            <div className="pt-3 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-600 mb-2">パーミッション</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span>カメラ</span>
                  <span className={permissions.camera ? "text-green-600" : "text-red-600"}>
                    {permissions.camera ? "✓ 許可" : "✗ 未許可"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>位置情報</span>
                  <span className={permissions.location ? "text-green-600" : "text-red-600"}>
                    {permissions.location ? "✓ 許可" : "✗ 未許可"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>方向検出</span>
                  <span className={permissions.orientation ? "text-green-600" : "text-orange-600"}>
                    {permissions.orientation ? "✓ 許可" : "△ 未使用"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 方向インジケーター（左上） - 精度情報は非表示 */}
      {isCameraActive && userLocation && !arError && (
        <div className="absolute top-16 left-4 z-20">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg p-2 text-white text-xs">
            <div className="flex items-center gap-2">
              <Compass className="h-3 w-3" />
              <span>{formatHeadingDisplay(userHeading)}</span>
            </div>
          </div>
        </div>
      )}

      {/* カメラビュー */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ pointerEvents: "none" }}
        />

        {/* ローディング状態（改善版） */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="text-center text-white max-w-xs">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent mx-auto" />
              <p className="text-sm font-medium mb-2">{loadingStep}</p>
              <p className="text-xs text-gray-400">
                カメラと位置情報の許可が必要です
              </p>
            </div>
          </div>
        )}

        {/* エラー状態（改善版） */}
        {arError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <Card className="max-w-md p-6">
              <div className="mb-4 flex items-center gap-2 text-red-600">
                <AlertCircle className="h-6 w-6" />
                <h3 className="font-semibold text-lg">{arError.message}</h3>
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

        {/* 上部の主要危険地点カード */}
        {!arError && isCameraActive && userLocation && primaryHazard && (
          <div className="absolute top-20 left-4 right-4 z-20 pointer-events-none">
            <div 
              className="relative"
              style={{
                transform: "perspective(1000px) rotateX(5deg) rotateY(-5deg)",
                transformStyle: "preserve-3d",
              }}
            >
              <Card className="bg-white rounded-3xl shadow-2xl overflow-hidden pointer-events-auto">
                {/* 画像ギャラリー（登録された全ての画像を表示） */}
                <ARImageGallery
                  images={getReportImages(primaryHazard.report)}
                  alt={primaryHazard.report.title}
                />

                <div className="p-4">
                  {/* タイトル */}
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {primaryHazard.report.title}
                  </h3>

                  {/* 危険度とカテゴリ */}
                  <div className="flex items-center gap-3 mb-2">
                    {/* 危険度バッジ（色付き） */}
                    <Badge
                      className="text-xs text-white"
                      style={{ backgroundColor: getDangerLevelColor(primaryHazard.report.danger_level) }}
                    >
                      {getDangerLevelLabel(primaryHazard.report.danger_level)}
                    </Badge>
                    <span className="text-xs text-gray-500">·</span>
                    {/* カテゴリ（日本語） */}
                    <Badge variant="secondary" className="text-xs">
                      {translateDangerType(primaryHazard.report.danger_type)}
                    </Badge>
                  </div>

                  {/* 距離表示 */}
                  <p className="text-sm text-gray-600 mb-3">
                    {formatDistance(primaryHazard.distance)}先
                  </p>
                </div>
              </Card>

              {/* 方向指示（This way バブル） */}
              {Math.abs(primaryHazard.relativeAngle) > 15 && (
                <div 
                  className="absolute top-4 flex items-center gap-2 pointer-events-auto"
                  style={{
                    left: primaryHazard.relativeAngle > 0 ? "auto" : "16px",
                    right: primaryHazard.relativeAngle > 0 ? "16px" : "auto",
                  }}
                >
                  <MapPin className="h-4 w-4 text-red-500" />
                  <div className="bg-gray-800/95 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg">
                    {primaryHazard.relativeAngle > 0 ? "右方向" : "左方向"}
                  </div>
                </div>
              )}
            </div>

            {/* 距離と時間のマーカー（道路に接続、カードの外に配置） */}
            <div className="relative mt-4 pointer-events-auto">
              {/* カードからマーカーへの線（視覚的な接続） */}
              <div 
                className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-white/70"
                style={{
                  top: "-8px",
                  height: "40px",
                }}
              />
              
              {/* マーカー */}
              <div className="flex items-center justify-center gap-2 pt-8">
                <div className="bg-white rounded-full p-2 shadow-lg border-2 border-green-500">
                  <TreePine className="h-5 w-5 text-green-600" />
                </div>
                <div className="bg-black/90 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg">
                  {calculateEstimatedTime(primaryHazard.distance)}分
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 下部の次の危険地点カード（シンプル版） */}
        {!arError && isCameraActive && userLocation && secondaryHazard && (
          <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none">
            <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg pointer-events-auto">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">
                    {secondaryHazard.report.title}
                  </h4>
                </div>
                <div className="flex items-center gap-3 ml-3 text-xs text-gray-500">
                  <span className="font-medium">{formatDistance(secondaryHazard.distance)}</span>
                  <span>·</span>
                  <span>{formatBearing(secondaryHazard.bearing)}</span>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* 危険地点がない場合のメッセージ */}
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

        {/* 中央の十字線（ガイド） */}
        {!arError && isCameraActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-1 w-16 border-t-2 border-white/50" />
            <div className="absolute h-16 w-1 border-l-2 border-white/50" />
          </div>
        )}
      </div>
    </div>
  )
}

