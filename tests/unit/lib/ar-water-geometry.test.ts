import { describe, expect, it } from 'vitest'
import { Euler, Quaternion, Vector3 } from 'three'
import {
  AR_ASSUMED_CAMERA_HEIGHT_M,
  buildDepthTimeline,
  computeVideoProjection,
  createTiltSmoother,
  depthAtMs,
  DEPTH_GAUGE_MAX_M,
  depthGaugeLayout,
  gaugeWaterMarkM,
  isTiltFresh,
  isValidTilt,
  isVirtualViewSubmerged,
  referencePlacement,
  REFERENCE_DISTANCE_M,
  screenToVideoUv,
  SUBMERGED_MURK_MAX_OPACITY,
  submergedMurkOpacity,
  tiltToAttitude,
  waterLevelLabel,
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
  it.each([
    [90, 0, 0],
    [0, -90, 90],
    [-90, 0, 180],
    [0, 90, 270],
  ])('keeps a level rear camera level at beta=%s gamma=%s screen=%s', (beta, gamma, angle) => {
    const attitude = tiltToAttitude(tilt(beta, gamma, angle))
    expect(attitude.pitchDeg).toBeCloseTo(0, 8)
    expect(attitude.rollDeg).toBeCloseTo(0, 8)
  })
  it.each([
    [60, 0, 0],
    [0, -60, 90],
    [-60, 0, 180],
    [0, 60, 270],
  ])('preserves a 30 degree downward view across screen orientations (%s, %s, %s)', (beta, gamma, angle) => {
    const attitude = tiltToAttitude(tilt(beta, gamma, angle))
    expect(attitude.pitchDeg).toBeCloseTo(-30, 8)
    expect(attitude.rollDeg).toBeCloseTo(0, 8)
  })
  it.each([0, 90, 180, 270])('matches composed 3D rotations for compound tilt at screen=%s', angle => {
    const radians = Math.PI / 180
    // Independent quaternion reference: device orientation, rear-camera axis, then screen rotation.
    const reference = new Quaternion().setFromEuler(new Euler(60 * radians, 0, -30 * radians, 'YXZ'))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -angle * radians))
    const attitude = tiltToAttitude(tilt(60, 30, angle))
    const actual = new Quaternion().setFromEuler(new Euler(attitude.pitchDeg * radians, 0, -attitude.rollDeg * radians, 'YXZ'))
    // Heading is intentionally omitted, but all camera axes must have the same elevation.
    for (const axis of [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, -1)]) {
      expect(axis.clone().applyQuaternion(actual).y).toBeCloseTo(axis.clone().applyQuaternion(reference).y, 8)
    }
  })
  it('handles the horizontal landscape pose from the W3C example without pitching upward', () => {
    const attitude = tiltToAttitude(tilt(0, 89.9, 90))
    expect(attitude.pitchDeg).toBeCloseTo(-0.1, 8)
    expect(Math.abs(attitude.rollDeg)).toBeCloseTo(180, 8)
  })
  it.each([0, 180])('returns a finite attitude when looking straight down or up (beta=%s)', beta => {
    const attitude = tiltToAttitude(tilt(beta, 0, 0))
    expect(Math.abs(attitude.pitchDeg)).toBeCloseTo(90, 8)
    expect(Number.isFinite(attitude.rollDeg)).toBe(true)
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
    expect(smoother.push({ beta: 120, gamma: 0, screenAngle: 0, timestamp: 500 }).pitchDeg).toBeCloseTo(30)
  })
  it('smooths roll across the 180 degree boundary via the shortest rotation', () => {
    const smoother = createTiltSmoother(100)
    const before = smoother.push(tilt(-90, -5, 0))
    const after = smoother.push({ ...tilt(-90, 5, 0), timestamp: 100 })
    expect(Math.abs(after.rollDeg - before.rollDeg)).toBeLessThan(10)
    expect(Math.abs(after.rollDeg)).toBeGreaterThan(170)
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

describe('reference placement', () => {
  it('keeps the distance fixed so the apparent size follows the projection', () => {
    const narrow = referencePlacement(17)
    const wide = referencePlacement(62)
    expect(narrow.distanceM).toBe(REFERENCE_DISTANCE_M)
    expect(wide.distanceM).toBe(REFERENCE_DISTANCE_M)
    // 横の位置だけを画角に合わせる（狭い画角では中央寄りに置く）
    expect(narrow.offsetXM).toBeLessThan(wide.offsetXM)
    expect(narrow.offsetXM).toBeGreaterThan(0)
  })
  it('stays inside the frame', () => {
    for (const fov of [12, 30, 60, 90]) {
      const { distanceM, offsetXM } = referencePlacement(fov)
      const halfWidthAtDistance = Math.tan((fov * Math.PI) / 360) * distanceM
      expect(offsetXM).toBeLessThan(halfWidthAtDistance)
    }
  })
  it('falls back to the centre when the field of view is unknown', () => {
    expect(referencePlacement(Number.NaN).offsetXM).toBe(0)
    expect(referencePlacement(0).offsetXM).toBe(0)
  })
})

describe('submerged view legibility', () => {
  // 2026-11-14: 津波 5〜10m で濁りが 82% の黒になり、景色・人物・目盛りが読めなくなった。
  it('never darkens the camera past the legibility limit, however deep', () => {
    for (const depth of [1.5, 3, 5, 10, 20, 100]) {
      const opacity = submergedMurkOpacity(depth)
      expect(opacity).toBeGreaterThan(0)
      expect(opacity).toBeLessThanOrEqual(SUBMERGED_MURK_MAX_OPACITY)
    }
    expect(SUBMERGED_MURK_MAX_OPACITY).toBeLessThanOrEqual(0.55)
  })
  it('gets denser with depth and is absent above the surface', () => {
    expect(submergedMurkOpacity(0)).toBe(0)
    expect(submergedMurkOpacity(AR_ASSUMED_CAMERA_HEIGHT_M)).toBe(0)
    expect(submergedMurkOpacity(Number.NaN)).toBe(0)
    expect(submergedMurkOpacity(5)).toBeGreaterThan(submergedMurkOpacity(2))
    expect(submergedMurkOpacity(10)).toBeGreaterThanOrEqual(submergedMurkOpacity(5))
  })
})

describe('depth gauge layout', () => {
  const layout = (min: number | null, max: number | null) => depthGaugeLayout(buildDepthTimeline({ depthMinMeters: min, depthMaxMeters: max })!)
  it('reaches the upper end of a 5-10m zone', () => {
    expect(layout(5, 10)).toEqual({ topM: DEPTH_GAUGE_MAX_M, beyondTop: false })
  })
  it('keeps a shallow zone short', () => {
    expect(layout(0, 0.5)).toEqual({ topM: 1, beyondTop: false })
    expect(layout(0.5, 3)).toEqual({ topM: 3.5, beyondTop: false })
  })
  it('marks zones deeper than the gauge instead of drawing an endless column', () => {
    expect(layout(10, 20)).toEqual({ topM: DEPTH_GAUGE_MAX_M, beyondTop: true })
    expect(layout(20, null)).toEqual({ topM: DEPTH_GAUGE_MAX_M, beyondTop: true })
  })
  it('labels the current level, and never states an open-ended lower bound as the level', () => {
    expect(waterLevelLabel(0, { openUpper: false, lowerMeters: 5 })).toBe('')
    expect(waterLevelLabel(Number.NaN, { openUpper: false, lowerMeters: 5 })).toBe('')
    expect(waterLevelLabel(7.34, { openUpper: false, lowerMeters: 5 })).toBe('水面 7.3m')
    expect(waterLevelLabel(20, { openUpper: false, lowerMeters: 10 })).toBe('水面 20.0m')
    expect(waterLevelLabel(3, { openUpper: true, lowerMeters: 5 })).toBe('水面 3.0m')
    expect(waterLevelLabel(5, { openUpper: true, lowerMeters: 5 })).toBe('水面 5.0m以上')
  })
  it('places the water mark at the depth and stops at the top of the gauge', () => {
    expect(gaugeWaterMarkM(0, 10)).toBe(0)
    expect(gaugeWaterMarkM(7.3, 10)).toBe(7.3)
    expect(gaugeWaterMarkM(15, 10)).toBe(10)
    expect(gaugeWaterMarkM(Number.NaN, 10)).toBe(0)
  })
})
