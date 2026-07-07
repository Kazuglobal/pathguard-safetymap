"use client"

import { useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import * as THREE from "three"

const PARTICLE_COUNT = 500

function DriftingPoints() {
  const pointsRef = useRef<THREE.Points>(null)

  const { positions, speeds } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const speeds = new Float32Array(PARTICLE_COUNT)
    // 決定的な擬似乱数(SSR/再レンダー間で安定)
    let seed = 42
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = (rand() - 0.5) * 20
      positions[i * 3 + 1] = (rand() - 0.5) * 12
      positions[i * 3 + 2] = (rand() - 0.5) * 6
      speeds[i] = 0.05 + rand() * 0.2
    }
    return { positions, speeds }
  }, [])

  useFrame((state) => {
    const points = pointsRef.current
    if (!points) return
    const t = state.clock.elapsedTime
    const attr = points.geometry.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const base = positions[i * 3 + 1]
      attr.setY(i, base + Math.sin(t * speeds[i] + i) * 0.6)
    }
    attr.needsUpdate = true
    points.rotation.y = t * 0.012
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#ffd9a0"
        transparent
        opacity={0.55}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

/**
 * ヒーロー背景の微粒子(朝の光の粒)。装飾専用・操作不可。
 * 呼び出し側で dynamic import(ssr: false)すること。
 */
export function HeroParticles() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
      >
        <DriftingPoints />
      </Canvas>
    </div>
  )
}
