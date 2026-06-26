import { describe, it, expect } from "vitest"
import type { HunterRegion } from "@/lib/hunter/types"
import {
  clampRegion,
  expandRegion,
  faceToBlurRegion,
  buildBlurRegions,
  type DetectedFace,
} from "@/lib/hunter/masking"

describe("clampRegion", () => {
  it("leaves an in-bounds region unchanged", () => {
    const r: HunterRegion = { x: 0.2, y: 0.3, w: 0.4, h: 0.5 }
    expect(clampRegion(r)).toEqual(r)
  })

  it("clamps negative x and y to 0", () => {
    const result = clampRegion({ x: -0.2, y: -0.1, w: 0.3, h: 0.3 })
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it("shrinks w/h so the region never overflows [0,1]", () => {
    const result = clampRegion({ x: 0.8, y: 0.7, w: 0.5, h: 0.6 })
    expect(result.x + result.w).toBeLessThanOrEqual(1)
    expect(result.y + result.h).toBeLessThanOrEqual(1)
    expect(result.w).toBeCloseTo(0.2)
    expect(result.h).toBeCloseTo(0.3)
  })

  it("never returns a region exceeding 1 on any side", () => {
    const result = clampRegion({ x: 0.9, y: 0.95, w: 0.4, h: 0.4 })
    expect(result.x).toBeLessThanOrEqual(1)
    expect(result.y).toBeLessThanOrEqual(1)
    expect(result.x + result.w).toBeLessThanOrEqual(1)
    expect(result.y + result.h).toBeLessThanOrEqual(1)
  })

  it("coerces negative width/height to 0", () => {
    const result = clampRegion({ x: 0.3, y: 0.3, w: -0.5, h: -0.2 })
    expect(result.w).toBe(0)
    expect(result.h).toBe(0)
  })

  it("does not mutate the input", () => {
    const r: HunterRegion = { x: 0.8, y: 0.8, w: 0.5, h: 0.5 }
    const snapshot = { ...r }
    clampRegion(r)
    expect(r).toEqual(snapshot)
  })
})

describe("expandRegion", () => {
  it("grows the region on every side by the margin", () => {
    const result = expandRegion({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, 0.05)
    expect(result.x).toBeCloseTo(0.35)
    expect(result.y).toBeCloseTo(0.35)
    expect(result.w).toBeCloseTo(0.3)
    expect(result.h).toBeCloseTo(0.3)
  })

  it("clamps the expanded region at the top-left edge", () => {
    const result = expandRegion({ x: 0.02, y: 0.01, w: 0.2, h: 0.2 }, 0.1)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.x + result.w).toBeLessThanOrEqual(1)
    expect(result.y + result.h).toBeLessThanOrEqual(1)
  })

  it("clamps the expanded region at the bottom-right edge", () => {
    const result = expandRegion({ x: 0.85, y: 0.9, w: 0.1, h: 0.08 }, 0.1)
    expect(result.x + result.w).toBeLessThanOrEqual(1)
    expect(result.y + result.h).toBeLessThanOrEqual(1)
  })

  it("does not mutate the input", () => {
    const r: HunterRegion = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 }
    const snapshot = { ...r }
    expandRegion(r, 0.05)
    expect(r).toEqual(snapshot)
  })
})

describe("faceToBlurRegion", () => {
  const face = (over: Partial<DetectedFace> = {}): DetectedFace => ({
    x: 0.4,
    y: 0.4,
    width: 0.1,
    height: 0.1,
    ...over,
  })

  it("uses the base margin for a high-confidence face", () => {
    const result = faceToBlurRegion(face({ score: 0.9 }))
    // base margin 0.08 -> x 0.4-0.08 = 0.32
    expect(result.x).toBeCloseTo(0.32)
    expect(result.w).toBeCloseTo(0.1 + 0.16)
  })

  it("uses the base margin when score is undefined", () => {
    const result = faceToBlurRegion(face())
    expect(result.x).toBeCloseTo(0.32)
    expect(result.w).toBeCloseTo(0.26)
  })

  it("uses the larger uncertain margin for a low-confidence face", () => {
    const result = faceToBlurRegion(face({ score: 0.3 }))
    // uncertain margin 0.18 -> x 0.4-0.18 = 0.22
    expect(result.x).toBeCloseTo(0.22)
    expect(result.w).toBeCloseTo(0.1 + 0.36)
  })

  it("expands an uncertain face wider than a confident one", () => {
    const confident = faceToBlurRegion(face({ score: 0.9 }))
    const uncertain = faceToBlurRegion(face({ score: 0.1 }))
    expect(uncertain.w).toBeGreaterThan(confident.w)
    expect(uncertain.h).toBeGreaterThan(confident.h)
  })

  it("treats a score exactly at the threshold as confident", () => {
    const result = faceToBlurRegion(face({ score: 0.6 }))
    expect(result.x).toBeCloseTo(0.32)
  })

  it("honours custom options", () => {
    const result = faceToBlurRegion(face({ score: 0.5 }), {
      baseMargin: 0.01,
      uncertainMargin: 0.2,
      uncertainThreshold: 0.7,
    })
    // 0.5 < 0.7 -> uncertain margin 0.2 -> x 0.4-0.2 = 0.2
    expect(result.x).toBeCloseTo(0.2)
  })

  it("keeps the produced region within [0,1]", () => {
    const result = faceToBlurRegion(face({ x: 0.95, y: 0.95, width: 0.1, height: 0.1, score: 0.1 }))
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
    expect(result.x + result.w).toBeLessThanOrEqual(1)
    expect(result.y + result.h).toBeLessThanOrEqual(1)
  })

  it("does not mutate the input face", () => {
    const f = face({ score: 0.3 })
    const snapshot = { ...f }
    faceToBlurRegion(f)
    expect(f).toEqual(snapshot)
  })
})

describe("buildBlurRegions", () => {
  it("maps every face to a blur region", () => {
    const faces: DetectedFace[] = [
      { x: 0.1, y: 0.1, width: 0.1, height: 0.1, score: 0.9 },
      { x: 0.5, y: 0.5, width: 0.1, height: 0.1, score: 0.2 },
    ]
    const result = buildBlurRegions(faces)
    expect(result).toHaveLength(2)
    // second face is uncertain -> wider than first
    expect(result[1].w).toBeGreaterThan(result[0].w)
  })

  it("returns an empty array for no faces", () => {
    expect(buildBlurRegions([])).toEqual([])
  })

  it("passes options through to each face", () => {
    const faces: DetectedFace[] = [{ x: 0.4, y: 0.4, width: 0.1, height: 0.1, score: 0.5 }]
    const result = buildBlurRegions(faces, { uncertainThreshold: 0.7, uncertainMargin: 0.2 })
    expect(result[0].x).toBeCloseTo(0.2)
  })
})
