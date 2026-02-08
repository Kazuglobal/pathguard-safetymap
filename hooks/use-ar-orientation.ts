"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { throttle, ORIENTATION_THROTTLE_MS } from "@/lib/ar-constants"

export interface UseAROrientationReturn {
  userHeading: number
  orientationPermission: boolean
  retry: () => void
}

export function useAROrientation(): UseAROrientationReturn {
  const [userHeading, setUserHeading] = useState<number>(0)
  const [orientationPermission, setOrientationPermission] = useState(false)
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
    cleanup()

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
            toastRef.current({
              title: "方向検出が許可されていません",
              description: "設定から許可を有効にすると精度が向上します",
            })
          }
        })
        .catch(() => {
          toastRef.current({
            title: "方向検出の設定に失敗しました",
            description: "危険個所は表示されますが、方向の精度が低くなります",
          })
        })
    } else {
      setupOrientationListener()
    }
  }, [cleanup])

  useEffect(() => {
    initOrientation()
    return cleanup
  }, [initOrientation, cleanup])

  return { userHeading, orientationPermission, retry: initOrientation }
}
