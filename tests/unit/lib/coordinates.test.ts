import { describe, expect, it } from "vitest"
import {
  MAX_LATITUDE,
  MAX_LONGITUDE,
  MIN_LATITUDE,
  MIN_LONGITUDE,
  isValidCoordinates,
  roundToGrid,
} from "@/lib/coordinates"

describe("roundToGrid", () => {
  it("snaps a raw coordinate to the default 0.01 degree grid", () => {
    expect(roundToGrid(35.6895)).toBeCloseTo(35.69, 10)
    expect(roundToGrid(139.6917)).toBeCloseTo(139.69, 10)
  })

  it("supports a custom grid size", () => {
    expect(roundToGrid(35.6895, 0.001)).toBeCloseTo(35.69, 10)
    expect(roundToGrid(35.68949, 0.001)).toBeCloseTo(35.689, 10)
  })

  it("keeps zero at zero", () => {
    expect(roundToGrid(0)).toBe(0)
  })

  it("does not push latitude out of range at the north/south pole boundary", () => {
    expect(roundToGrid(MAX_LATITUDE)).toBe(90)
    expect(roundToGrid(MIN_LATITUDE)).toBe(-90)
    expect(isValidCoordinates(roundToGrid(MAX_LATITUDE), 0)).toBe(true)
  })

  it("does not push longitude out of range at the +/-180 degree boundary", () => {
    expect(roundToGrid(MAX_LONGITUDE)).toBe(180)
    expect(roundToGrid(MIN_LONGITUDE)).toBe(-180)
    expect(isValidCoordinates(0, roundToGrid(MAX_LONGITUDE))).toBe(true)
  })

  it("handles values just inside the boundary without overshooting", () => {
    // 89.996 は 0.01 グリッドで 90.00 に丸められるが、範囲外にはならない
    expect(roundToGrid(89.996)).toBeCloseTo(90, 10)
    expect(roundToGrid(-89.996)).toBeCloseTo(-90, 10)
  })

  it("returns the original value unchanged for non-finite input", () => {
    expect(roundToGrid(Number.NaN)).toBeNaN()
    expect(roundToGrid(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY)
  })

  it("returns the original value when gridDegrees is invalid", () => {
    expect(roundToGrid(35.6895, 0)).toBe(35.6895)
    expect(roundToGrid(35.6895, -0.01)).toBe(35.6895)
  })
})
