import { describe, expect, it } from "vitest"
import { getNationwideMapView } from "@/lib/map-center"

describe("getNationwideMapView", () => {
  it("日本全体が見える中心とズームを返す（source は fallback）", () => {
    expect(getNationwideMapView()).toEqual({
      center: [137.0, 37.5],
      zoom: 4.6,
      source: "fallback",
    })
  })

  it("呼ぶたびに新しいオブジェクトを返し、受け取った側の書き換えが次の呼び出しに残らない", () => {
    const first = getNationwideMapView()
    first.center[0] = 0
    first.zoom = 20

    const second = getNationwideMapView()
    expect(second).not.toBe(first)
    expect(second.center).toEqual([137.0, 37.5])
    expect(second.zoom).toBe(4.6)
  })
})
