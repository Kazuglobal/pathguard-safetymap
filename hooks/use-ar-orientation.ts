"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { createARError, throttle, ORIENTATION_THROTTLE_MS, type ARError } from "@/lib/ar-constants"
import { isTiltFresh, isValidTilt, TILT_STALE_MS, type DeviceTilt } from "@/lib/ar-water-geometry"

export interface UseAROrientationReturn {
  userHeading: number
  orientationPermission: boolean
  /** 最新の有効な端末の傾き。無効・期限切れでは null になる。 */
  tiltRef: React.RefObject<DeviceTilt | null>
  /** 傾きを表示に使える状態か。許可やリスナー登録とは区別する。 */
  tiltReady: boolean
  error: ARError | null
  retry: () => void
}

const TILT_CHECK_INTERVAL_MS = 250

function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()
}

function currentScreenAngle(): number {
  if (typeof window === "undefined") return 0
  const angle = window.screen?.orientation?.angle
  if (typeof angle === "number") return angle
  const legacy = (window as Window & { orientation?: number }).orientation
  return typeof legacy === "number" ? legacy : 0
}

interface UseAROrientationInput {
  enabled?: boolean
}

export function useAROrientation({ enabled = true }: UseAROrientationInput = {}): UseAROrientationReturn {
  const [userHeading, setUserHeading] = useState<number>(0)
  const [orientationPermission, setOrientationPermission] = useState(false)
  const [error, setError] = useState<ARError | null>(null)
  const tiltRef = useRef<DeviceTilt | null>(null)
  const [tiltReady, setTiltReady] = useState(false)
  const tiltReadyRef = useRef(false)
  const orientationListenerRef = useRef<EventListener | null>(null)
  const throttledHandlerRef = useRef<ReturnType<typeof throttle<(event: DeviceOrientationEvent) => void>> | null>(null)
  const { toast } = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast

  // 有効・無効の遷移時だけ state を更新する(センサー更新ごとに再描画しない)
  const applyTiltReady = useCallback((ready: boolean) => {
    if (tiltReadyRef.current === ready) return
    tiltReadyRef.current = ready
    setTiltReady(ready)
  }, [])

  const resetTilt = useCallback(() => {
    tiltRef.current = null
    applyTiltReady(false)
  }, [applyTiltReady])

  const cleanup = useCallback(() => {
    resetTilt()
    if (orientationListenerRef.current) {
      window.removeEventListener("deviceorientation", orientationListenerRef.current)
      orientationListenerRef.current = null
    }
    if (throttledHandlerRef.current) {
      throttledHandlerRef.current.cancel()
      throttledHandlerRef.current = null
    }
  }, [resetTilt])

  const initOrientation = useCallback(() => {
    if (!enabled) return

    cleanup()
    setError(null)

    if (typeof window === "undefined" || !window.DeviceOrientationEvent) {
      toastRef.current({
        title: "方向検出が利用できません",
        description: "危険個所は表示されますが、方向の精度が低くなります",
      })
      return
    }

    const handleOrientation = throttle((event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        setUserHeading(event.alpha)
      }
    }, ORIENTATION_THROTTLE_MS)
    throttledHandlerRef.current = handleOrientation

    const DeviceOrientationEventWithPermission = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<PermissionState>
    }

    // 傾きは throttle を通さずに ref へ書く。無効値の受信を取り落とさないため。
    // state は有効・無効の遷移時だけ更新する。
    const handleTilt = (event: DeviceOrientationEvent) => {
      const candidate = { beta: event.beta as number, gamma: event.gamma as number, screenAngle: currentScreenAngle(), timestamp: nowMs() }
      if (isValidTilt(candidate)) {
        tiltRef.current = candidate
        applyTiltReady(true)
      } else {
        resetTilt()
      }
    }

    const setupOrientationListener = () => {
      const listener: EventListener = (event) => {
        handleTilt(event as DeviceOrientationEvent)
        handleOrientation(event as DeviceOrientationEvent)
      }
      orientationListenerRef.current = listener
      window.addEventListener("deviceorientation", listener)
      setOrientationPermission(true)
      setError(null)
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
            setOrientationPermission(false)
            setError(createARError("orientation_denied"))
            toastRef.current({
              title: "方向検出が許可されていません",
              description: "親子モードでは通常マップで確認してください",
            })
          }
        })
        .catch(() => {
          setOrientationPermission(false)
          setError(createARError("orientation_denied"))
          toastRef.current({
            title: "方向検出の設定に失敗しました",
            description: "親子モードでは通常マップで確認してください",
          })
        })
    } else {
      setupOrientationListener()
    }
  }, [applyTiltReady, cleanup, enabled, resetTilt])

  useEffect(() => {
    if (!enabled) {
      cleanup()
      return
    }

    initOrientation()
    return cleanup
  }, [enabled, initOrientation, cleanup])

  // イベントが来なくなった場合も、有効値の最終受信から TILT_STALE_MS で期限切れにする。
  useEffect(() => {
    if (!enabled) {
      resetTilt()
      return
    }

    const timer = setInterval(() => {
      if (tiltRef.current && !isTiltFresh(tiltRef.current, nowMs(), TILT_STALE_MS)) {
        resetTilt()
      }
    }, TILT_CHECK_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [enabled, resetTilt])

  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        cleanup()
      } else {
        initOrientation()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled, initOrientation, cleanup])

  return { userHeading, orientationPermission, tiltRef, tiltReady, error, retry: initOrientation }
}
