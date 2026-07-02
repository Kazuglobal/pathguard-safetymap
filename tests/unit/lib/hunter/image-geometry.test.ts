import { describe, expect, it } from "vitest"

import {
  containRect,
  toContainerPct,
  toImageCoords,
} from "@/lib/hunter/image-geometry"

describe("containRect", () => {
  it("letterboxes a portrait image inside a 4:3 box (pillarbox left/right)", () => {
    // natural 3:4 (portrait) into 400x300 container -> height-limited
    const r = containRect({ w: 300, h: 400 }, { w: 400, h: 300 })
    expect(r.drawH).toBe(300)
    expect(r.drawW).toBeCloseTo(225, 5) // 300 * (300/400)
    expect(r.offsetX).toBeCloseTo((400 - 225) / 2, 5)
    expect(r.offsetY).toBe(0)
  })

  it("letterboxes a wide image inside a square box (bars top/bottom)", () => {
    const r = containRect({ w: 800, h: 400 }, { w: 300, h: 300 })
    expect(r.drawW).toBe(300)
    expect(r.drawH).toBe(150)
    expect(r.offsetX).toBe(0)
    expect(r.offsetY).toBe(75)
  })

  it("returns an empty rect for degenerate input", () => {
    expect(containRect({ w: 0, h: 100 }, { w: 100, h: 100 })).toEqual({
      offsetX: 0,
      offsetY: 0,
      drawW: 0,
      drawH: 0,
    })
  })
})

describe("toImageCoords", () => {
  const natural = { w: 300, h: 400 }
  const rect = { left: 0, top: 0, width: 400, height: 300 }
  const contain = containRect(natural, { w: rect.width, h: rect.height })

  it("maps the drawn-area center to (0.5, 0.5)", () => {
    const center = toImageCoords(200, 150, rect, contain)
    expect(center).not.toBeNull()
    expect(center!.x).toBeCloseTo(0.5, 5)
    expect(center!.y).toBeCloseTo(0.5, 5)
  })

  it("returns null when the tap lands on the letterbox (pillar) area", () => {
    // offsetX ~ 87.5, so x=10 is inside the left bar (outside the image)
    expect(toImageCoords(10, 150, rect, contain)).toBeNull()
  })

  it("clamps to image edges at the drawn-area boundary", () => {
    const topLeft = toImageCoords(contain.offsetX, contain.offsetY, rect, contain)
    expect(topLeft).toEqual({ x: 0, y: 0 })
  })

  it("accounts for the container's viewport offset (left/top)", () => {
    const offsetRect = { left: 100, top: 50, width: 400, height: 300 }
    const center = toImageCoords(300, 200, offsetRect, contain)
    expect(center!.x).toBeCloseTo(0.5, 5)
    expect(center!.y).toBeCloseTo(0.5, 5)
  })
})

describe("toContainerPct round-trip", () => {
  it("maps an image-relative point back to a container percentage and back", () => {
    const natural = { w: 800, h: 400 }
    const container = { w: 300, h: 300 }
    const contain = containRect(natural, container)
    const rel = { x: 0.5, y: 0.5 }
    const pct = toContainerPct(rel, contain, container)
    // center of drawn area: x px = 150 -> 50%, y px = 75 + 75 = 150 -> 50%
    expect(pct.leftPct).toBeCloseTo(50, 5)
    expect(pct.topPct).toBeCloseTo(50, 5)

    // round-trip via toImageCoords using the same container as the viewport
    const rect = { left: 0, top: 0, width: container.w, height: container.h }
    const back = toImageCoords(
      (pct.leftPct / 100) * container.w,
      (pct.topPct / 100) * container.h,
      rect,
      contain,
    )
    expect(back!.x).toBeCloseTo(rel.x, 5)
    expect(back!.y).toBeCloseTo(rel.y, 5)
  })
})
