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
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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

export default function ARView({ reports, onClose }: ARViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [userLocation, setUserLocation] = useState<{
    lat: number
    lon: number
  } | null>(null)
  const [userHeading, setUserHeading] = useState<number>(0)
  const [arHazards, setArHazards] = useState<ARHazardData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const animationFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // カメラの初期化
  useEffect(() => {
    const initCamera = async () => {
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
          setError(null)
        }
      } catch (err) {
        console.error("カメラアクセスエラー:", err)
        setError("カメラへのアクセスが拒否されました。設定を確認してください。")
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
  }, [])

  // 位置情報の取得
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("位置情報サービスが利用できません。")
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        })
        setError(null)
      },
      (err) => {
        console.error("位置情報エラー:", err)
        setError("位置情報の取得に失敗しました。")
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000,
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [])

  // デバイスの向きの取得
  useEffect(() => {
    if (typeof window === "undefined" || !window.DeviceOrientationEvent) {
      // デバイス向きAPIが利用できない場合、コンパスAPIを試す
      if (navigator.compass) {
        // 非標準API（一部のブラウザのみ）
        return
      }
      // フォールバック: 位置情報から計算（移動方向を推定）
      return
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        // alpha: 0-360度（Z軸周りの回転、コンパス方向）
        setUserHeading(event.alpha)
      }
    }

    // 許可を求める（iOS 13+）
    const DeviceOrientationEventWithPermission = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<PermissionState>
    }
    
    if (
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEventWithPermission.requestPermission === "function"
    ) {
      DeviceOrientationEventWithPermission
        .requestPermission()
        .then((response: PermissionState) => {
          if (response === "granted") {
            window.addEventListener("deviceorientation", handleOrientation)
          }
        })
        .catch((err: Error) => {
          console.error("デバイス向きの許可エラー:", err)
        })
    } else {
      window.addEventListener("deviceorientation", handleOrientation)
    }

    return () => {
      window.removeEventListener("deviceorientation", handleOrientation)
    }
  }, [])

  // AR危険個所データの計算
  useEffect(() => {
    if (!userLocation || reports.length === 0) {
      setArHazards([])
      return
    }

    const hazards = calculateARHazardData(
      userLocation.lat,
      userLocation.lon,
      userHeading,
      reports,
      500 // 最大500m以内の危険個所を表示
    )

    setArHazards(hazards)
  }, [userLocation, userHeading, reports])

  // キャンバスへの描画
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !isCameraActive) {
      return
    }

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext("2d")

    if (!ctx) return

    const draw = () => {
      // キャンバスサイズをビデオサイズに合わせる
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720

      // ビデオフレームを描画
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // AR危険個所を描画
      arHazards.forEach((hazard) => {
        // 画面中央を原点として、相対角度に基づいて位置を計算
        const centerX = canvas.width / 2
        const centerY = canvas.height / 2

        // 視野角を考慮して、画面内の位置を計算
        const fov = 60 // 視野角（度）
        const screenX =
          centerX +
          (hazard.relativeAngle / fov) * canvas.width * 0.7 // 画面幅の70%を視野角に使用
        
        // Y位置は距離に応じて調整（遠いほど下に）
        const maxDistance = 500 // 最大表示距離
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

    draw()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isCameraActive, arHazards])

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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* ヘッダー */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-white" />
          <h2 className="text-lg font-semibold text-white">AR危険個所ビュー</h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

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

        {/* ローディング状態 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-center text-white">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-white border-t-transparent mx-auto" />
              <p>カメラを初期化しています...</p>
            </div>
          </div>
        )}

        {/* エラー状態 */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-4">
            <Card className="max-w-md p-6">
              <div className="mb-4 flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <h3 className="font-semibold">エラー</h3>
              </div>
              <p className="mb-4 text-sm text-gray-700">{error}</p>
              <Button onClick={handleClose} className="w-full">
                閉じる
              </Button>
            </Card>
          </div>
        )}

        {/* 上部の主要危険地点カード */}
        {!error && isCameraActive && userLocation && primaryHazard && (
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
        {!error && isCameraActive && userLocation && secondaryHazard && (
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
        {!error && isCameraActive && userLocation && arHazards.length === 0 && (
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
        {!error && isCameraActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-1 w-16 border-t-2 border-white/50" />
            <div className="absolute h-16 w-1 border-l-2 border-white/50" />
          </div>
        )}
      </div>
    </div>
  )
}

