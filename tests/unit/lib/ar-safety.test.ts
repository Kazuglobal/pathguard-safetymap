/**
 * Unit Tests: AR Safety Suppression
 *
 * 位置精度・移動速度によるAR強調/接近通知の抑制判定。
 * 親子モード限定だった判定をモード共通の純粋関数に切り出したもの。
 *
 * Target: lib/ar-safety.ts
 */

import { describe, it, expect } from "vitest"
import {
  getARSafetySuppression,
  AR_ACCURACY_SUPPRESS_THRESHOLD_M,
  AR_SPEED_SUPPRESS_THRESHOLD_KMH,
} from "@/lib/ar-safety"

describe("getARSafetySuppression", () => {
  it("精度が閾値(50m)超なら強調を抑制する", () => {
    const r = getARSafetySuppression({ accuracy: 51, speed: 0 })
    expect(r.isLocationAccuracyLow).toBe(true)
    expect(r.isMovingTooFast).toBe(false)
  })

  it("精度が閾値ちょうど(50m)なら抑制しない(境界は非抑制側)", () => {
    const r = getARSafetySuppression({ accuracy: AR_ACCURACY_SUPPRESS_THRESHOLD_M, speed: 0 })
    expect(r.isLocationAccuracyLow).toBe(false)
  })

  it("速度が閾値(15km/h)超なら接近通知を抑制する", () => {
    // 15km/h = 4.1667 m/s。4.2m/s ≒ 15.12km/h
    const r = getARSafetySuppression({ accuracy: 10, speed: 4.2 })
    expect(r.isMovingTooFast).toBe(true)
    expect(r.isLocationAccuracyLow).toBe(false)
  })

  it("徒歩速度(約5km/h=1.4m/s)では抑制しない", () => {
    const r = getARSafetySuppression({ accuracy: 10, speed: 1.4 })
    expect(r.isMovingTooFast).toBe(false)
  })

  it("速度がnull/undefinedの端末では速度抑制は発火しない(安全側への誤作動なし)", () => {
    expect(getARSafetySuppression({ accuracy: 10, speed: null }).isMovingTooFast).toBe(false)
    expect(getARSafetySuppression({ accuracy: 10 }).isMovingTooFast).toBe(false)
  })

  it("位置情報自体がない場合は両方とも抑制しない", () => {
    expect(getARSafetySuppression(null)).toEqual({
      isLocationAccuracyLow: false,
      isMovingTooFast: false,
    })
    expect(getARSafetySuppression(undefined)).toEqual({
      isLocationAccuracyLow: false,
      isMovingTooFast: false,
    })
  })

  it("NaN/Infinityの精度・速度では抑制しない(不正値で誤作動させない)", () => {
    expect(getARSafetySuppression({ accuracy: Number.NaN, speed: Number.NaN })).toEqual({
      isLocationAccuracyLow: false,
      isMovingTooFast: false,
    })
    expect(
      getARSafetySuppression({ accuracy: Number.POSITIVE_INFINITY, speed: Number.POSITIVE_INFINITY }),
    ).toEqual({
      isLocationAccuracyLow: false,
      isMovingTooFast: false,
    })
  })

  it("両方の閾値を超えたら両方抑制する", () => {
    const r = getARSafetySuppression({ accuracy: 100, speed: 10 })
    expect(r).toEqual({ isLocationAccuracyLow: true, isMovingTooFast: true })
  })

  it("閾値定数は親子モード時代と同じ値(50m / 15km/h)", () => {
    expect(AR_ACCURACY_SUPPRESS_THRESHOLD_M).toBe(50)
    expect(AR_SPEED_SUPPRESS_THRESHOLD_KMH).toBe(15)
  })
})
