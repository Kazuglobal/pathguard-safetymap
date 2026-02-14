"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  type ARError,
  createARError,
  CAMERA_IDEAL_WIDTH,
  CAMERA_IDEAL_HEIGHT,
} from "@/lib/ar-constants"

export interface UseARCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isCameraActive: boolean
  isLoading: boolean
  loadingStep: string
  estimatedFov: number | null
  cameraPermission: boolean
  error: ARError | null
  stopCamera: () => void
  retry: () => void
}

export function useARCamera(): UseARCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadingStep, setLoadingStep] = useState<string>("カメラを初期化しています...")
  const [estimatedFov, setEstimatedFov] = useState<number | null>(null)
  const [cameraPermission, setCameraPermission] = useState(false)
  const [error, setError] = useState<ARError | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const initCamera = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setLoadingStep("カメラを初期化しています...")

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(createARError("camera_unavailable"))
      setIsLoading(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: CAMERA_IDEAL_WIDTH },
          height: { ideal: CAMERA_IDEAL_HEIGHT },
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsCameraActive(true)
        setCameraPermission(true)

        try {
          const videoTrack = stream.getVideoTracks()[0]
          const capabilities = videoTrack.getCapabilities?.() as MediaTrackCapabilities & {
            fieldOfView?: { min: number; max: number }
          }
          if (capabilities?.fieldOfView) {
            setEstimatedFov(
              (capabilities.fieldOfView.min + capabilities.fieldOfView.max) / 2
            )
          }
        } catch {
          // 視野角取得に失敗してもデフォルト値を使用
        }

        setError(null)
      }
    } catch (err) {
      const cameraErr = err as Error & { name?: string }

      if (cameraErr.name === "NotAllowedError" || cameraErr.name === "PermissionDeniedError") {
        setError(createARError("camera_denied"))
      } else if (cameraErr.name === "NotFoundError" || cameraErr.name === "DevicesNotFoundError") {
        setError(createARError("camera_unavailable"))
      } else if (cameraErr.name === "NotReadableError" || cameraErr.name === "TrackStartError") {
        setError(createARError("camera_unavailable"))
      } else {
        setError(createARError("unknown", `カメラエラー: ${cameraErr.message}`))
      }
      setIsCameraActive(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const retry = useCallback(() => {
    stopCamera()
    setIsCameraActive(false)
    initCamera()
  }, [stopCamera, initCamera])

  useEffect(() => {
    initCamera()

    return () => {
      stopCamera()
    }
  }, [initCamera, stopCamera])

  return {
    videoRef,
    isCameraActive,
    isLoading,
    loadingStep,
    estimatedFov,
    cameraPermission,
    error,
    stopCamera,
    retry,
  }
}
