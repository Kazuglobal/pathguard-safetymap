import { describe, expect, it } from "vitest"

import { shouldShowMapNavigationControl } from "@/lib/mapbox-controls"

describe("shouldShowMapNavigationControl", () => {
  it("hides Mapbox zoom controls on mobile and keeps them on desktop", () => {
    expect(shouldShowMapNavigationControl(true)).toBe(false)
    expect(shouldShowMapNavigationControl(false)).toBe(true)
  })
})
