import { describe, expect, it } from "vitest"
import { computeFallbackCell, findNonOverlappingLabelY } from "@/lib/hazard-game-overlay-layout"

describe("hazard-game-overlay-layout", () => {
  it("keeps fallback cells inside canvas bounds even with many detections", () => {
    const totalDetections = 21
    const canvasHeight = 360
    const fontSize = 14
    const pad = 8

    const placements = Array.from({ length: totalDetections }, (_, index) =>
      computeFallbackCell(index, totalDetections, canvasHeight, fontSize, pad)
    )

    for (const placement of placements) {
      expect(placement.y).toBeGreaterThanOrEqual(0)
      expect(placement.y + placement.h).toBeLessThanOrEqual(1)
    }
  })

  it("rechecks overlap on fallback path and picks a free y position", () => {
    const y = findNonOverlappingLabelY({
      lbX: 10,
      lbW: 80,
      lbH: 18,
      initialY: 10,
      rectBottomY: 20,
      canvasHeight: 140,
      placedLabels: [
        { x: 0, y: 10, w: 120, h: 18 },
        { x: 0, y: 30, w: 120, h: 18 },
        { x: 0, y: 50, w: 120, h: 18 },
        { x: 0, y: 70, w: 120, h: 18 },
      ],
      maxAttempts: 4,
      gap: 2,
      edgePadding: 2,
    })

    expect(y).toBe(90)
  })
})
