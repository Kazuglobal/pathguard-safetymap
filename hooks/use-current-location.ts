"use client"

import { useState, useCallback, useRef } from "react"
import { useToast } from "@/components/ui/use-toast"
import { LOCATION_MAX_AGE_MS, LOCATION_TIMEOUT_MS } from "@/lib/ar-constants"

export type CurrentLocationErrorType =
  | "permission_denied"
  | "position_unavailable"
  | "timeout"
  | "not_supported"

export interface CurrentLocationError {
  type: CurrentLocationErrorType
  message: string
}

export interface UseCurrentLocationReturn {
  /** [longitude, latitude] matching selectedLocation format, or null */
  location: [number, number] | null
  isLoading: boolean
  error: CurrentLocationError | null
  /** Trigger a one-shot getCurrentPosition call */
  requestLocation: () => void
  /** Reset state to initial */
  reset: () => void
}

const ERROR_MESSAGES: Record<CurrentLocationErrorType, string> = {
  permission_denied:
    "位置情報へのアクセスが拒否されました。設定から許可してください。",
  position_unavailable:
    "位置情報を取得できません。GPS信号を確認してください。",
  timeout:
    "位置情報の取得がタイムアウトしました。GPS信号が弱い可能性があります。",
  not_supported:
    "このブラウザは位置情報をサポートしていません。",
}

export function useCurrentLocation(): UseCurrentLocationReturn {
  const [location, setLocation] = useState<[number, number] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<CurrentLocationError | null>(null)
  const { toast } = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast
  const isLoadingRef = useRef(false)

  const requestLocation = useCallback(() => {
    if (isLoadingRef.current) return

    if (!navigator.geolocation) {
      const err: CurrentLocationError = {
        type: "not_supported",
        message: ERROR_MESSAGES.not_supported,
      }
      setError(err)
      toastRef.current({
        title: "位置情報エラー",
        description: err.message,
        variant: "destructive",
      })
      return
    }

    isLoadingRef.current = true
    setIsLoading(true)
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation([position.coords.longitude, position.coords.latitude])
        setIsLoading(false)
        isLoadingRef.current = false
        setError(null)
      },
      (err) => {
        let errorType: CurrentLocationErrorType
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorType = "permission_denied"
            break
          case err.POSITION_UNAVAILABLE:
            errorType = "position_unavailable"
            break
          case err.TIMEOUT:
            errorType = "timeout"
            break
          default:
            errorType = "position_unavailable"
        }
        const locError: CurrentLocationError = {
          type: errorType,
          message: ERROR_MESSAGES[errorType],
        }
        setError(locError)
        setIsLoading(false)
        isLoadingRef.current = false
        toastRef.current({
          title: "位置情報エラー",
          description: locError.message,
          variant: "destructive",
        })
      },
      {
        enableHighAccuracy: true,
        maximumAge: LOCATION_MAX_AGE_MS,
        timeout: LOCATION_TIMEOUT_MS,
      }
    )
  }, [])

  const reset = useCallback(() => {
    setLocation(null)
    setError(null)
    setIsLoading(false)
    isLoadingRef.current = false
  }, [])

  return { location, isLoading, error, requestLocation, reset }
}
