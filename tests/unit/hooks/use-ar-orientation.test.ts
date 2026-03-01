/**
 * useAROrientation フックのユニットテスト
 *
 * Issue #39: 依存配列問題
 * - toast ref パターンにより orientation リスナーが不要に再登録されないことを検証
 * - DeviceOrientationEvent のハンドリングを検証
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useAROrientation } from "@/hooks/use-ar-orientation"

// toast モック
const toastMock = vi.hoisted(() => {
  const state = { current: vi.fn() }
  const useToast = vi.fn(() => ({ toast: state.current }))
  return { state, useToast }
})
vi.mock("@/components/ui/use-toast", () => ({
  useToast: toastMock.useToast,
}))

// DeviceOrientationEvent のイベントリスナーをキャプチャ
let capturedOrientationHandler: ((event: Event) => void) | null = null
const mockAddEventListener = vi.fn(
  (type: string, handler: EventListener) => {
    if (type === "deviceorientation") {
      capturedOrientationHandler = handler
    }
  }
)
const mockRemoveEventListener = vi.fn(
  (type: string) => {
    if (type === "deviceorientation") {
      capturedOrientationHandler = null
    }
  }
)

describe("useAROrientation", () => {
  const originalAddEventListener = window.addEventListener
  const originalRemoveEventListener = window.removeEventListener

  beforeEach(() => {
    vi.clearAllMocks()
    toastMock.state.current = vi.fn()
    capturedOrientationHandler = null

    window.addEventListener = mockAddEventListener as typeof window.addEventListener
    window.removeEventListener = mockRemoveEventListener as typeof window.removeEventListener

    // DeviceOrientationEvent が存在する（非 iOS の場合）
    Object.defineProperty(window, "DeviceOrientationEvent", {
      value: class MockDeviceOrientationEvent extends Event {
        alpha: number | null = null
        beta: number | null = null
        gamma: number | null = null
        constructor(type: string, init?: { alpha?: number | null }) {
          super(type)
          this.alpha = init?.alpha ?? null
        }
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    window.addEventListener = originalAddEventListener
    window.removeEventListener = originalRemoveEventListener
    vi.restoreAllMocks()
  })

  describe("初期化", () => {
    it("マウント時に deviceorientation リスナーを登録すること", () => {
      renderHook(() => useAROrientation())

      expect(mockAddEventListener).toHaveBeenCalledWith(
        "deviceorientation",
        expect.any(Function)
      )
    })

    it("初期状態が正しいこと", () => {
      const { result } = renderHook(() => useAROrientation())

      expect(result.current.userHeading).toBe(0)
      expect(result.current.orientationPermission).toBe(true)
    })

    it("アンマウント時に deviceorientation リスナーを解除すること", () => {
      const { unmount } = renderHook(() => useAROrientation())

      unmount()

      expect(mockRemoveEventListener).toHaveBeenCalledWith(
        "deviceorientation",
        expect.any(Function)
      )
    })
  })

  describe("方向検出", () => {
    it("alpha 値が heading に反映されること", () => {
      const { result } = renderHook(() => useAROrientation())

      act(() => {
        const event = new Event("deviceorientation") as Event & {
          alpha: number | null
        }
        Object.defineProperty(event, "alpha", { value: 90 })
        capturedOrientationHandler?.(event)
      })

      // throttle により即座に反映されるか、次のフレームで反映される
      // throttle の初回呼び出しは即時実行される
      expect(result.current.userHeading).toBe(90)
    })

    it("alpha が null の場合 heading が変わらないこと", () => {
      const { result } = renderHook(() => useAROrientation())

      act(() => {
        const event = new Event("deviceorientation") as Event & {
          alpha: number | null
        }
        Object.defineProperty(event, "alpha", { value: null })
        capturedOrientationHandler?.(event)
      })

      expect(result.current.userHeading).toBe(0)
    })
  })

  describe("リスナー再登録防止 (Issue #39)", () => {
    it("toast 参照が変わっても リスナーが再登録されないこと", () => {
      const { rerender } = renderHook(() => useAROrientation())
      const firstToast = toastMock.state.current

      const initialCallCount = mockAddEventListener.mock.calls.filter(
        (call) => call[0] === "deviceorientation"
      ).length
      expect(initialCallCount).toBe(1)

      // 複数回のリレンダリング
      toastMock.state.current = vi.fn()
      rerender()
      const secondToast = toastMock.state.current

      toastMock.state.current = vi.fn()
      rerender()
      const thirdToast = toastMock.state.current

      toastMock.state.current = vi.fn()
      rerender()
      const fourthToast = toastMock.state.current

      const afterRerenderCount = mockAddEventListener.mock.calls.filter(
        (call) => call[0] === "deviceorientation"
      ).length
      expect(toastMock.useToast.mock.calls.length).toBeGreaterThanOrEqual(4)
      expect(firstToast).not.toBe(secondToast)
      expect(secondToast).not.toBe(thirdToast)
      expect(thirdToast).not.toBe(fourthToast)
      expect(afterRerenderCount).toBe(1)
    })

    it("方向更新後もリスナーが再登録されないこと", () => {
      renderHook(() => useAROrientation())

      const initialCallCount = mockAddEventListener.mock.calls.filter(
        (call) => call[0] === "deviceorientation"
      ).length

      act(() => {
        const event = new Event("deviceorientation") as Event & {
          alpha: number | null
        }
        Object.defineProperty(event, "alpha", { value: 45 })
        capturedOrientationHandler?.(event)
      })

      const afterUpdateCount = mockAddEventListener.mock.calls.filter(
        (call) => call[0] === "deviceorientation"
      ).length
      expect(afterUpdateCount).toBe(initialCallCount)
    })
  })

  describe("retry", () => {
    it("retry でリスナーが再登録されること", () => {
      const { result } = renderHook(() => useAROrientation())

      const initialCallCount = mockAddEventListener.mock.calls.filter(
        (call) => call[0] === "deviceorientation"
      ).length

      act(() => {
        result.current.retry()
      })

      const afterRetryCount = mockAddEventListener.mock.calls.filter(
        (call) => call[0] === "deviceorientation"
      ).length
      expect(afterRetryCount).toBe(initialCallCount + 1)
    })
  })

  describe("DeviceOrientationEvent なし", () => {
    it("DeviceOrientationEvent がない場合 toast を表示すること", () => {
      Object.defineProperty(window, "DeviceOrientationEvent", {
        value: undefined,
        writable: true,
        configurable: true,
      })

      renderHook(() => useAROrientation())

      expect(toastMock.state.current).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "方向検出が利用できません",
        })
      )
    })
  })
})
