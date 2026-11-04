/**
 * useARLocation フックのユニットテスト
 *
 * Issue #39: watchPosition の依存配列問題
 * - toast ref パターンにより watchPosition が不要に再登録されないことを検証
 * - GPS位置情報の正常取得・エラーハンドリングを検証
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act, waitFor } from "@testing-library/react"
import { useARLocation } from "@/hooks/use-ar-location"
import { LOCATION_WATCHDOG_MS } from "@/lib/ar-constants"

// toast モック
const toastMock = vi.hoisted(() => {
  const state = { current: vi.fn() }
  const useToast = vi.fn(() => ({ toast: state.current }))
  return { state, useToast }
})
vi.mock("@/components/ui/use-toast", () => ({
  useToast: toastMock.useToast,
}))

// watchPosition / clearWatch モック
type SuccessCallback = (position: GeolocationPosition) => void
type ErrorCallback = (error: GeolocationPositionError) => void

let capturedSuccessCallback: SuccessCallback | null = null
let capturedErrorCallback: ErrorCallback | null = null
let watchIdCounter = 0

const mockWatchPosition = vi.fn(
  (success: SuccessCallback, error: ErrorCallback) => {
    capturedSuccessCallback = success
    capturedErrorCallback = error
    watchIdCounter += 1
    return watchIdCounter
  }
)
const mockClearWatch = vi.fn()

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

describe("useARLocation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    toastMock.state.current = vi.fn()
    capturedSuccessCallback = null
    capturedErrorCallback = null
    watchIdCounter = 0

    Object.defineProperty(navigator, "geolocation", {
      value: {
        watchPosition: mockWatchPosition,
        clearWatch: mockClearWatch,
        getCurrentPosition: vi.fn(),
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("初期化", () => {
    it("マウント時に watchPosition を1回だけ呼ぶこと", () => {
      renderHook(() => useARLocation())

      expect(mockWatchPosition).toHaveBeenCalledTimes(1)
      expect(mockWatchPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          enableHighAccuracy: true,
        })
      )
    })

    it("初期状態が正しいこと", () => {
      const { result } = renderHook(() => useARLocation())

      expect(result.current.userLocation).toBeNull()
      expect(result.current.locationPermission).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it("アンマウント時に clearWatch を呼ぶこと", () => {
      const { unmount } = renderHook(() => useARLocation())

      unmount()

      expect(mockClearWatch).toHaveBeenCalledTimes(1)
    })
  })

  describe("位置情報取得成功", () => {
    it("成功コールバックで位置情報が更新されること", async () => {
      const { result } = renderHook(() => useARLocation())

      act(() => {
        capturedSuccessCallback?.(createMockPosition(35.6812, 139.7671, 15))
      })

      expect(result.current.userLocation).toEqual({
        lat: 35.6812,
        lon: 139.7671,
        accuracy: 15,
        speed: null,
      })
      expect(result.current.locationPermission).toBe(true)
      expect(result.current.error).toBeNull()
    })

    it("複数回の位置更新が正しく反映されること", () => {
      const { result } = renderHook(() => useARLocation())

      act(() => {
        capturedSuccessCallback?.(createMockPosition(35.0, 139.0))
      })
      expect(result.current.userLocation?.lat).toBe(35.0)

      act(() => {
        capturedSuccessCallback?.(createMockPosition(36.0, 140.0))
      })
      expect(result.current.userLocation?.lat).toBe(36.0)
      expect(result.current.userLocation?.lon).toBe(140.0)
    })
  })

  describe("エラーハンドリング", () => {
    it("PERMISSION_DENIED で location_denied エラーを設定すること", () => {
      const { result } = renderHook(() => useARLocation())

      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(1))
      })

      expect(result.current.error).not.toBeNull()
      expect(result.current.error?.type).toBe("location_denied")
    })

    it("POSITION_UNAVAILABLE で location_unavailable エラーを設定すること", () => {
      const { result } = renderHook(() => useARLocation())

      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(2))
      })

      expect(result.current.error?.type).toBe("location_unavailable")
    })

    it("TIMEOUT で toast を表示しエラーは設定しないこと", () => {
      const { result } = renderHook(() => useARLocation())

      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(3))
      })

      expect(toastMock.state.current).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "位置情報の取得に時間がかかっています",
          variant: "destructive",
        })
      )
      expect(result.current.error).toBeNull()
    })

    it("位置取得成功でエラーがクリアされること", () => {
      const { result } = renderHook(() => useARLocation())

      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(1))
      })
      expect(result.current.error).not.toBeNull()

      act(() => {
        capturedSuccessCallback?.(createMockPosition(35.0, 139.0))
      })
      expect(result.current.error).toBeNull()
    })
  })

  describe("watchPosition 再登録防止 (Issue #39)", () => {
    it("toast 参照が変わっても watchPosition が再登録されないこと", () => {
      const { rerender } = renderHook(() => useARLocation())
      const firstToast = toastMock.state.current

      expect(mockWatchPosition).toHaveBeenCalledTimes(1)

      // 複数回のリレンダリングを実行
      toastMock.state.current = vi.fn()
      rerender()
      const secondToast = toastMock.state.current

      toastMock.state.current = vi.fn()
      rerender()
      const thirdToast = toastMock.state.current

      toastMock.state.current = vi.fn()
      rerender()
      const fourthToast = toastMock.state.current

      // watchPosition は最初の1回のみ
      expect(toastMock.useToast.mock.calls.length).toBeGreaterThanOrEqual(4)
      expect(firstToast).not.toBe(secondToast)
      expect(secondToast).not.toBe(thirdToast)
      expect(thirdToast).not.toBe(fourthToast)
      expect(mockWatchPosition).toHaveBeenCalledTimes(1)
      expect(mockClearWatch).not.toHaveBeenCalled()
    })

    it("位置情報更新後も watchPosition が再登録されないこと", () => {
      renderHook(() => useARLocation())

      expect(mockWatchPosition).toHaveBeenCalledTimes(1)

      // 位置情報コールバック発火
      act(() => {
        capturedSuccessCallback?.(createMockPosition(35.0, 139.0))
      })

      // watchPosition は再登録されていない
      expect(mockWatchPosition).toHaveBeenCalledTimes(1)
    })

    it("エラー発生後も watchPosition が再登録されないこと", () => {
      renderHook(() => useARLocation())

      expect(mockWatchPosition).toHaveBeenCalledTimes(1)

      // エラーコールバック発火
      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(3))
      })

      // watchPosition は再登録されていない
      expect(mockWatchPosition).toHaveBeenCalledTimes(1)
    })
  })

  describe("retry", () => {
    it("retry で clearWatch + 新しい watchPosition が呼ばれること", () => {
      const { result } = renderHook(() => useARLocation())

      expect(mockWatchPosition).toHaveBeenCalledTimes(1)

      act(() => {
        result.current.retry()
      })

      expect(mockClearWatch).toHaveBeenCalledTimes(1)
      expect(mockWatchPosition).toHaveBeenCalledTimes(2)
    })

    it("retry でエラーがクリアされること", () => {
      const { result } = renderHook(() => useARLocation())

      act(() => {
        capturedErrorCallback?.(createMockGeolocationError(1))
      })
      expect(result.current.error).not.toBeNull()

      act(() => {
        result.current.retry()
      })
      expect(result.current.error).toBeNull()
    })
  })

  describe("geolocation API なし", () => {
    it("navigator.geolocation がない場合 location_unavailable エラーを設定すること", () => {
      Object.defineProperty(navigator, "geolocation", {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const { result } = renderHook(() => useARLocation())

      expect(result.current.error?.type).toBe("location_unavailable")
      expect(mockWatchPosition).not.toHaveBeenCalled()
    })
  })
})

describe("最初の1点を早く出す", () => {
  let coarseSuccess: SuccessCallback | null = null
  let coarseOptions: PositionOptions | null = null
  const mockGetCurrentPosition = vi.fn(
    (success: SuccessCallback, _error: ErrorCallback, options?: PositionOptions) => {
      coarseSuccess = success
      coarseOptions = options ?? null
    }
  )

  beforeEach(() => {
    vi.clearAllMocks()
    coarseSuccess = null
    coarseOptions = null
    capturedSuccessCallback = null
    toastMock.state.current = vi.fn()
    Object.defineProperty(navigator, "geolocation", {
      value: { watchPosition: mockWatchPosition, clearWatch: mockClearWatch, getCurrentPosition: mockGetCurrentPosition },
      writable: true,
      configurable: true,
    })
  })

  it("粗い位置でも先に表示し、精度の値をそのまま渡す", async () => {
    const { result } = renderHook(() => useARLocation())
    expect(mockGetCurrentPosition).toHaveBeenCalled()
    expect(coarseOptions).toMatchObject({ enableHighAccuracy: false })

    act(() => { coarseSuccess?.(createMockPosition(35.86, 139.97, 800)) })

    await waitFor(() => {
      expect(result.current.userLocation).toMatchObject({ lat: 35.86, lon: 139.97, accuracy: 800 })
    })
  })

  it("高精度の測位が来たら置き換え、あとから届く粗い位置で上書きしない", async () => {
    const { result } = renderHook(() => useARLocation())

    act(() => { capturedSuccessCallback?.(createMockPosition(35.8676, 139.9759, 8)) })
    await waitFor(() => expect(result.current.userLocation?.accuracy).toBe(8))

    act(() => { coarseSuccess?.(createMockPosition(35.86, 139.97, 800)) })
    expect(result.current.userLocation).toMatchObject({ lat: 35.8676, lon: 139.9759, accuracy: 8 })
  })
})

describe("端末が何も返さないとき", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    capturedSuccessCallback = null
    toastMock.state.current = vi.fn()
    Object.defineProperty(navigator, "geolocation", {
      value: { watchPosition: mockWatchPosition, clearWatch: mockClearWatch, getCurrentPosition: vi.fn() },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("成功も失敗も返らないまま時間が過ぎたら、待ち続けずに伝える", async () => {
    const { result } = renderHook(() => useARLocation())
    expect(result.current.timedOut).toBe(false)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOCATION_WATCHDOG_MS + 100)
    })

    expect(result.current.timedOut).toBe(true)
    expect(result.current.userLocation).toBeNull()
  })

  it("時間内に位置が取れたら打ち切らない", async () => {
    const { result } = renderHook(() => useARLocation())

    act(() => { capturedSuccessCallback?.(createMockPosition(35.68, 139.69, 10)) })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LOCATION_WATCHDOG_MS + 100)
    })

    expect(result.current.timedOut).toBe(false)
    expect(result.current.userLocation).toMatchObject({ lat: 35.68 })
  })
})
