/**
 * AR浸水学習の「仮定した平面」の幾何計算。
 *
 * ここでの計算は、仮定した端末高と水平な仮想平面による学習イメージのためのもの。
 * 実際の地面の検出・道路の勾配・段差・建物形状・カメラの地面からの高さの測定は
 * 行わない。FOVも推定値を含むため、現地の浸水位置を測定・予測した結果としては
 * 扱わない。詳細は docs/plans/2026-10-30-ar-water-realistic-plan.md を参照。
 */

/** 仮想シーン内の基準となる端末高。実測した身長・目線ではない。 */
export const AR_ASSUMED_CAMERA_HEIGHT_M = 1.4
/** 有効な傾きの最終受信からこの時間を超えたら、イベントが来なくても期限切れにする。 */
export const TILT_STALE_MS = 1000

export interface DeviceTilt {
  /** DeviceOrientationEvent.beta（前後の傾き） */
  beta: number
  /** DeviceOrientationEvent.gamma（左右の傾き） */
  gamma: number
  /** screen.orientation.angle（0 / 90 / 180 / 270） */
  screenAngle: number
  /** 受信時刻（performance.now 相当のミリ秒） */
  timestamp: number
}

export interface CameraAttitude {
  /** 水平より上を正とするカメラの仰角（度） */
  pitchDeg: number
  /** 視線軸まわりの回転（度） */
  rollDeg: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** beta / gamma の両方が有限の数値のときだけ傾きとして扱う。 */
export function isValidTilt(value: Partial<DeviceTilt> | null | undefined): value is DeviceTilt {
  return Boolean(value) && isFiniteNumber(value?.beta) && isFiniteNumber(value?.gamma)
}

/** 有効な傾きの受信から TILT_STALE_MS を超えていないか。 */
export function isTiltFresh(tilt: DeviceTilt | null, now: number, staleMs: number = TILT_STALE_MS): boolean {
  if (!tilt) return false
  const age = now - tilt.timestamp
  return age >= 0 ? age <= staleMs : false
}

function normalizeScreenAngle(angle: number): number {
  if (!isFiniteNumber(angle)) return 0
  const wrapped = ((Math.round(angle / 90) * 90) % 360 + 360) % 360
  return wrapped
}

/**
 * 端末の傾きを、画面の向きに合わせたカメラのピッチ・ロールに変換する。
 *
 * 画面角0°（縦持ち）で、背面カメラが水平線を向く姿勢を pitch 0 とする。
 * W3C の Z-X'-Y'' 回転から、端末座標での鉛直上向きベクトルを求める。
 * 背面カメラの軸と画面の回転を合成し、そのベクトルから仰角とロールを取り出す。
 * alpha（鉛直軸まわりの方位）は鉛直ベクトルを変えないため不要。
 * https://www.w3.org/TR/orientation-event/#device-orientation-model
 */
export function tiltToAttitude(tilt: DeviceTilt): CameraAttitude {
  const beta = tilt.beta * Math.PI / 180
  const gamma = tilt.gamma * Math.PI / 180
  const screen = normalizeScreenAngle(tilt.screenAngle) * Math.PI / 180
  // Rz(alpha) * Rx(beta) * Ry(gamma) の第3行（端末各軸の鉛直成分）。
  const upX = -Math.cos(beta) * Math.sin(gamma)
  const upY = Math.sin(beta)
  const upZ = Math.cos(beta) * Math.cos(gamma)
  const rightUp = upX * Math.cos(screen) - upY * Math.sin(screen)
  const screenUp = upX * Math.sin(screen) + upY * Math.cos(screen)
  const horizontal = Math.hypot(rightUp, screenUp)
  const pitchDeg = Math.atan2(-upZ, horizontal) * 180 / Math.PI
  // 真上・真下ではロールが不定になるため、数値誤差で反転させない。
  const rollDeg = horizontal < 1e-10 ? 0 : Math.atan2(-rightUp, screenUp) * 180 / Math.PI
  return {
    pitchDeg: Math.abs(pitchDeg) < 1e-10 ? 0 : pitchDeg,
    rollDeg: Math.abs(rollDeg) < 1e-10 ? 0 : rollDeg,
  }
}

export interface TiltSmoother {
  push: (tilt: DeviceTilt) => CameraAttitude
  reset: () => void
  current: () => CameraAttitude | null
}

/**
 * センサーのばらつきを抑えるローパスフィルタ。
 * 無効値の受信・無効化・非表示・リスナー解除では reset() して、復帰後は新しい有効値を待つ。
 */
export function createTiltSmoother(timeConstantMs = 120): TiltSmoother {
  let value: CameraAttitude | null = null
  let lastAt: number | null = null
  return {
    push(tilt) {
      const next = tiltToAttitude(tilt)
      if (!value || lastAt === null) {
        value = next
        lastAt = tilt.timestamp
        return value
      }
      const dt = Math.max(0, tilt.timestamp - lastAt)
      const factor = timeConstantMs > 0 ? 1 - Math.exp(-dt / timeConstantMs) : 1
      const rollDelta = ((next.rollDeg - value.rollDeg + 180) % 360 + 360) % 360 - 180
      value = {
        pitchDeg: value.pitchDeg + (next.pitchDeg - value.pitchDeg) * factor,
        rollDeg: value.rollDeg + rollDelta * factor,
      }
      lastAt = tilt.timestamp
      return value
    },
    reset() {
      value = null
      lastAt = null
    },
    current() {
      return value
    },
  }
}

/** 仮想視点（仮定した端末高）が水面より下に入るか。利用者本人の水没高さの判定ではない。 */
export function isVirtualViewSubmerged(depthMeters: number, cameraHeightM: number = AR_ASSUMED_CAMERA_HEIGHT_M): boolean {
  return isFiniteNumber(depthMeters) && depthMeters > cameraHeightM
}

export interface DepthRange {
  depthMinMeters: number | null
  depthMaxMeters: number | null
}

export interface DepthTimelineStage {
  atMs: number
  depthMeters: number
}

export interface DepthTimeline {
  stages: DepthTimelineStage[]
  /** 上限のない区分。有限の上端を作らない。 */
  openUpper: boolean
  durationMs: number
  lowerMeters: number
  upperMeters: number | null
}

const RISE_MS = 2500
const HOLD_MS = 1500

/**
 * 水位のキーフレーム。0 → 下限 → 少し止める → 上限の順に上げる。
 * 深さの比較のための順序であり、実際の浸水の進行や所要時間を示さない。
 * 上限なしでは下限までで止め、有限の上限を作らない。深さ不明では null を返す。
 */
export function buildDepthTimeline(range: DepthRange): DepthTimeline | null {
  const { depthMinMeters: min, depthMaxMeters: max } = range
  if (!isFiniteNumber(min) && !isFiniteNumber(max)) return null
  const openUpper = !isFiniteNumber(max)
  const lower = isFiniteNumber(min) ? Math.max(0, min) : 0
  const upper = isFiniteNumber(max) ? Math.max(lower, max) : null
  const stages: DepthTimelineStage[] = [{ atMs: 0, depthMeters: 0 }]
  let at = 0
  if (lower > 0) {
    at += RISE_MS
    stages.push({ atMs: at, depthMeters: lower })
    at += HOLD_MS
    stages.push({ atMs: at, depthMeters: lower })
  }
  if (upper !== null && upper > lower) {
    at += RISE_MS
    stages.push({ atMs: at, depthMeters: upper })
    at += HOLD_MS
    stages.push({ atMs: at, depthMeters: upper })
  }
  if (stages.length === 1) {
    // 下限0・上限0のとき。水位は動かさない。
    at += HOLD_MS
    stages.push({ atMs: at, depthMeters: 0 })
  }
  return { stages, openUpper, durationMs: at, lowerMeters: lower, upperMeters: upper }
}

/** キーフレームの線形補間。終端では最後の値を保持し、繰り返さない。 */
export function depthAtMs(timeline: DepthTimeline, elapsedMs: number): number {
  const stages = timeline.stages
  if (!isFiniteNumber(elapsedMs) || elapsedMs <= 0) return stages[0].depthMeters
  const last = stages[stages.length - 1]
  if (elapsedMs >= last.atMs) return last.depthMeters
  for (let index = 1; index < stages.length; index += 1) {
    const previous = stages[index - 1]
    const current = stages[index]
    if (elapsedMs <= current.atMs) {
      const span = current.atMs - previous.atMs
      if (span <= 0) return current.depthMeters
      const ratio = (elapsedMs - previous.atMs) / span
      return previous.depthMeters + (current.depthMeters - previous.depthMeters) * ratio
    }
  }
  return last.depthMeters
}

/** 比較用の人物と目盛りを置く距離（m）。仮想シーン内の位置で、現地の地面を測った結果ではない。 */
export const REFERENCE_DISTANCE_M = 5

export interface ReferencePlacement {
  /** カメラからの距離（m） */
  distanceM: number
  /** 画面の中心からの横のずれ（m） */
  offsetXM: number
}

/**
 * 比較用の人物・目盛りの置き場所。
 *
 * 距離は固定にする。見かけの大きさを画面の割合にそろえると、実景の遠近と切り離れて
 * 「約170cm」に見えなくなるため、大きさは投影の結果に委ねる。
 * 横は画角に合わせ、狭い画角でも画面から外れないようにする（置き場所の調整であり、
 * 大きさは変えない）。
 */
export function referencePlacement(horizontalFovDeg: number, distanceM: number = REFERENCE_DISTANCE_M): ReferencePlacement {
  if (!Number.isFinite(horizontalFovDeg) || horizontalFovDeg <= 0) {
    return { distanceM, offsetXM: 0 }
  }
  const halfAngle = (Math.min(horizontalFovDeg, 170) * Math.PI) / 360
  return { distanceM, offsetXM: Math.tan(halfAngle * 0.55) * distanceM }
}

export interface VideoProjectionInput {
  videoWidth: number
  videoHeight: number
  displayWidth: number
  displayHeight: number
  /** 元映像全体の水平FOV（度）。取得元が不明なときは推定値として扱う。 */
  sourceHorizontalFovDeg: number
}

export interface VideoProjection {
  /** object-fit: cover で表示される元映像の割合（0〜1） */
  visibleFractionX: number
  visibleFractionY: number
  /** 切り抜き後の有効な画角（度） */
  horizontalFovDeg: number
  verticalFovDeg: number
  /** three.js の PerspectiveCamera に渡す値 */
  cameraFovDeg: number
  cameraAspect: number
}

function fovScale(fovDeg: number, fraction: number): number {
  const half = Math.tan((fovDeg * Math.PI) / 360) * fraction
  return (Math.atan(half) * 360) / Math.PI
}

/**
 * 元映像と表示領域から、中央基準の `object-fit: cover` の切り抜き量と有効な画角を求める。
 * 元映像のFOVを表示領域の比率だけで直接変換しない。メタデータ未取得では null を返す。
 */
export function computeVideoProjection(input: VideoProjectionInput): VideoProjection | null {
  const { videoWidth, videoHeight, displayWidth, displayHeight, sourceHorizontalFovDeg } = input
  if (![videoWidth, videoHeight, displayWidth, displayHeight, sourceHorizontalFovDeg].every(value => isFiniteNumber(value) && value > 0)) {
    return null
  }
  const scale = Math.max(displayWidth / videoWidth, displayHeight / videoHeight)
  const visibleFractionX = Math.min(1, displayWidth / scale / videoWidth)
  const visibleFractionY = Math.min(1, displayHeight / scale / videoHeight)
  const sourceVerticalFovDeg = fovScale(sourceHorizontalFovDeg, videoHeight / videoWidth)
  const horizontalFovDeg = fovScale(sourceHorizontalFovDeg, visibleFractionX)
  const verticalFovDeg = fovScale(sourceVerticalFovDeg, visibleFractionY)
  return {
    visibleFractionX,
    visibleFractionY,
    horizontalFovDeg,
    verticalFovDeg,
    cameraFovDeg: verticalFovDeg,
    cameraAspect: displayWidth / displayHeight,
  }
}

/**
 * 画面座標（0〜1、左上基準）→ 元映像のUV（0〜1、左上基準）。
 * 屈折シェーダーと背景で同じ変換を使い、歪みゼロのとき同じ点が一致することを基準にする。
 */
export function screenToVideoUv(projection: VideoProjection, x: number, y: number): { u: number; v: number } {
  return {
    u: (x - 0.5) * projection.visibleFractionX + 0.5,
    v: (y - 0.5) * projection.visibleFractionY + 0.5,
  }
}
