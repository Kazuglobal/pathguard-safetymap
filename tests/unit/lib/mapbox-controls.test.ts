import { describe, expect, it } from "vitest"

import { shouldShowMapNavigationControl, syncMapNavigationControl } from "@/lib/mapbox-controls"

describe("shouldShowMapNavigationControl", () => {
  it("hides Mapbox zoom controls on mobile and keeps them on desktop", () => {
    expect(shouldShowMapNavigationControl(true)).toBe(false)
    expect(shouldShowMapNavigationControl(false)).toBe(true)
  })
})

describe("syncMapNavigationControl", () => {
  it("adds the navigation control when it should be shown and is not mounted yet", () => {
    const addControl = vi.fn()
    const removeControl = vi.fn()
    const control = {}

    syncMapNavigationControl({
      map: {
        hasControl: () => false,
        addControl,
        removeControl,
      },
      control,
      shouldShow: true,
    })

    expect(addControl).toHaveBeenCalledWith(control, "bottom-right")
    expect(removeControl).not.toHaveBeenCalled()
  })

  it("removes the navigation control when it should be hidden but is already mounted", () => {
    const addControl = vi.fn()
    const removeControl = vi.fn()
    const control = {}

    syncMapNavigationControl({
      map: {
        hasControl: () => true,
        addControl,
        removeControl,
      },
      control,
      shouldShow: false,
    })

    expect(removeControl).toHaveBeenCalledWith(control)
    expect(addControl).not.toHaveBeenCalled()
  })
})
