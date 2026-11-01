'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Component, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
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
uniform float uWaveFrequency;
varying vec3 vWorldPosition;
varying vec2 vWave;

void main() {
  vec3 transformed = position;
  float a = sin(position.x * uWaveFrequency + uTime * 1.1) * cos(position.y * uWaveFrequency * 0.8 - uTime * 0.7);
  float b = sin((position.x + position.y) * uWaveFrequency * 1.7 - uTime * 1.6);
  transformed.z += (a * 0.7 + b * 0.3) * uWaveAmplitude;
  vWave = vec2(a, b);
  vec4 world = modelMatrix * vec4(transformed, 1.0);
  vWorldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

const WATER_FRAGMENT = /* glsl */ `
precision mediump float;
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
varying vec3 vWorldPosition;
varying vec2 vWave;

// 画面座標 → 元映像のUV。lib/ar-water-geometry.ts の screenToVideoUv と同じ式。
vec2 screenToVideoUv(vec2 screenUv) {
  return (screenUv - 0.5) * uVisibleFraction + 0.5;
}

void main() {
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  vec2 distortion = vec2(vWave.x, vWave.y) * uRefraction;
  vec2 videoUv = screenToVideoUv(clamp(screenUv + distortion, 0.0, 1.0));
  vec3 behind = uHasVideo > 0.5 ? texture2D(uVideo, videoUv).rgb : uDeepColor;

  float distance = length(vWorldPosition.xz);
  float depthMix = clamp(distance / 14.0, 0.0, 1.0);
  vec3 water = mix(uShallowColor, uDeepColor, depthMix);
  float fresnel = clamp(0.25 + depthMix * 0.55, 0.0, 1.0);
  vec3 color = mix(behind, water, clamp(uTurbidity + fresnel * 0.5, 0.0, 0.97));

  float foam = smoothstep(0.5, 1.0, abs(vWave.x) + abs(vWave.y) * 0.6) * uFoam;
  color += foam * 0.4;
  // 水際（手前）を少し明るく、遠くを濃くして、水面であることが分かるようにする。
  color *= mix(1.12, 0.82, depthMix);
  if (uUnderwater > 0.5) {
    color = mix(color, uDeepColor, 0.5);
  }
  gl_FragColor = vec4(color, clamp(0.8 + uTurbidity * 0.18, 0.0, 0.97));
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

const PALETTE: Record<'flood' | 'tsunami', PaletteEntry> = {
  flood: {
    shallow: new THREE.Color('#9d8441'),
    deep: new THREE.Color('#4f4526'),
    turbidity: 0.55,
    foam: 0.22,
    waveAmplitude: 0.035,
    refraction: 0.012,
  },
  tsunami: {
    shallow: new THREE.Color('#514f58'),
    deep: new THREE.Color('#1d1b23'),
    turbidity: 0.7,
    foam: 0.6,
    waveAmplitude: 0.075,
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
  onFailure,
}: ARWaterSceneProps) {
  const { camera, size, gl } = useThree()
  const meshRef = useRef<THREE.Mesh>(null)
  const debrisRef = useRef<THREE.InstancedMesh>(null)
  // 仮想視点が水面下に入ったときの全体の濁り。視線に合わせてカメラの前に置く。
  const murkRef = useRef<THREE.Mesh>(null)
  const submergedRef = useRef(false)
  const smoother = useMemo(() => createTiltSmoother(), [])
  const animationMsRef = useRef(0)
  const videoTextureRef = useRef<THREE.VideoTexture | null>(null)
  const videoSizeRef = useRef<string>('')
  const palette = PALETTE[hazard]

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWaveAmplitude: { value: palette.waveAmplitude },
      uWaveFrequency: { value: 1.1 },
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

  // コンテキスト喪失は回復を待たずに退避する。
  useEffect(() => {
    const canvas = gl.domElement
    const handleLost = (event: Event) => {
      event.preventDefault()
      onFailure('WebGLの描画が中断されました')
    }
    canvas.addEventListener('webglcontextlost', handleLost)
    return () => canvas.removeEventListener('webglcontextlost', handleLost)
  }, [gl, onFailure])

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
      camera.rotation.set(THREE.MathUtils.degToRad(attitude.pitchDeg), 0, THREE.MathUtils.degToRad(-attitude.rollDeg), 'ZYX')
    }

    // アニメーション時刻は描画時刻と独立。停止中と動きを減らす設定では進めない。
    if (playing && !reducedMotion) {
      animationMsRef.current += delta * 1000
    }
    const elapsed = reducedMotion ? timeline.durationMs : animationMsRef.current
    const depth = depthAtMs(timeline, elapsed)
    const submerged = isVirtualViewSubmerged(depth)
    uniforms.uUnderwater.value = submerged ? 1 : 0
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
        const material = murk.material as THREE.MeshBasicMaterial
        material.color.copy(palette.deep)
        // 深いほど濃くする。上限を置き、比較図と数値が読めなくならないようにする。
        material.opacity = Math.min(0.82, 0.5 + (depth - AR_ASSUMED_CAMERA_HEIGHT_M) * 0.04)
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
      <primitive object={camera}>
        <mesh ref={murkRef} visible={false} frustumCulled={false} renderOrder={2}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={palette.deep} transparent opacity={0.6} depthWrite={false} depthTest={false} />
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

/** WebGLが使えるかを、Canvasを作る前に確かめる。 */
function hasWebGL(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'))
  } catch {
    return false
  }
}

export function ARWaterScene(props: ARWaterSceneProps) {
  const { onFailure } = props
  const [supported, setSupported] = useState<boolean | null>(null)
  const failedRef = useRef(false)

  const fail = (reason: string) => {
    if (failedRef.current) return
    failedRef.current = true
    onFailure(reason)
  }

  useEffect(() => {
    setSupported(hasWebGL())
  }, [])

  useEffect(() => {
    if (supported === false) fail('この端末では水面の表示を利用できません')
    // 失敗したシーンを自動で繰り返し起動しない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported])

  if (supported !== true) return null

  return (
    <div className="ar-water-canvas" aria-hidden="true">
      <WaterErrorBoundary onError={fail}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop="always"
        gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
        camera={{ fov: 60, near: 0.05, far: 200, position: [0, 0, 0] }}
        onCreated={({ gl }) => {
          gl.setClearAlpha(0)
        }}
        fallback={null}
      >
        <WaterPlane {...props} onFailure={fail} />
      </Canvas>
      </WaterErrorBoundary>
    </div>
  )
}

export default ARWaterScene
