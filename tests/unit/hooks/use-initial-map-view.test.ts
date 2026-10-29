import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/hooks/use-current-location", () => ({
  useCurrentLocation: () => ({ location: null, requestLocation: vi.fn() }),
}))

import { ROUTES_WAIT_TIMEOUT_MS, useInitialMapView } from "@/hooks/use-initial-map-view"
import type { UserRoute } from "@/lib/types"

const route = {
  id: "r1",
  name: "いつもの道",
  start_lat: 35.68,
  start_lng: 139.76,
  end_lat: 35.69,
  end_lng: 139.77,
  created_at: "2026-10-01T00:00:00Z",
  route_geometry: null,
} as unknown as UserRoute

describe("useInitialMapView", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("ルートの取得が長引いたら待たずに日本全体のフォールバックで初期化する(初期表示はやり直さない)", () => {
    const { result, rerender } = renderHook((props) => useInitialMapView(props), {
      initialProps: { primaryRoute: null as UserRoute | null, routes: [] as UserRoute[], isRoutesLoading: true },
    })
    expect(result.current.initialView).toBeNull()

    act(() => {
      vi.advanceTimersByTime(ROUTES_WAIT_TIMEOUT_MS)
    })
    expect(result.current.initialView?.source).toBe("fallback")

    // 遅れて届いたルートへは地図側の選択中ルート(fitBounds)が寄せるので、ここでは初期表示を変えない
    rerender({ primaryRoute: route, routes: [route], isRoutesLoading: false })
    expect(result.current.initialView?.source).toBe("fallback")
  })

  it("待ち時間内にルートが届けば最初からルートで初期化する", () => {
    const { result, rerender } = renderHook((props) => useInitialMapView(props), {
      initialProps: { primaryRoute: null as UserRoute | null, routes: [] as UserRoute[], isRoutesLoading: true },
    })

    rerender({ primaryRoute: route, routes: [route], isRoutesLoading: false })

    expect(result.current.initialView?.source).toBe("route")
  })

  it("長く待たない(以前は4秒待っていた)", () => {
    expect(ROUTES_WAIT_TIMEOUT_MS).toBeLessThanOrEqual(2000)
  })
})
