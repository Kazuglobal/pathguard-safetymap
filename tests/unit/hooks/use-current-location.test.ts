/**
 * useCurrentLocation フックのユニットテスト
 *
 * 「現在地で報告」機能のための一回限りのGPS取得フック。
 * getCurrentPosition を使用し、[longitude, latitude] 形式で返す。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useCurrentLocation } from "@/hooks/use-current-location"

// toast モック（use-ar-location.test.ts と同パターン）
const toastMock = vi.hoisted(() => {
  const state = { current: vi.fn() }
  const useToast = vi.fn(() => ({ toast: state.current }))
  return { state, useToast }
})
vi.mock("@/components/ui/use-toast", () => ({
  useToast: toastMock.useToast,
}))

// getCurrentPosition モック
type SuccessCallback = (position: GeolocationPosition) => void
type ErrorCallback = (error: GeolocationPositionError) => void

let capturedSuccessCallback: SuccessCallback | null = null
let capturedErrorCallback: ErrorCallback | null = null

const mockGetCurrentPosition = vi.fn(
  (success: SuccessCallback, error: ErrorCallback) => {
    capturedSuccessCallback = success
    capturedErrorCallback = error
  }
)

function createMockPosition(
  lat: number,
  lon: number,
  accuracy = 10
): GeolocationPosition {
  const coords = {
    latitude: lat,
    longitude: lon,
    accuracy,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON() {
      return this
    },
  }
  return {
    coords,
    timestamp: Date.now(),
  } as GeolocationPosition
}

function createMockGeolocationError(
  code: number
): GeolocationPositionError {
  return {
    code,
    message: "Mock error",
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  }
}

describe("useCurrentLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toastMock.state.current = vi.fn()
    capturedSuccessCallback = null
    capturedErrorCallback = null

    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: mockGetCurrentPosition,
        watchPosition: vi.fn(),
        clearWatch: vi.fn(),
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("初期状態", () => {
    it("初期状態で location=null, isLoading=false, error=null であること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      expect(result.current.location).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it("マウント時に getCurrentPosition を呼ばないこと（明示的なトリガーが必要）", () => {
      renderHook(() => useCurrentLocation())
      expect(mockGetCurrentPosition).not.toHaveBeenCalled()
    })
  })

  describe("requestLocation - 成功", () => {
    it("requestLocation 呼び出しで isLoading=true になること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })

      expect(result.current.isLoading).toBe(true)
      expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1)
    })

    it("成功コールバックで location が [longitude, latitude] 形式でセットされること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })
      act(() => {
        capturedSuccessCallback?.(createMockPosition(35.6812, 139.7671, 15))
      })

      // [longitude, latitude] format matching selectedLocation convention
      expect(result.current.location).toEqual([139.7671, 35.6812])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
    })


    it("範囲外座標の場合は error.type='position_unavailable' になること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })
      act(() => {
        capturedSuccessCallback?.(createMockPosition(95.0, 200.0))
      })

      expect(result.current.location).toBeNull()
      expect(result.current.error).toEqual(
        expect.objectContaining({ type: "position_unavailable" })
      )
      expect(result.current.isLoading).toBe(false)
    })
    it("getCurrentPosition に enableHighAccuracy: true が渡されること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })

      expect(mockGetCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({ enableHighAccuracy: true })
      )
    })

    it("成功時に前回のエラーがクリアされること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      // First: trigger an error
      act(() => {
        result.current.requestLocation()
      })
      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(1))
      })
      expect(result.current.error).not.toBeNull()

      // Then: request again and succeed
      act(() => {
        result.current.requestLocation()
      })
      expect(result.current.error).toBeNull() // cleared on requestLocation call

      act(() => {
        capturedSuccessCallback?.(createMockPosition(35.0, 139.0))
      })
      expect(result.current.location).toEqual([139.0, 35.0])
    })
  })

  describe("requestLocation - エラーハンドリング", () => {
    it("PERMISSION_DENIED で error.type='permission_denied' がセットされること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })
      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(1))
      })

      expect(result.current.error).toEqual(
        expect.objectContaining({ type: "permission_denied" })
      )
      expect(result.current.isLoading).toBe(false)
    })

    it("PERMISSION_DENIED でトーストが表示されること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })
      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(1))
      })

      expect(toastMock.state.current).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining("位置情報"),
          variant: "destructive",
        })
      )
    })

    it("POSITION_UNAVAILABLE で error.type='position_unavailable' がセットされること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })
      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(2))
      })

      expect(result.current.error).toEqual(
        expect.objectContaining({ type: "position_unavailable" })
      )
      expect(result.current.isLoading).toBe(false)
    })

    it("TIMEOUT で error.type='timeout' がセットされること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })
      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(3))
      })

      expect(result.current.error).toEqual(
        expect.objectContaining({ type: "timeout" })
      )
      expect(result.current.isLoading).toBe(false)
    })

    it("TIMEOUT でトーストにGPS信号についてのメッセージが含まれること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })
      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(3))
      })

      expect(toastMock.state.current).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining("GPS"),
          variant: "destructive",
        })
      )
    })
  })

  describe("geolocation API 未対応", () => {
    it("navigator.geolocation がない場合 error.type='not_supported' がセットされること", () => {
      Object.defineProperty(navigator, "geolocation", {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })

      expect(result.current.error).toEqual(
        expect.objectContaining({ type: "not_supported" })
      )
      expect(result.current.isLoading).toBe(false)
    })

    it("geolocation 未対応時にトーストが表示されること", () => {
      Object.defineProperty(navigator, "geolocation", {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })

      expect(toastMock.state.current).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" })
      )
    })
  })

  describe("連続呼び出し防止", () => {
    it("isLoading 中に requestLocation を呼んでも getCurrentPosition が追加で呼ばれないこと", () => {
      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })
      act(() => {
        result.current.requestLocation()
      }) // second call while loading

      expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1)
    })
  })

  describe("reset", () => {
    it("reset で location, error がクリアされること", () => {
      const { result } = renderHook(() => useCurrentLocation())

      act(() => {
        result.current.requestLocation()
      })
      act(() => {
        capturedSuccessCallback?.(createMockPosition(35.0, 139.0))
      })
      expect(result.current.location).not.toBeNull()

      act(() => {
        result.current.reset()
      })

      expect(result.current.location).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
    })
  })
})
