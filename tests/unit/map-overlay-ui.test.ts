import { describe, expect, it, vi } from "vitest"

import { dismissTransientMapUi, getMapDisplayDockBottomOffset, MOBILE_MAP_DOCK_BOTTOM } from "@/lib/map-overlay-ui"

describe("map overlay ui helpers", () => {
  it("dismisses the active top panel and increments the search dismiss signal", () => {
    const setActiveTopPanel = vi.fn()
    const setDismissSearchResultsSignal = vi.fn()

    dismissTransientMapUi({
      setActiveTopPanel,
      setDismissSearchResultsSignal,
    })

    expect(setActiveTopPanel).toHaveBeenCalledWith(null)
    expect(setDismissSearchResultsSignal).toHaveBeenCalledTimes(1)

    const updateSignal = setDismissSearchResultsSignal.mock.calls[0]?.[0]
    expect(updateSignal).toBeTypeOf("function")
    expect(updateSignal(4)).toBe(5)
  })

  it("keeps the display dock above the mobile action dock and desktop mapbox controls", () => {
    expect(getMapDisplayDockBottomOffset(true)).toBe("calc(env(safe-area-inset-bottom, 0px) + 10.5rem)")
    expect(getMapDisplayDockBottomOffset(false)).toBe("9rem")
  })

  it("puts the mobile action dock at the bottom edge because the map page hides the bottom tab bar", () => {
    expect(MOBILE_MAP_DOCK_BOTTOM).toBe("calc(env(safe-area-inset-bottom, 0px) + 0.75rem)")
  })
})
