"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import {
  AlertTriangle,
  X,
  Navigation,
  MapPin,
  AlertCircle,
  Phone,
  Building2,
  Bookmark,
  Share2,
  TreePine,
  Star,
  ArrowRight,
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
import { useToast } from "@/components/ui/use-toast"

interface ARViewProps {
  reports: DangerReport[]
  onClose: () => void
}

// パフォーマンス最適化: throttle関数
function throttle<T extends (...args: never[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

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
  const [headingAccuracy, setHeadingAccuracy] = useState<number | null>(null)
  const [arError, setArError] = useState<ARError | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStep, setLoadingStep] = useState<string>("カメラを初期化しています...")

  // 設定関連のstate
  const [maxDistance, setMaxDistance] = useState<number>(500)
  const [showSettings, setShowSettings] = useState(false)
  const [fov, setFov] = useState<number>(60)

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
            width: { ideal: 1280 },
            height: { ideal: 720 },
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
            console.log("カメラの視野角を取得できませんでした。デフォルト値(60°)を使用します。")
          }

          setArError(null)
        }
      } catch (err) {
        console.error("カメラアクセスエラー:", err)
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
        console.error("位置情報エラー:", err)
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
        maximumAge: 2000,
        timeout: 10000,
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
      console.warn("DeviceOrientationEvent is not supported")
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

        // 精度情報があれば更新
        if ("webkitCompassAccuracy" in event) {
          setHeadingAccuracy((event as DeviceOrientationEvent & { webkitCompassAccuracy?: number }).webkitCompassAccuracy ?? null)
        }
      }
    }, 33)

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
          console.error("デバイス向きの許可エラー:", err)
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
      maxDistance // 設定可能な最大表示距離
    )
  }, [userLocation, userHeading, reports, maxDistance])

  // キャンバスへの描画（パフォーマンス最適化版）
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !isCameraActive) {
      return
    }

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    // 描画のフレームレート制御（30fpsに制限）
    let lastDrawTime = 0
    const targetFps = 30
    const frameInterval = 1000 / targetFps

    const draw = (timestamp: number) => {
      // フレームレート制御
      if (timestamp - lastDrawTime < frameInterval) {
        animationFrameRef.current = requestAnimationFrame(draw)
        return
      }
      lastDrawTime = timestamp

      // キャンバスサイズをビデオサイズに合わせる（変更時のみ）
      const videoWidth = video.videoWidth || 1280
      const videoHeight = video.videoHeight || 720
      if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
        canvas.width = videoWidth
        canvas.height = videoHeight
      }

      // ビデオフレームを描画
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // AR危険個所を描画
      arHazards.forEach((hazard) => {
        // 画面中央を原点として、相対角度に基づいて位置を計算
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2

        // 視野角を考慮して、画面内の位置を計算（設定から取得）
        const screenX =
          centerX +
          (hazard.relativeAngle / fov) * canvas.width * 0.7 // 画面幅の70%を視野角に使用

        // Y位置は距離に応じて調整（遠いほど下に）
        const normalizedDistance = Math.min(hazard.distance / maxDistance, 1)
        const screenY = centerY + (normalizedDistance - 0.3) * canvas.height * 0.4

        // 画面外の場合は描画しない（X方向のみチェック、Yは道路まで表示）
        if (screenX < -50 || screenX > canvas.width + 50) {
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
  }, [isCameraActive, arHazards, fov, maxDistance])

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
    const roadY = canvasHeight * 0.85 // 画面の85%の位置を道路と仮定
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
    const walkingSpeedKmh = 4 // 時速4km
    const timeInHours = distance / 1000 / walkingSpeedKmh
    return Math.round(timeInHours * 60) // 分に変換
  }

  // 危険度に応じた評価を計算（簡易版）
  const getDangerRating = (level: number): number => {
    // 危険度1-5を評価4.0-2.0に変換（逆相関）
    return Math.max(2.0, 5.0 - level * 0.6)
  }

  // 混雑状況を取得（簡易版）
  const getCrowdStatus = (distance: number): string => {
    if (distance < 50) return "混雑"
    if (distance < 200) return "やや混雑"
    return "空いている"
  }

  // 危険度に応じた混雑状況の色を取得
  const getCrowdStatusColor = (distance: number): string => {
    if (distance < 50) return "text-red-600"
    if (distance < 200) return "text-orange-600"
    return "text-green-600"
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
                min={100}
                max={1000}
                step={50}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>100m</span>
                <span>1000m</span>
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
                min={40}
                max={90}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>40°</span>
                <span>90°</span>
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

      {/* 精度インジケーター（左上） */}
      {isCameraActive && userLocation && !arError && (
        <div className="absolute top-16 left-4 z-20">
          <div className="bg-black/60 backdrop-blur-sm rounded-lg p-2 text-white text-xs">
            <div className="flex items-center gap-2 mb-1">
              <Compass className="h-3 w-3" />
              <span>方向: {Math.round(userHeading)}°</span>
              {headingAccuracy !== null && (
                <span className="text-gray-400">(±{Math.round(headingAccuracy)}°)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              <span>
                GPS精度: {userLocation.accuracy ? `±${Math.round(userLocation.accuracy)}m` : "不明"}
              </span>
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
                {/* 画像 */}
                {primaryHazard.report.image_url ? (
                  <div className="relative h-48 w-full overflow-hidden">
                    <img
                      src={primaryHazard.report.image_url}
                      alt={primaryHazard.report.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="relative h-48 w-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                    <AlertTriangle className="h-16 w-16 text-gray-400" />
                  </div>
                )}

                <div className="p-4">
                  {/* タイトル */}
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {primaryHazard.report.title}
                  </h3>

                  {/* 評価とカテゴリ */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-semibold text-gray-900">
                        {getDangerRating(primaryHazard.report.danger_level).toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">
                        ({Math.floor(primaryHazard.distance / 10)})
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">·</span>
                    <Badge variant="secondary" className="text-xs">
                      {primaryHazard.report.danger_type || "危険箇所"}
                    </Badge>
                  </div>

                  {/* 混雑状況 */}
                  <p className={`text-sm font-medium mb-3 ${getCrowdStatusColor(primaryHazard.distance)}`}>
                    {getCrowdStatus(primaryHazard.distance)}
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

        {/* 下部の次の危険地点カード */}
        {!arError && isCameraActive && userLocation && secondaryHazard && (
          <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
            <Card className="bg-white rounded-t-3xl shadow-2xl m-0 pointer-events-auto">
              <div className="p-4">
                <h4 className="text-base font-semibold text-gray-900 mb-3 truncate">
                  {secondaryHazard.report.title}
                </h4>

                {/* アクションボタン */}
                <div className="flex items-center justify-around gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 flex-col h-auto py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Phone className="h-4 w-4 mb-1" />
                    <span>通報</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 flex-col h-auto py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Building2 className="h-4 w-4 mb-1" />
                    <span>詳細</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 flex-col h-auto py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Bookmark className="h-4 w-4 mb-1" />
                    <span>保存</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 flex-col h-auto py-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                  >
                    <Share2 className="h-4 w-4 mb-1" />
                    <span>共有</span>
                  </Button>
                </div>

                {/* 距離情報 */}
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-xs text-gray-600">
                  <span>{formatDistance(secondaryHazard.distance)}</span>
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

