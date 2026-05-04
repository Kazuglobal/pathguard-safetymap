"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { createARError, throttle, ORIENTATION_THROTTLE_MS, type ARError } from "@/lib/ar-constants"

export interface UseAROrientationReturn {
  userHeading: number
  orientationPermission: boolean
  error: ARError | null
  retry: () => void
}

interface UseAROrientationInput {
  enabled?: boolean
}

export function useAROrientation({ enabled = true }: UseAROrientationInput = {}): UseAROrientationReturn {
  const [userHeading, setUserHeading] = useState<number>(0)
  const [orientationPermission, setOrientationPermission] = useState(false)
  const [error, setError] = useState<ARError | null>(null)
  const orientationListenerRef = useRef<EventListener | null>(null)
  const throttledHandlerRef = useRef<ReturnType<typeof throttle<(event: DeviceOrientationEvent) => void>> | null>(null)
  const { toast } = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast

  const cleanup = useCallback(() => {
    if (orientationListenerRef.current) {
      window.removeEventListener("deviceorientation", orientationListenerRef.current)
      orientationListenerRef.current = null
    }
    if (throttledHandlerRef.current) {
      throttledHandlerRef.current.cancel()
      throttledHandlerRef.current = null
    }
  }, [])

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

    const setupOrientationListener = () => {
      const listener: EventListener = (event) => {
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
  }, [cleanup, enabled])

  useEffect(() => {
    if (!enabled) {
      cleanup()
      return
    }

    initOrientation()
    return cleanup
  }, [enabled, initOrientation, cleanup])

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

  return { userHeading, orientationPermission, error, retry: initOrientation }
}
