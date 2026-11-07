import { describe, expect, it } from "vitest"

import { pixelBoxToRegion, pixelPointToNormalized } from "@/lib/vision/pixel-coords"

const SIZE = { width: 1600, height: 1200 }

function close(actual: Record<string, number> | null, expected: Record<string, number>) {
  expect(actual).not.toBeNull()
  for (const key of Object.keys(expected)) expect(actual![key]).toBeCloseTo(expected[key], 10)
}

describe("pixelBoxToRegion", () => {
  it("converts [x1, y1, x2, y2] pixels by the size Claude saw", () => {
    close(pixelBoxToRegion([640, 624, 928, 864], SIZE) as never, { x: 0.4, y: 0.52, w: 0.18, h: 0.2 })
  })

  it("reads swapped corners, objects, nested arrays and JSON strings", () => {
    close(pixelBoxToRegion([928, 864, 640, 624], SIZE) as never, { x: 0.4, y: 0.52, w: 0.18, h: 0.2 })
    close(pixelBoxToRegion({ x1: 640, y1: 624, x2: 928, y2: 864 }, SIZE) as never, { x: 0.4, y: 0.52 })
    close(pixelBoxToRegion([[640, 624, 928, 864]], SIZE) as never, { x: 0.4 })
    close(pixelBoxToRegion("[640, 624, 928, 864]", SIZE) as never, { x: 0.4 })
  })

  it("clamps values just outside the image and refuses what it cannot read", () => {
    close(pixelBoxToRegion([1500, 1100, 1700, 1300], SIZE) as never, { x: 1500 / 1600, w: 100 / 1600, h: 100 / 1200 })
    expect(pixelBoxToRegion([-5, 0, 100, 100], SIZE)).toBeNull()
    expect(pixelBoxToRegion([1, 2, 3], SIZE)).toBeNull()
    expect(pixelBoxToRegion({ x1: 1, y1: 2 }, SIZE)).toBeNull()
    expect(pixelBoxToRegion("nope", SIZE)).toBeNull()
  })
})

describe("pixelPointToNormalized", () => {
  it("converts [x, y] pixels (note: x first, unlike Gemini's [y, x])", () => {
    close(pixelPointToNormalized([672, 732], SIZE) as never, { x: 0.42, y: 0.61 })
    expect(pixelPointToNormalized([1], SIZE)).toBeNull()
    expect(pixelPointToNormalized([-1, 3], SIZE)).toBeNull()
  })
})
