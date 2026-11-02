'use client'

import { createRoot, extend } from '@react-three/fiber'
import { Suspense, useEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

type WaterRoot = ReturnType<typeof createRoot<HTMLCanvasElement>>

/** R3F の非同期 configure を所有し、WebGL 2 初期化の失敗を比較図へ伝える。 */
export function ARWaterCanvas({ children, onFailure }: { children: ReactNode; onFailure: (reason: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<WaterRoot | null>(null)
  const childrenRef = useRef(children)
  const failureRef = useRef(onFailure)
  childrenRef.current = children
  failureRef.current = onFailure

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    // StrictMode の再マウントでも、破棄待ちのrootとcanvasを再利用しない。
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block;width:100%;height:100%;'
    host.appendChild(canvas)
    let root: WaterRoot | null = null
    let store: ReturnType<WaterRoot['render']> | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let disposed = false
    let failed = false
    const fail = (reason: string) => {
      if (disposed || failed) return
      failed = true
      failureRef.current(reason)
    }
    const size = () => {
      const { width, height, top, left } = host.getBoundingClientRect()
      return { width, height, top, left }
    }
    const resize = () => {
      if (disposed || failed || !store) return
      const { width, height, top, left } = size()
      // configure({ size }) は DPR や onCreated を既定値へ戻すため再実行しない。
      store.getState().setSize(width, height, top, left)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    const handleLost = (event: Event) => {
      event.preventDefault()
      fail('WebGLの描画が中断されました')
    }
    canvas.addEventListener('webglcontextlost', handleLost)

    const initialize = async () => {
      try {
        extend({
          Mesh: THREE.Mesh, Group: THREE.Group, InstancedMesh: THREE.InstancedMesh,
          PlaneGeometry: THREE.PlaneGeometry, BoxGeometry: THREE.BoxGeometry,
          ShaderMaterial: THREE.ShaderMaterial, MeshBasicMaterial: THREE.MeshBasicMaterial,
        })
        // 未対応の端末では、Fiber root を登録する前に WebGL 2 の失敗を捕捉する。
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' })
        root = createRoot(canvas)
        // 実際に表示するcanvasで初期化する。WebGL 1への代替判定や試験用contextは作らない。
        await root.configure({
          dpr: [1, 1.5], frameloop: 'always', size: size(),
          gl: renderer,
          camera: { fov: 60, near: 0.05, far: 200, position: [0, 0, 0] },
          onCreated: ({ gl }) => {
            gl.setClearAlpha(0)
            gl.debug.onShaderError = () => fail('水面の描画に失敗しました')
          },
        })
        if (disposed || failed) return
        rootRef.current = root
        store = root.render(<Suspense fallback={null}>{childrenRef.current}</Suspense>)
        // configure を待っている間のサイズ変更も反映する。
        resize()
      } catch {
        fail('この端末では水面の表示を初期化できませんでした')
      }
    }
    void initialize()

    return () => {
      disposed = true
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', handleLost)
      rootRef.current = null
      root?.unmount()
      renderer?.dispose()
      renderer?.forceContextLoss()
      canvas.remove()
    }
  }, [])

  useEffect(() => {
    rootRef.current?.render(<Suspense fallback={null}>{children}</Suspense>)
  }, [children])

  return <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
}
