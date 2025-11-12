"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { AlertTriangle, X, Navigation, MapPin, AlertCircle } from "lucide-react"
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
          (hazard.relativeAngle / fov) * canvas.width * 0.8 // 画面幅の80%を視野角に使用
        const screenY = centerY - hazard.distance * 0.5 // 距離に応じてY位置を調整

        // 画面外の場合は描画しない
        if (
          screenX < 0 ||
          screenX > canvas.width ||
          screenY < 0 ||
          screenY > canvas.height
        ) {
          return
        }

        // 危険個所のアイコンと情報を描画
        drawHazardMarker(ctx, screenX, screenY, hazard)
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

  // 危険個所マーカーの描画
  const drawHazardMarker = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    hazard: ARHazardData
  ) => {
    const { report, distance } = hazard

    // アイコンのサイズ（距離に応じて調整）
    const iconSize = Math.max(30, 60 - distance / 10)
    const iconRadius = iconSize / 2

    // 危険レベルに応じた色
    const colors = {
      1: "#3b82f6", // 低危険度: 青
      2: "#f59e0b", // 中危険度: オレンジ
      3: "#ef4444", // 高危険度: 赤
    }
    const color = colors[report.danger_level as keyof typeof colors] || colors[1]

    // 背景円を描画
    ctx.beginPath()
    ctx.arc(x, y, iconRadius, 0, Math.PI * 2)
    ctx.fillStyle = color + "80" // 透明度50%
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.stroke()

    // アイコンを描画（簡易版: 三角形）
    ctx.beginPath()
    ctx.moveTo(x, y - iconRadius * 0.6)
    ctx.lineTo(x - iconRadius * 0.5, y + iconRadius * 0.4)
    ctx.lineTo(x + iconRadius * 0.5, y + iconRadius * 0.4)
    ctx.closePath()
    ctx.fillStyle = "#ffffff"
    ctx.fill()

    // 距離テキストを描画
    ctx.fillStyle = "#ffffff"
    ctx.font = "bold 14px sans-serif"
    ctx.textAlign = "center"
    ctx.textBaseline = "top"
    ctx.fillText(formatDistance(distance), x, y + iconRadius + 5)

    // タイトルを描画（短縮版）
    const title = report.title.length > 15 ? report.title.substring(0, 15) + "..." : report.title
    ctx.font = "12px sans-serif"
    ctx.fillText(title, x, y + iconRadius + 25)
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

        {/* 情報パネル */}
        {!error && isCameraActive && userLocation && (
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-4">
            <div className="mb-2 text-center text-sm text-white">
              {arHazards.length > 0 ? (
                <span>
                  {arHazards.length}件の危険個所が近くにあります
                </span>
              ) : (
                <span>近くに危険個所はありません</span>
              )}
            </div>

            {/* 危険個所リスト */}
            {arHazards.length > 0 && (
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {arHazards.slice(0, 5).map((hazard) => (
                  <Card
                    key={hazard.report.id}
                    className="bg-white/95 p-3 backdrop-blur-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <AlertTriangle
                            className={`h-4 w-4 ${
                              hazard.report.danger_level === 3
                                ? "text-red-500"
                                : hazard.report.danger_level === 2
                                  ? "text-orange-500"
                                  : "text-blue-500"
                            }`}
                          />
                          <h4 className="font-semibold text-sm">
                            {hazard.report.title}
                          </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                          <Badge variant="outline" className="text-xs">
                            {formatDistance(hazard.distance)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {formatBearing(hazard.bearing)}
                          </Badge>
                          {hazard.report.danger_type && (
                            <Badge variant="secondary" className="text-xs">
                              {hazard.report.danger_type}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
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

