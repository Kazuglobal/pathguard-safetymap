import { describe, expect, it } from 'vitest'
import {
  AR_ASSUMED_CAMERA_HEIGHT_M,
  buildDepthTimeline,
  computeVideoProjection,
  createTiltSmoother,
  depthAtMs,
  isTiltFresh,
  isValidTilt,
  isVirtualViewSubmerged,
  screenToVideoUv,
  tiltToAttitude,
  TILT_STALE_MS,
} from '@/lib/ar-water-geometry'

const tilt = (beta: number, gamma: number, screenAngle: number) => ({ beta, gamma, screenAngle, timestamp: 0 })

describe('tilt handling', () => {
  it('rejects missing or non numeric tilt', () => {
    expect(isValidTilt(null)).toBe(false)
    expect(isValidTilt({ beta: null as unknown as number, gamma: 0, screenAngle: 0, timestamp: 0 })).toBe(false)
    expect(isValidTilt({ beta: Number.NaN, gamma: 0, screenAngle: 0, timestamp: 0 })).toBe(false)
    expect(isValidTilt(tilt(90, 0, 0))).toBe(true)
  })
  it('expires tilt that is older than the stale window', () => {
    const value = tilt(90, 0, 0)
    expect(isTiltFresh(value, TILT_STALE_MS)).toBe(true)
    expect(isTiltFresh(value, TILT_STALE_MS + 1)).toBe(false)
    expect(isTiltFresh(null, 0)).toBe(false)
  })
  it('maps tilt to pitch and roll for each screen angle', () => {
    expect(tiltToAttitude(tilt(90, 0, 0))).toEqual({ pitchDeg: 0, rollDeg: 0 })
    expect(tiltToAttitude(tilt(80, 5, 0))).toEqual({ pitchDeg: -10, rollDeg: 5 })
    expect(tiltToAttitude(tilt(80, 5, 90))).toEqual({ pitchDeg: 5, rollDeg: 10 })
    expect(tiltToAttitude(tilt(80, 5, 180))).toEqual({ pitchDeg: 10, rollDeg: -5 })
    expect(tiltToAttitude(tilt(80, 5, 270))).toEqual({ pitchDeg: -5, rollDeg: -10 })
  })
  it('smooths towards new values and resets', () => {
    const smoother = createTiltSmoother(100)
    expect(smoother.current()).toBeNull()
    expect(smoother.push(tilt(90, 0, 0)).pitchDeg).toBe(0)
    const moved = smoother.push({ beta: 120, gamma: 0, screenAngle: 0, timestamp: 100 })
    expect(moved.pitchDeg).toBeGreaterThan(0)
    expect(moved.pitchDeg).toBeLessThan(30)
    smoother.reset()
    expect(smoother.current()).toBeNull()
    expect(smoother.push({ beta: 120, gamma: 0, screenAngle: 0, timestamp: 500 }).pitchDeg).toBe(30)
  })
  it('treats the virtual viewpoint as submerged only past the assumed height', () => {
    expect(isVirtualViewSubmerged(AR_ASSUMED_CAMERA_HEIGHT_M)).toBe(false)
    expect(isVirtualViewSubmerged(AR_ASSUMED_CAMERA_HEIGHT_M + 0.1)).toBe(true)
  })
})

describe('depth timeline', () => {
  it('rises to the lower bound and then the upper bound', () => {
    const timeline = buildDepthTimeline({ depthMinMeters: 0.5, depthMaxMeters: 3 })!
    expect(timeline.openUpper).toBe(false)
    expect(depthAtMs(timeline, 0)).toBe(0)
    expect(depthAtMs(timeline, 2500)).toBeCloseTo(0.5)
    expect(depthAtMs(timeline, 3200)).toBeCloseTo(0.5)
    expect(depthAtMs(timeline, timeline.durationMs)).toBeCloseTo(3)
    expect(depthAtMs(timeline, timeline.durationMs + 10_000)).toBeCloseTo(3)
  })
  it('never invents a finite upper endpoint for an open range', () => {
    const timeline = buildDepthTimeline({ depthMinMeters: 20, depthMaxMeters: null })!
    expect(timeline.openUpper).toBe(true)
    expect(timeline.upperMeters).toBeNull()
    expect(Math.max(...timeline.stages.map(stage => stage.depthMeters))).toBe(20)
  })
  it('returns null when the depth is unknown', () => {
    expect(buildDepthTimeline({ depthMinMeters: null, depthMaxMeters: null })).toBeNull()
  })
  it('handles an upper bound without a lower bound', () => {
    const timeline = buildDepthTimeline({ depthMinMeters: null, depthMaxMeters: 1 })!
    expect(timeline.lowerMeters).toBe(0)
    expect(depthAtMs(timeline, timeline.durationMs)).toBeCloseTo(1)
  })
})

describe('video projection', () => {
  it('returns null until video metadata and layout are known', () => {
    expect(computeVideoProjection({ videoWidth: 0, videoHeight: 0, displayWidth: 390, displayHeight: 700, sourceHorizontalFovDeg: 60 })).toBeNull()
    expect(computeVideoProjection({ videoWidth: 1280, videoHeight: 720, displayWidth: 0, displayHeight: 0, sourceHorizontalFovDeg: 60 })).toBeNull()
  })
  it('crops the source from the centre for a portrait viewport', () => {
    const projection = computeVideoProjection({ videoWidth: 1280, videoHeight: 720, displayWidth: 390, displayHeight: 780, sourceHorizontalFovDeg: 60 })!
    // 16:9 の映像を 1:2 の領域に cover すると、水平方向だけが切り取られる。
    expect(projection.visibleFractionY).toBeCloseTo(1)
    expect(projection.visibleFractionX).toBeCloseTo(0.28125, 5)
    expect(projection.horizontalFovDeg).toBeLessThan(60)
    expect(screenToVideoUv(projection, 0.5, 0.5)).toEqual({ u: 0.5, v: 0.5 })
    const left = screenToVideoUv(projection, 0, 0.5)
    expect(left.u).toBeCloseTo(0.5 - 0.28125 / 2, 5)
  })
  it('does not convert the source fov by the viewport ratio alone', () => {
    const projection = computeVideoProjection({ videoWidth: 1280, videoHeight: 720, displayWidth: 390, displayHeight: 780, sourceHorizontalFovDeg: 60 })!
    const halfSource = Math.tan((60 * Math.PI) / 360)
    expect(Math.tan((projection.horizontalFovDeg * Math.PI) / 360)).toBeCloseTo(halfSource * projection.visibleFractionX, 6)
    // 垂直は元映像の比率から求めた画角を基準にする。
    const sourceVerticalHalf = halfSource * (720 / 1280)
    expect(Math.tan((projection.verticalFovDeg * Math.PI) / 360)).toBeCloseTo(sourceVerticalHalf * projection.visibleFractionY, 6)
    expect(projection.cameraFovDeg).toBeCloseTo(projection.verticalFovDeg, 6)
    expect(projection.cameraAspect).toBeCloseTo(0.5, 6)
  })
  it('crops vertically for a landscape viewport wider than the source', () => {
    const projection = computeVideoProjection({ videoWidth: 1280, videoHeight: 720, displayWidth: 1000, displayHeight: 400, sourceHorizontalFovDeg: 60 })!
    expect(projection.visibleFractionX).toBeCloseTo(1)
    expect(projection.visibleFractionY).toBeCloseTo(512 / 720, 5)
    const top = screenToVideoUv(projection, 0.5, 0)
    expect(top.v).toBeCloseTo(0.5 - 512 / 720 / 2, 5)
  })
})
