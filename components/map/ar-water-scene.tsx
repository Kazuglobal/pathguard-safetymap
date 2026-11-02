'use client'

import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Component, useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ARWaterCanvas } from './ar-water-canvas'
import {
  AR_ASSUMED_CAMERA_HEIGHT_M,
  computeVideoProjection,
  createTiltSmoother,
  depthAtMs,
  isTiltFresh,
  isVirtualViewSubmerged,
  type DepthTimeline,
  type DeviceTilt,
} from '@/lib/ar-water-geometry'

/**
 * 仮定した水平な平面に水面を描く学習用のシーン。
 *
 * 実際の地面・勾配・段差・建物の形状は取得しない。屈折は画面上の視覚効果で、
 * 現実の物体の深度を用いた計算ではない。現地の浸水位置の再現ではない。
 */
export interface ARWaterSceneProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  tiltRef: React.RefObject<DeviceTilt | null>
  timeline: DepthTimeline
  hazard: 'flood' | 'tsunami'
  /** 再生中か。false では水位・波・がれきの時間を進めない。 */
  playing: boolean
  /** 動きを減らす設定。水位上昇・波・がれきを止める。 */
  reducedMotion: boolean
  /** 再生のやり直し。値が変わると時間を0へ戻す。 */
  replayKey: number
  /** 元映像全体の水平FOV（度・推定値を含む） */
  sourceHorizontalFovDeg: number
  onDepthChange?: (depthMeters: number, submerged: boolean) => void
  /** 仮想視点が水面下に入った・出たときだけ呼ぶ（毎フレームは呼ばない）。 */
  onSubmergedChange?: (submerged: boolean) => void
  /** WebGLの初期化失敗・描画エラー・コンテキスト喪失。人物の比較図へ退避する。 */
  onFailure: (reason: string) => void
}

const WATER_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uWaveAmplitude;
varying vec3 vWorldPosition;

void main() {
  vec3 transformed = position;
  // ゆるやかなうねりだけを頂点で動かす。細かい波は面で法線として作る。
  transformed.z += sin(position.x * 0.35 + uTime * 0.6) * cos(position.y * 0.3 - uTime * 0.45) * uWaveAmplitude * 2.0;
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vWorldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const MURK_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const MURK_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
}

void main() {
  // 水中に漂う細かい粒。水の中にいることの手がかりにする。
  vec2 grid = vUv * vec2(26.0, 46.0);
  grid.y += uTime * 0.35;
  vec2 cell = floor(grid);
  vec2 local = fract(grid) - 0.5;
  float speck = smoothstep(0.42, 0.0, length(local) + hash(cell) * 0.35);
  float shade = 1.0 + speck * 0.5;
  gl_FragColor = vec4(uColor * shade, uOpacity);
}
`

const WATER_FRAGMENT = /* glsl */ `
uniform sampler2D uVideo;
uniform float uHasVideo;
uniform vec2 uVisibleFraction;
uniform vec2 uResolution;
uniform vec3 uShallowColor;
uniform vec3 uDeepColor;
uniform float uTurbidity;
uniform float uFoam;
uniform float uRefraction;
uniform float uUnderwater;
uniform float uTime;
uniform float uDepth;
uniform float uWaveAmplitude;
uniform mat4 uViewProjection;
varying vec3 vWorldPosition;

// 画面座標 → 元映像のUV。lib/ar-water-geometry.ts の screenToVideoUv と同じ式。
vec2 screenToVideoUv(vec2 screenUv) {
  return (screenUv - 0.5) * uVisibleFraction + 0.5;
}

vec3 sampleScene(vec2 screenUv, vec3 fallback) {
  if (uHasVideo < 0.5) return fallback;
  return texture2D(uVideo, screenToVideoUv(clamp(screenUv, 0.0, 1.0))).rgb;
}

void main() {
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  vec2 p = vWorldPosition.xz;
  float distance = length(vWorldPosition.xz - cameraPosition.xz);
  // 遠くの細かい波は潰れるので弱める。
  float detail = uWaveAmplitude / (1.0 + distance * 0.5);

  // 向きと周期をそろえない4つの波を重ねる。1つの式の繰り返しだと、
  // 同心円や格子のような模様が水面に出てしまう。
  vec2 dirA = vec2(0.98, 0.21);
  vec2 dirB = vec2(-0.42, 0.91);
  vec2 dirC = vec2(0.63, -0.77);
  vec2 dirD = vec2(-0.86, -0.51);
  float waveA = sin(dot(dirA, p) * 2.3 + uTime * 1.1);
  float waveB = sin(dot(dirB, p) * 3.7 + uTime * 1.6);
  float waveC = sin(dot(dirC, p) * 5.9 - uTime * 2.3);
  float waveD = sin(dot(dirD, p) * 8.9 + uTime * 3.1);
  vec2 slope = (
    dirA * 2.3 * cos(dot(dirA, p) * 2.3 + uTime * 1.1) * 1.0 +
    dirB * 3.7 * cos(dot(dirB, p) * 3.7 + uTime * 1.6) * 0.6 +
    dirC * 5.9 * cos(dot(dirC, p) * 5.9 - uTime * 2.3) * 0.32 +
    dirD * 8.9 * cos(dot(dirD, p) * 8.9 + uTime * 3.1) * 0.16
  ) * detail;
  float crest = waveA * 1.0 + waveB * 0.6 + waveC * 0.32 + waveD * 0.16;
  vec3 normal = normalize(vec3(-slope.x, 1.0, -slope.y));

  vec3 view = normalize(vWorldPosition - cameraPosition);
  // 水の中（屈折）。画面の歪みとして扱い、現実の奥行きは使わない。
  vec2 refractUv = screenUv + normal.xz * uRefraction;
  vec3 behind = sampleScene(refractUv, uDeepColor);

  // 水面に映る景色（平面反射）。カメラ映像をそのまま映すので、実際の背景と合う。
  vec3 reflected = reflect(view, normal);
  vec4 clip = uViewProjection * vec4(vWorldPosition + reflected * 30.0, 1.0);
  vec3 skyFallback = sampleScene(vec2(screenUv.x, 0.96), uShallowColor);
  vec3 mirror = clip.w > 0.0
    ? sampleScene(clip.xy / clip.w * 0.5 + 0.5, skyFallback)
    : skyFallback;

  // 深さと見通し距離で濁る。浅いときは路面が透ける。
  float depthMix = clamp(distance / 16.0, 0.0, 1.0);
  vec3 tint = mix(uShallowColor, uDeepColor, depthMix);
  float muddiness = clamp(uTurbidity * (0.3 + uDepth * 0.3) + depthMix * 0.4, 0.0, 0.93);
  vec3 underwater = mix(behind, tint, muddiness);

  // 浅い角度ほど映り込みが強い（フレネル）。真下を見るほど水の中が見える。
  float fresnel = pow(1.0 - clamp(dot(-view, normal), 0.0, 1.0), 4.0);
  // 濁った水ほど、景色をきれいには映さない（津波は黒く濁る想定）。
  float reflectivity = clamp(0.06 + fresnel * 1.15, 0.06, 0.92) * (1.0 - uTurbidity * 0.5);
  vec3 color = mix(underwater, mirror, reflectivity);

  // 日差しのきらめきと泡。水面であることの手がかりにする。
  float glint = pow(max(dot(reflected, normalize(vec3(0.25, 0.75, -0.6))), 0.0), 90.0);
  color += glint * 0.55 * (1.0 - depthMix * 0.5);
  float foam = smoothstep(1.25, 2.0, crest) * uFoam;
  color += foam * 0.3;

  if (uUnderwater > 0.5) {
    color = mix(color, uDeepColor, 0.5);
  }
  gl_FragColor = vec4(color, clamp(0.88 + uTurbidity * 0.08, 0.0, 0.97));
}
`

interface PaletteEntry {
  shallow: THREE.Color
  deep: THREE.Color
  turbidity: number
  foam: number
  waveAmplitude: number
  refraction: number
}

const debrisDummy = new THREE.Object3D()

/** 比較用の人物の身長（m）。一般的な目安で、利用者本人の計測値ではない。 */
const REFERENCE_PERSON_HEIGHT_M = 1.7
/** 人物と目盛りを置く距離（m）の範囲。仮想シーン内の位置で、現地の地面を測った結果ではない。 */
const REFERENCE_DISTANCE_MIN_M = 4
const REFERENCE_DISTANCE_MAX_M = 14
/** 人物の見かけの高さを、画面の縦の画角のどれくらいに収めるか。 */
const REFERENCE_PERSON_SCREEN_RATIO = 0.42
const GAUGE_BAND_M = 0.5
const GAUGE_MAX_M = 6

/** 水面と同じ投影で見える、身長の目安と深さの目盛り。 */
function DepthReference({ hazard, gaugeTopM, openUpper, horizontalFovRef, verticalFovRef }: {
  hazard: 'flood' | 'tsunami'
  gaugeTopM: number
  /** 上限のない区分。有限の上端を作らず、上向きの表示にとどめる。 */
  openUpper: boolean
  horizontalFovRef: React.RefObject<number>
  verticalFovRef: React.RefObject<number>
}) {
  const personRef = useRef<THREE.Group>(null)
  const gaugeRef = useRef<THREE.Group>(null)
  useFrame(() => {
    const horizontalFov = horizontalFovRef.current
    const verticalFov = verticalFovRef.current
    if (!horizontalFov || !verticalFov) return
    // 映像の切り抜きで画角は狭くなる。人物が画面の約4割に収まる距離へ置き、
    // 左右は画角の55%の位置にする（狭い画角でも画面から外れない）。
    const targetHalfAngle = THREE.MathUtils.degToRad(verticalFov * REFERENCE_PERSON_SCREEN_RATIO) / 2
    const distance = THREE.MathUtils.clamp(
      REFERENCE_PERSON_HEIGHT_M / 2 / Math.tan(targetHalfAngle),
      REFERENCE_DISTANCE_MIN_M,
      REFERENCE_DISTANCE_MAX_M,
    )
    const offset = Math.tan(THREE.MathUtils.degToRad(horizontalFov / 2) * 0.55) * distance
    if (personRef.current) personRef.current.position.set(offset, 0, -distance)
    // 目盛りは少し奥に置く。3mまでの柱が画面の上で切れにくくなる。
    const gaugeDistance = distance * 1.45
    if (gaugeRef.current) gaugeRef.current.position.set(-offset * 1.45, 0, -gaugeDistance)
  })
  const texture = useMemo(() => {
    const loaded = new THREE.TextureLoader().load('/images/ar/height-reference-adult.png')
    loaded.colorSpace = THREE.SRGBColorSpace
    return loaded
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  const bands = Math.max(1, Math.round(Math.min(gaugeTopM, GAUGE_MAX_M) / GAUGE_BAND_M))
  const accent = hazard === 'flood' ? '#0891b2' : '#7e22ce'
  const ground = -AR_ASSUMED_CAMERA_HEIGHT_M
  return (
    <group>
      <group ref={personRef} position={[0.95, 0, -REFERENCE_DISTANCE_MIN_M]}>
        <mesh position={[0, ground + REFERENCE_PERSON_HEIGHT_M / 2, 0]} renderOrder={0}>
          <planeGeometry args={[REFERENCE_PERSON_HEIGHT_M * 0.5, REFERENCE_PERSON_HEIGHT_M]} />
          <meshBasicMaterial map={texture} transparent alphaTest={0.4} toneMapped={false} />
        </mesh>
        <Html position={[0, ground + REFERENCE_PERSON_HEIGHT_M + 0.25, 0]} center zIndexRange={[1, 0]}>
          <span className="ar-scene-chip">大人 約170cm</span>
        </Html>
      </group>
      <group ref={gaugeRef} position={[-0.95, 0, -REFERENCE_DISTANCE_MIN_M]}>
        {Array.from({ length: bands }, (_, index) => (
          <mesh key={index} position={[0, ground + GAUGE_BAND_M * (index + 0.5), 0]} renderOrder={0}>
            <boxGeometry args={[0.16, GAUGE_BAND_M, 0.16]} />
            <meshBasicMaterial color={index % 2 === 0 ? '#fffdf7' : accent} toneMapped={false} />
          </mesh>
        ))}
        {Array.from({ length: Math.floor(Math.min(gaugeTopM, GAUGE_MAX_M)) }, (_, index) => index + 1).map(meters => (
          <Html key={meters} position={[0, ground + meters, 0]} center zIndexRange={[1, 0]}>
            <span className="ar-scene-chip ar-scene-chip--gauge">{meters}m</span>
          </Html>
        ))}
        {openUpper && (
          <Html position={[0, ground + Math.min(gaugeTopM, GAUGE_MAX_M) + 0.3, 0]} center zIndexRange={[1, 0]}>
            <span className="ar-scene-chip ar-scene-chip--gauge">↑ 上限なし</span>
          </Html>
        )}
      </group>
    </group>
  )
}

const PALETTE: Record<'flood' | 'tsunami', PaletteEntry> = {
  flood: {
    shallow: new THREE.Color('#9d8441'),
    deep: new THREE.Color('#4f4526'),
    turbidity: 0.42,
    foam: 0.22,
    waveAmplitude: 0.028,
    refraction: 0.012,
  },
  tsunami: {
    shallow: new THREE.Color('#514f58'),
    deep: new THREE.Color('#1d1b23'),
    turbidity: 0.78,
    foam: 0.6,
    waveAmplitude: 0.06,
    refraction: 0.022,
  },
}

function WaterPlane({
  videoRef,
  tiltRef,
  timeline,
  hazard,
  playing,
  reducedMotion,
  replayKey,
  sourceHorizontalFovDeg,
  onDepthChange,
  onSubmergedChange,
}: ARWaterSceneProps) {
  const { camera, size, gl } = useThree()
  const meshRef = useRef<THREE.Mesh>(null)
  const debrisRef = useRef<THREE.InstancedMesh>(null)
  // 仮想視点が水面下に入ったときの全体の濁り。視線に合わせてカメラの前に置く。
  const murkRef = useRef<THREE.Mesh>(null)
  const horizontalFovRef = useRef<number>(0)
  const verticalFovRef = useRef<number>(0)
  const submergedRef = useRef(false)
  const smoother = useMemo(() => createTiltSmoother(), [])
  const animationMsRef = useRef(0)
  const videoTextureRef = useRef<THREE.VideoTexture | null>(null)
  const videoSizeRef = useRef<string>('')
  const palette = PALETTE[hazard]
  // 目盛りの高さは、その地点の深さに必要な分だけにする（上は0.5mの余白）。
  const gaugeTopM = useMemo(() => {
    const needed = timeline.upperMeters ?? timeline.lowerMeters ?? 1
    return THREE.MathUtils.clamp(Math.ceil(needed * 2) / 2 + 0.5, 1, GAUGE_MAX_M)
  }, [timeline])

  const murkUniforms = useMemo(
    () => ({ uColor: { value: palette.deep.clone() }, uOpacity: { value: 0.6 }, uTime: { value: 0 } }),
    [palette],
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWaveAmplitude: { value: palette.waveAmplitude },
      uVideo: { value: null as THREE.VideoTexture | null },
      uHasVideo: { value: 0 },
      uVisibleFraction: { value: new THREE.Vector2(1, 1) },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uShallowColor: { value: palette.shallow.clone() },
      uDeepColor: { value: palette.deep.clone() },
      uTurbidity: { value: palette.turbidity },
      uFoam: { value: palette.foam },
      uRefraction: { value: palette.refraction },
      uUnderwater: { value: 0 },
      uDepth: { value: 0 },
      uViewProjection: { value: new THREE.Matrix4() },
    }),
    [palette],
  )

  // 災害の種類が変わったら、色と質感を入れ替える（シーンは作り直さない）。
  useEffect(() => {
    uniforms.uShallowColor.value.copy(palette.shallow)
    uniforms.uDeepColor.value.copy(palette.deep)
    uniforms.uTurbidity.value = palette.turbidity
    uniforms.uFoam.value = palette.foam
    uniforms.uRefraction.value = palette.refraction
    uniforms.uWaveAmplitude.value = palette.waveAmplitude
  }, [palette, uniforms])

  // 再生のやり直しと、深さの変更で時間を戻す。
  useEffect(() => {
    animationMsRef.current = 0
    smoother.reset()
  }, [replayKey, timeline, smoother])

  useEffect(() => () => {
    if (submergedRef.current) {
      submergedRef.current = false
      onSubmergedChange?.(false)
    }
  }, [onSubmergedChange])

  // 映像のメタデータとフレームが使えるようになってから VideoTexture を作る。
  useEffect(() => {
    return () => {
      videoTextureRef.current?.dispose()
      videoTextureRef.current = null
      videoSizeRef.current = ''
    }
  }, [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    const material = mesh?.material as THREE.ShaderMaterial | undefined
    if (!mesh || !material) return

    const video = videoRef.current
    const ready = Boolean(video && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0)
    if (video && ready) {
      const key = `${video.videoWidth}x${video.videoHeight}`
      if (videoSizeRef.current !== key) {
        videoTextureRef.current?.dispose()
        const texture = new THREE.VideoTexture(video)
        texture.colorSpace = THREE.SRGBColorSpace
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        videoTextureRef.current = texture
        videoSizeRef.current = key
        uniforms.uVideo.value = texture
      }
      const projection = computeVideoProjection({
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        displayWidth: size.width,
        displayHeight: size.height,
        sourceHorizontalFovDeg,
      })
      if (projection) {
        uniforms.uHasVideo.value = 1
        horizontalFovRef.current = projection.horizontalFovDeg
        verticalFovRef.current = projection.verticalFovDeg
        uniforms.uVisibleFraction.value.set(projection.visibleFractionX, projection.visibleFractionY)
        const perspective = camera as THREE.PerspectiveCamera
        if (perspective.isPerspectiveCamera) {
          if (Math.abs(perspective.fov - projection.cameraFovDeg) > 0.01 || Math.abs(perspective.aspect - projection.cameraAspect) > 0.001) {
            perspective.fov = projection.cameraFovDeg
            perspective.aspect = projection.cameraAspect
            perspective.updateProjectionMatrix()
          }
        }
      }
    } else {
      uniforms.uHasVideo.value = 0
    }
    uniforms.uResolution.value.set(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio())

    // 傾きは停止中も反映する（最新の映像と端末の姿勢に追従する）。
    const tilt = tiltRef.current
    if (tilt && isTiltFresh(tilt, typeof performance !== 'undefined' ? performance.now() : Date.now())) {
      const attitude = smoother.push(tilt)
      camera.rotation.set(THREE.MathUtils.degToRad(attitude.pitchDeg), 0, THREE.MathUtils.degToRad(-attitude.rollDeg), 'YXZ')
    }

    // アニメーション時刻は描画時刻と独立。停止中と動きを減らす設定では進めない。
    if (playing && !reducedMotion) {
      animationMsRef.current += delta * 1000
    }
    const elapsed = reducedMotion ? timeline.durationMs : animationMsRef.current
    const depth = depthAtMs(timeline, elapsed)
    const submerged = isVirtualViewSubmerged(depth)
    uniforms.uUnderwater.value = submerged ? 1 : 0
    uniforms.uDepth.value = depth
    // 映り込みを画面座標へ投影するために、毎フレームの視点行列を渡す。
    uniforms.uViewProjection.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    uniforms.uTime.value = reducedMotion ? 0 : animationMsRef.current / 1000
    mesh.position.y = -AR_ASSUMED_CAMERA_HEIGHT_M + depth

    // 水面下では、視線に追従する板で全体を濁らせる。水面の裏側は同じ平面を両面で描く。
    const murk = murkRef.current
    if (murk) {
      murk.visible = submerged
      if (submerged) {
        const perspective = camera as THREE.PerspectiveCamera
        const distance = Math.max((perspective.near ?? 0.05) * 2, 0.12)
        const height = 2 * distance * Math.tan(THREE.MathUtils.degToRad((perspective.fov ?? 60) / 2))
        murk.scale.set(height * (perspective.aspect ?? 1) * 1.2, height * 1.2, 1)
        murk.position.set(0, 0, -distance)
        murkUniforms.uColor.value.copy(palette.deep)
        // 深いほど濃くする。上限を置き、数値と目盛りが読めなくならないようにする。
        murkUniforms.uOpacity.value = Math.min(0.82, 0.5 + (depth - AR_ASSUMED_CAMERA_HEIGHT_M) * 0.04)
        // 動きを減らす設定では粒を流さない。
        murkUniforms.uTime.value = reducedMotion ? 0 : animationMsRef.current / 1000
      }
    }
    if (submergedRef.current !== submerged) {
      submergedRef.current = submerged
      onSubmergedChange?.(submerged)
    }

    const debris = debrisRef.current
    if (debris) {
      debris.visible = hazard === 'tsunami' && !reducedMotion
      if (debris.visible) {
        for (let index = 0; index < debris.count; index += 1) {
          const seed = index * 1.7
          const time = uniforms.uTime.value
          // 向きの定まらない揺れだけで動かす。一方向へ流さない。
          debrisDummy.position.set(
            Math.sin(seed * 3.1) * 5 + Math.sin(time * 0.7 + seed) * 0.12,
            mesh.position.y + 0.04 + Math.sin(time * 1.3 + seed) * 0.03,
            -2 - Math.abs(Math.cos(seed * 2.3)) * 9 + Math.cos(time * 0.6 + seed) * 0.12,
          )
          debrisDummy.rotation.set(Math.PI / 2, Math.sin(time * 0.5 + seed) * 0.4, seed)
          debrisDummy.updateMatrix()
          debris.setMatrixAt(index, debrisDummy.matrix)
        }
        debris.instanceMatrix.needsUpdate = true
      }
    }

    onDepthChange?.(depth, submerged)
  })

  return (
    <>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60, 96, 96]} />
        <shaderMaterial
          vertexShader={WATER_VERTEX}
          fragmentShader={WATER_FRAGMENT}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <DepthReference hazard={hazard} horizontalFovRef={horizontalFovRef} verticalFovRef={verticalFovRef}
        gaugeTopM={gaugeTopM} openUpper={timeline.openUpper} />
      <primitive object={camera}>
        <mesh ref={murkRef} visible={false} frustumCulled={false} renderOrder={2}>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial vertexShader={MURK_VERTEX} fragmentShader={MURK_FRAGMENT} uniforms={murkUniforms}
            transparent depthWrite={false} depthTest={false} />
        </mesh>
      </primitive>
      <instancedMesh ref={debrisRef} args={[undefined, undefined, 14]} frustumCulled={false}>
        <planeGeometry args={[0.32, 0.12]} />
        <meshBasicMaterial color="#2f2b25" transparent opacity={0.85} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  )
}

/** 描画中の例外で画面を落とさず、人物の比較図へ退避する。 */
class WaterErrorBoundary extends Component<{ onError: (reason: string) => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onError('水面の描画に失敗しました')
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

export function ARWaterScene(props: ARWaterSceneProps) {
  const { onFailure } = props
  const failedRef = useRef(false)

  const fail = useCallback((reason: string) => {
    if (failedRef.current) return
    failedRef.current = true
    onFailure(reason)
  }, [onFailure])

  return (
    <div className="ar-water-canvas" aria-hidden="true">
      <ARWaterCanvas onFailure={fail}>
        <WaterErrorBoundary onError={fail}>
          <WaterPlane {...props} onFailure={fail} />
        </WaterErrorBoundary>
      </ARWaterCanvas>
    </div>
  )
}

export default ARWaterScene
