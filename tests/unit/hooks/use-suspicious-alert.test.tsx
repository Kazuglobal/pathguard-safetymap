import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"

// useSearchParams は Next.js の App Router と同じく「いまの URL」から作り、
// URL が変わらない限り同じオブジェクトを返す(App Router は canonicalUrl をキーに useMemo する)。
// そのため、同じ URL へもう一度 push しても値は変わらない。
// history.pushState / replaceState で URL が変わったら、購読しているフックに知らせる。
const nav = vi.hoisted(() => {
  const listeners = new Set<() => void>()
  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    notify() {
      listeners.forEach((listener) => listener())
    },
  }
})

vi.mock("next/navigation", async () => {
  const React = await import("react")
  return {
    useSearchParams: () => {
      const search = React.useSyncExternalStore(nav.subscribe, () => window.location.search)
      return React.useMemo(() => new URLSearchParams(search), [search])
    },
  }
})

vi.mock("mapbox-gl", () => ({
  default: {
    Marker: class {
      setLngLat() {
        return this
      }
      addTo() {
        return this
      }
      remove() {}
    },
  },
}))

import { useSuspiciousAlert } from "@/hooks/use-suspicious-alert"

function renderSuspiciousAlert() {
  return renderHook(() =>
    useSuspiciousAlert({
      mapRef: { current: null },
      selectedLocation: null,
      setSelectedLocation: vi.fn(),
      setLocationSelectionSource: vi.fn(),
      dangerReports: [],
      pendingReports: [],
      setDangerReports: vi.fn(),
      setPendingReports: vi.fn(),
      submitDangerReport: vi.fn(),
      toast: vi.fn(),
    }),
  )
}

/** router.push の代わり: URL を進めて、Next.js と同じように useSearchParams へ知らせる */
function navigateTo(url: string) {
  act(() => {
    window.history.pushState(null, "", url)
  })
}

describe("useSuspiciousAlert の ?suspiciousAlert=1", () => {
  let replaceStateSpy: MockInstance<History["replaceState"]>

  beforeEach(() => {
    const originalPushState = window.history.pushState.bind(window.history)
    const originalReplaceState = window.history.replaceState.bind(window.history)
    originalReplaceState(null, "", "/")
    vi.spyOn(window.history, "pushState").mockImplementation((data, unused, url) => {
      originalPushState(data, unused, url)
      nav.notify()
    })
    replaceStateSpy = vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
      originalReplaceState(data, unused, url)
      nav.notify()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("フォームを開いたら、その合図だけを URL から消す(ほかのクエリと #hash は残す)", () => {
    navigateTo("/map?routeId=route-1&suspiciousAlert=1#detail")

    const { result } = renderSuspiciousAlert()

    expect(result.current.isSuspiciousAlertOpen).toBe(true)
    expect(window.location.pathname).toBe("/map")
    expect(window.location.search).toBe("?routeId=route-1")
    expect(window.location.hash).toBe("#detail")
    // 第1引数が null でないと、Next.js がルーターの URL(useSearchParams)を更新しない
    expect(replaceStateSpy).toHaveBeenCalledTimes(1)
    expect(replaceStateSpy).toHaveBeenCalledWith(null, "", "/map?routeId=route-1#detail")
  })

  it("地図にいるまま同じ URL へもう一度来たら、フォームがまた開く", () => {
    navigateTo("/map")
    const { result } = renderSuspiciousAlert()
    expect(result.current.isSuspiciousAlertOpen).toBe(false)

    navigateTo("/map?suspiciousAlert=1")
    expect(result.current.isSuspiciousAlertOpen).toBe(true)
    expect(window.location.search).toBe("")

    act(() => {
      result.current.setIsSuspiciousAlertOpen(false)
    })
    expect(result.current.isSuspiciousAlertOpen).toBe(false)

    // 中央ボタンのシートからもう一度「不審者アラートを地図化」を選んだとき
    navigateTo("/map?suspiciousAlert=1")
    expect(result.current.isSuspiciousAlertOpen).toBe(true)
    expect(window.location.search).toBe("")
  })

  it("合図が無いときはフォームを開かず、URL もさわらない", () => {
    navigateTo("/map?routeId=route-1")

    const { result } = renderSuspiciousAlert()

    expect(result.current.isSuspiciousAlertOpen).toBe(false)
    expect(replaceStateSpy).not.toHaveBeenCalled()
    expect(window.location.search).toBe("?routeId=route-1")
  })
})
