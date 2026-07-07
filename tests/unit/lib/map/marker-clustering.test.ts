/**
 * Unit Tests: Marker Clustering
 *
 * ライブ地図の危険ピンの近接グループ化と高ズーム時の扇状展開。
 *
 * Target: lib/map/marker-clustering.ts
 */

import { describe, it, expect } from "vitest"
import {
  groupMarkersByProximity,
  spreadOverlappingPins,
  pixelsToLngDegrees,
  CLUSTER_PIXEL_THRESHOLD,
} from "@/lib/map/marker-clustering"

const BASE_LAT = 35.68
const BASE_LNG = 139.76

function pt(id: string, latOffsetDeg = 0, lngOffsetDeg = 0) {
  return {
    id,
    latitude: BASE_LAT + latOffsetDeg,
    longitude: BASE_LNG + lngOffsetDeg,
  }
}

describe("pixelsToLngDegrees", () => {
  it("ズームが1上がると同じpxの度数は半分になる", () => {
    const z14 = pixelsToLngDegrees(44, 14)
    const z15 = pixelsToLngDegrees(44, 15)
    expect(z14 / z15).toBeCloseTo(2)
  })

  it("zoom15で44pxはおよそ0.00094度", () => {
    // 44 * 360 / (512 * 2^15) ≒ 0.000944
    expect(pixelsToLngDegrees(44, 15)).toBeCloseTo(0.000944, 5)
  })
})

describe("groupMarkersByProximity", () => {
  it("しきい値内の近接ピンを1グループにまとめ、重心を返す", () => {
    const threshold = pixelsToLngDegrees(CLUSTER_PIXEL_THRESHOLD, 15)
    const items = [
      pt("a"),
      pt("b", threshold * 0.5, 0),
      pt("far", 0.1, 0),
    ]

    const groups = groupMarkersByProximity(items, 15)

    expect(groups).toHaveLength(2)
    const cluster = groups.find((g) => g.items.length === 2)!
    expect(cluster.items.map((i) => i.id).sort()).toEqual(["a", "b"])
    expect(cluster.latitude).toBeCloseTo(BASE_LAT + threshold * 0.25, 6)
  })

  it("低ズームではまとまり、高ズームでは分かれる(ズーム連動)", () => {
    // 約100m差(緯度0.0009度)の2点
    const items = [pt("a"), pt("b", 0.0009, 0)]

    const atZoom12 = groupMarkersByProximity(items, 12)
    const atZoom17 = groupMarkersByProximity(items, 17)

    expect(atZoom12).toHaveLength(1)
    expect(atZoom17).toHaveLength(2)
  })

  it("全て離れていれば全件が単独グループ", () => {
    const items = [pt("a"), pt("b", 0.05, 0), pt("c", 0, 0.05)]
    const groups = groupMarkersByProximity(items, 15)
    expect(groups).toHaveLength(3)
    expect(groups.every((g) => g.items.length === 1)).toBe(true)
  })

  it("空配列なら空を返す", () => {
    expect(groupMarkersByProximity([], 15)).toEqual([])
  })
})

describe("spreadOverlappingPins", () => {
  it("単独ピンは元の座標のまま", () => {
    const items = [pt("a"), pt("b", 0.05, 0)]
    const result = spreadOverlappingPins(items, 18)

    expect(result).toHaveLength(2)
    for (const spread of result) {
      expect(spread.latitude).toBe(spread.item.latitude)
      expect(spread.longitude).toBe(spread.item.longitude)
    }
  })

  it("同一座標のピンは全件が互いに異なる表示座標に散る", () => {
    const items = [pt("a"), pt("b"), pt("c")]
    const result = spreadOverlappingPins(items, 18)

    expect(result).toHaveLength(3)
    const keys = new Set(result.map((r) => `${r.latitude},${r.longitude}`))
    expect(keys.size).toBe(3)
    // 散らした位置は元の重心から大きく離れない(50px相当以内)
    const maxOffsetDeg = pixelsToLngDegrees(50, 18)
    for (const spread of result) {
      expect(Math.abs(spread.latitude - BASE_LAT)).toBeLessThan(maxOffsetDeg * 2)
    }
  })

  it("展開しても件数が失われない", () => {
    const items = [pt("a"), pt("b"), pt("c"), pt("d", 0.05, 0)]
    const result = spreadOverlappingPins(items, 18)
    expect(result.map((r) => r.item.id).sort()).toEqual(["a", "b", "c", "d"])
  })
})
