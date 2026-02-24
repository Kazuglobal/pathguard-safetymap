'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import { SplatMesh } from '@sparkjsdev/spark'

export const PRESET_SPLATS: { label: string; url: string }[] = [
  {
    label: 'ローカルPLY（public/splats/school-route.ply）',
    url: '/splats/school-route.ply',
  },
  {
    label: '危険交差点（サンプル）',
    url: 'https://sparkjs.dev/assets/splats/butterfly.spz',
  },
  {
    label: '歩道なし区間（サンプル）',
    url: 'https://sparkjs.dev/assets/splats/bicycle.spz',
  },
]

interface SparkSplatViewerProps {
  url: string
  className?: string
  enableWasd?: boolean
  initialLodScale?: number
  showControlHud?: boolean
}

type LoadState = 'loading' | 'ready' | 'error'

type KeyState = {
  keyW: boolean
  keyA: boolean
  keyS: boolean
  keyD: boolean
  shift: boolean
}

const LOD_MIN = 0.25
const LOD_MAX = 2.0
const WALK_SPEED = 2.2
const SPRINT_MULTIPLIER = 2.0

function clampLod(value: number): number {
  return Math.max(LOD_MIN, Math.min(LOD_MAX, value))
}

function createEmptyKeyState(): KeyState {
  return { keyW: false, keyA: false, keyS: false, keyD: false, shift: false }
}

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable
}

function applyLodScale(mesh: InstanceType<typeof SplatMesh>, value: number) {
  const maybeMesh = mesh as InstanceType<typeof SplatMesh> & {
    setAdaptiveLodScale?: (lodScale: number) => void
  }
  if (typeof maybeMesh.setAdaptiveLodScale === 'function') {
    maybeMesh.setAdaptiveLodScale(value)
    return
  }
  maybeMesh.lodScale = value
}

function updateCameraByKeys(
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  keys: KeyState,
  deltaTime: number,
) {
  let dx = 0
  let dz = 0
  const speed = WALK_SPEED * deltaTime * (keys.shift ? SPRINT_MULTIPLIER : 1)

  if (keys.keyW) dz -= speed
  if (keys.keyS) dz += speed
  if (keys.keyA) dx -= speed
  if (keys.keyD) dx += speed

  if (dx === 0 && dz === 0) return

  const movement = new THREE.Vector3(dx, 0, dz)
  camera.position.add(movement)
  controls.target.add(movement)
}

export default function SparkSplatViewer({
  url,
  className = '',
  enableWasd = true,
  initialLodScale = 1,
  showControlHud = true,
}: SparkSplatViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const splatRef = useRef<InstanceType<typeof SplatMesh> | null>(null)
  const keyStateRef = useRef<KeyState>(createEmptyKeyState())
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [lodScale, setLodScale] = useState<number>(clampLod(initialLodScale))
  const lodScaleRef = useRef<number>(clampLod(initialLodScale))

  useEffect(() => {
    const clamped = clampLod(initialLodScale)
    setLodScale(clamped)
    lodScaleRef.current = clamped
  }, [initialLodScale])

  useEffect(() => {
    lodScaleRef.current = clampLod(lodScale)
    if (splatRef.current) {
      applyLodScale(splatRef.current, lodScaleRef.current)
    }
  }, [lodScale])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    setLoadState('loading')
    setErrorMessage('')
    keyStateRef.current = createEmptyKeyState()

    // ── Three.js scene setup ──────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0f1a)

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.01,
      1000,
    )
    camera.position.set(0, 0, 3)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.minDistance = 0.5
    controls.maxDistance = 50

    // ── SplatMesh loading ─────────────────────────────────────────────────────
    let splat: InstanceType<typeof SplatMesh> | null = null
    let disposed = false

    try {
      splat = new SplatMesh({
        url,
        lod: true,
        enableLod: true,
        lodScale: lodScaleRef.current,
        onLoad: (_mesh: unknown) => {
          if (!disposed) {
            if (splat) {
              splatRef.current = splat
              applyLodScale(splat, lodScaleRef.current)
            }
            setLoadState('ready')
            // Auto-fit camera to bounding box
            const box = splat!.getBoundingBox?.()
            if (box instanceof THREE.Box3 && !box.isEmpty()) {
              const center = new THREE.Vector3()
              const size = new THREE.Vector3()
              box.getCenter(center)
              box.getSize(size)
              const maxDim = Math.max(size.x, size.y, size.z)
              camera.position.copy(center).add(new THREE.Vector3(0, 0, maxDim * 1.8))
              controls.target.copy(center)
              controls.update()
            }
          }
        },
        onProgress: (_event: ProgressEvent) => {
          // Progress is tracked; loading state remains until onLoad fires
        },
      })

      splat.position.set(0, 0, -3)
      scene.add(splat)
    } catch (err) {
      setLoadState('error')
      setErrorMessage(err instanceof Error ? err.message : 'Splat の読み込みに失敗しました')
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!enableWasd || isEditableElement(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'w') keyStateRef.current.keyW = true
      if (key === 'a') keyStateRef.current.keyA = true
      if (key === 's') keyStateRef.current.keyS = true
      if (key === 'd') keyStateRef.current.keyD = true
      if (key === 'shift') keyStateRef.current.shift = true
      if (key === 'w' || key === 'a' || key === 's' || key === 'd') {
        event.preventDefault()
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!enableWasd) return
      const key = event.key.toLowerCase()
      if (key === 'w') keyStateRef.current.keyW = false
      if (key === 'a') keyStateRef.current.keyA = false
      if (key === 's') keyStateRef.current.keyS = false
      if (key === 'd') keyStateRef.current.keyD = false
      if (key === 'shift') keyStateRef.current.shift = false
    }

    if (enableWasd) {
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)
    }

    // ── Render loop ───────────────────────────────────────────────────────────
    let renderFailed = false
    let lastTimeMs = performance.now()
    renderer.setAnimationLoop(() => {
      if (disposed || renderFailed) return
      const nowMs = performance.now()
      const deltaTime = Math.min((nowMs - lastTimeMs) / 1000, 0.05)
      lastTimeMs = nowMs
      if (enableWasd) {
        updateCameraByKeys(camera, controls, keyStateRef.current, deltaTime)
      }
      controls.update()
      try {
        renderer.render(scene, camera)
      } catch (err) {
        renderFailed = true
        setLoadState('error')
        setErrorMessage(err instanceof Error ? err.message : '3D レンダリングに失敗しました')
        renderer.setAnimationLoop(null)
      }
    })

    // ── Resize handling ───────────────────────────────────────────────────────
    const resizeObserver = new ResizeObserver(() => {
      if (!container || disposed) return
      const w = container.clientWidth
      const h = container.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    })
    resizeObserver.observe(container)

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      disposed = true
      keyStateRef.current = createEmptyKeyState()
      splatRef.current = null
      resizeObserver.disconnect()
      renderer.setAnimationLoop(null)
      controls.dispose()
      splat?.dispose?.()
      renderer.dispose()
      if (enableWasd) {
        window.removeEventListener('keydown', handleKeyDown)
        window.removeEventListener('keyup', handleKeyUp)
      }
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [url, enableWasd])

  return (
    <div className={`relative w-full h-full ${className}`}>
      {/* Three.js canvas target */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Loading overlay */}
      {loadState === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 pointer-events-none">
          <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin mb-3" />
          <p className="text-slate-400 text-xs">3Dスキャンデータを読み込み中...</p>
        </div>
      )}

      {/* Error overlay */}
      {loadState === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90">
          <svg className="w-10 h-10 text-red-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-red-400 text-sm font-medium mb-1">読み込みエラー</p>
          {errorMessage && (
            <p className="text-slate-500 text-xs max-w-xs text-center">{errorMessage}</p>
          )}
        </div>
      )}

      {/* Controls hint — shown when ready */}
      {loadState === 'ready' && showControlHud && (
        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/10">
          <label htmlFor="spark-lod-scale" className="block text-[10px] text-slate-300 mb-1">
            LOD スケール
          </label>
          <input
            id="spark-lod-scale"
            type="range"
            min={LOD_MIN}
            max={LOD_MAX}
            step={0.05}
            value={lodScale}
            onChange={(event) => setLodScale(clampLod(Number(event.target.value)))}
            className="w-40 accent-purple-500"
          />
          <p className="text-[10px] text-slate-400 mt-1">
            LOD: {lodScale.toFixed(2)}
          </p>
          {enableWasd && (
            <p className="text-slate-400 text-[10px] mt-1">WASD: 移動 / Shift: 高速移動</p>
          )}
          <p className="text-slate-500 text-[10px] mt-1">ドラッグ: 回転 / スクロール: ズーム</p>
        </div>
      )}
    </div>
  )
}
