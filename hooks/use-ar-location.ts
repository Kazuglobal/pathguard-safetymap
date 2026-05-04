"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useToast } from "@/components/ui/use-toast"
import {
  type ARError,
  createARError,
  LOCATION_MAX_AGE_MS,
  LOCATION_TIMEOUT_MS,
} from "@/lib/ar-constants"

export interface UserLocation {
  lat: number
  lon: number
  accuracy?: number
  speed?: number | null
}

export interface UseARLocationReturn {
  userLocation: UserLocation | null
  locationPermission: boolean
  error: ARError | null
  retry: () => void
}

interface UseARLocationInput {
  enabled?: boolean
}

export function useARLocation({ enabled = true }: UseARLocationInput = {}): UseARLocationReturn {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationPermission, setLocationPermission] = useState(false)
  const [error, setError] = useState<ARError | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const { toast } = useToast()
  const toastRef = useRef(toast)
  toastRef.current = toast

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const startWatch = useCallback(() => {
    if (!enabled) return

    stopWatch()
    setError(null)

    if (!navigator.geolocation) {
      setError(createARError("location_unavailable"))
      return
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy,
          speed: position.coords.speed,
        })
        setLocationPermission(true)
        setError(null)
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError(createARError("location_denied"))
            break
          case err.POSITION_UNAVAILABLE:
            setError(createARError("location_unavailable"))
            break
          case err.TIMEOUT:
            toastRef.current({
              title: "位置情報の取得に時間がかかっています",
              description: "GPS信号が弱い可能性があります",
              variant: "destructive",
            })
            break
          default:
            setError(createARError("location_unavailable"))
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: LOCATION_MAX_AGE_MS,
        timeout: LOCATION_TIMEOUT_MS,
      }
    )
  }, [enabled, stopWatch])

  useEffect(() => {
    if (!enabled) {
      stopWatch()
      return
    }

    startWatch()
    return () => {
      stopWatch()
    }
  }, [enabled, startWatch, stopWatch])

  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopWatch()
      } else {
        startWatch()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [enabled, startWatch, stopWatch])

  return { userLocation, locationPermission, error, retry: startWatch }
}
