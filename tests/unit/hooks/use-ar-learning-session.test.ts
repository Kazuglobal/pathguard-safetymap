import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  getARLearningSessionStorageKey,
  useARLearningSession,
} from "@/hooks/use-ar-learning-session"

describe("useARLearningSession", () => {
  let storageItems: Map<string, string>
  let setItemSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    storageItems = new Map()
    setItemSpy = vi.fn((key: string, value: string) => {
      storageItems.set(key, value)
    })
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storageItems.get(key) ?? null,
        setItem: setItemSpy,
        removeItem: (key: string) => storageItems.delete(key),
        clear: () => storageItems.clear(),
      },
    })
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      value: undefined,
    })
  })

  it("route単位のactiveセッションキーを安定生成する", () => {
    expect(getARLearningSessionStorageKey("route-1")).toBe("route-learning:route-1:active")
    expect(getARLearningSessionStorageKey("route-1")).toBe(getARLearningSessionStorageKey("route-1"))
    expect(getARLearningSessionStorageKey("route-2")).toBe("route-learning:route-2:active")
  })

  it("hydrate完了前に空の初期状態で保存済み進捗を上書きしない", async () => {
    const key = getARLearningSessionStorageKey("route-1")
    window.localStorage.setItem(
      key,
      JSON.stringify({
        startedAt: "2026-05-04T00:00:00.000Z",
        reviewedCount: 1,
        savedCount: 0,
        progress: { "danger-1": "reviewed" },
      }),
    )
    setItemSpy.mockClear()

    const { result } = renderHook(() => useARLearningSession({ routeId: "route-1" }))

    await waitFor(() => {
      expect(result.current.state.progress["danger-1"]).toBe("reviewed")
    })

    const writesForKey = setItemSpy.mock.calls
      .filter(([writtenKey]) => writtenKey === key)
      .map(([, value]) => JSON.parse(String(value)))

    expect(writesForKey).not.toContainEqual(
      expect.objectContaining({
        reviewedCount: 0,
        savedCount: 0,
        progress: {},
      }),
    )

    act(() => {
      result.current.markStop("danger-2", "saved")
    })

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(key) ?? "{}")
      expect(stored.progress).toMatchObject({
        "danger-1": "reviewed",
        "danger-2": "saved",
      })
    })
  })

  it("hydrate完了前の操作を後続の初期hydrateで消さない", async () => {
    const key = getARLearningSessionStorageKey("route-fast")
    const { result } = renderHook(() => useARLearningSession({ routeId: "route-fast" }))

    act(() => {
      result.current.markStop("danger-fast", "reviewed")
    })

    await waitFor(() => {
      expect(result.current.state.progress["danger-fast"]).toBe("reviewed")
    })

    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem(key) ?? "{}")
      expect(stored.progress).toMatchObject({
        "danger-fast": "reviewed",
      })
    })
  })
})
