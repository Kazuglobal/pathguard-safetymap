/**
 * Unit Tests: spreadOverlappingMarkers
 *
 * 近接して重なる地図ピンだけを扇状に散らし、隠れていた番号を読めるようにする。
 * 重ならないピンは動かさず、並び順・件数を保持する。
 *
 * Target: lib/report-generation/report-map.ts
 */

import { describe, it, expect } from 'vitest'
import { spreadOverlappingMarkers } from '@/lib/report-generation/report-map'

const SPAN = 0.01 // 経度・緯度スパン(視界)

function dist(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

describe('spreadOverlappingMarkers', () => {
  it('leaves well-separated markers exactly where they are', () => {
    const coords: [number, number][] = [
      [139.0, 35.0],
      [139.008, 35.008], // 視界の~80%離れている → 動かさない
    ]
    const result = spreadOverlappingMarkers(coords, SPAN, SPAN)
    expect(result).toEqual(coords)
  })

  it('separates two nearly-coincident markers so their pins no longer overlap', () => {
    const coords: [number, number][] = [
      [139.0, 35.0],
      [139.00001, 35.00001], // ほぼ同一座標 → 重なる
    ]
    const before = dist(coords[0], coords[1])
    const result = spreadOverlappingMarkers(coords, SPAN, SPAN)
    const after = dist(result[0], result[1])

    expect(after).toBeGreaterThan(before)
    // 散らした後の間隔は衝突しきい値(視界の4.5%)以上あること
    expect(after).toBeGreaterThanOrEqual(0.045 * SPAN)
    // 重心は保存される(全体が大きくずれない)
    const cxBefore = (coords[0][0] + coords[1][0]) / 2
    const cxAfter = (result[0][0] + result[1][0]) / 2
    expect(cxAfter).toBeCloseTo(cxBefore, 6)
  })

  it('keeps count and order (labels stay aligned)', () => {
    const coords: [number, number][] = [
      [139.0, 35.0],
      [139.00001, 35.0],
      [139.005, 35.005],
    ]
    const result = spreadOverlappingMarkers(coords, SPAN, SPAN)
    expect(result).toHaveLength(3)
    // 3番目は単独なので不動
    expect(result[2]).toEqual([139.005, 35.005])
  })

  it('fans out a cluster of three coincident markers into distinct positions', () => {
    const coords: [number, number][] = [
      [139.0, 35.0],
      [139.00001, 35.0],
      [139.0, 35.00001],
    ]
    const result = spreadOverlappingMarkers(coords, SPAN, SPAN)
    // 3点とも互いに衝突しきい値以上離れる
    expect(dist(result[0], result[1])).toBeGreaterThanOrEqual(0.045 * SPAN * 0.9)
    expect(dist(result[0], result[2])).toBeGreaterThanOrEqual(0.045 * SPAN * 0.9)
    expect(dist(result[1], result[2])).toBeGreaterThanOrEqual(0.045 * SPAN * 0.9)
  })

  it('returns a copy for fewer than two markers', () => {
    expect(spreadOverlappingMarkers([], SPAN, SPAN)).toEqual([])
    expect(spreadOverlappingMarkers([[139, 35]], SPAN, SPAN)).toEqual([[139, 35]])
  })

  it('is a no-op for degenerate (zero/negative) spans', () => {
    const coords: [number, number][] = [
      [139.0, 35.0],
      [139.00001, 35.00001],
    ]
    expect(spreadOverlappingMarkers(coords, 0, SPAN)).toEqual(coords)
    expect(spreadOverlappingMarkers(coords, SPAN, 0)).toEqual(coords)
  })

  it('does not mutate the input array', () => {
    const coords: [number, number][] = [
      [139.0, 35.0],
      [139.00001, 35.00001],
    ]
    const snapshot = coords.map((c) => [...c])
    spreadOverlappingMarkers(coords, SPAN, SPAN)
    expect(coords).toEqual(snapshot)
  })
})
