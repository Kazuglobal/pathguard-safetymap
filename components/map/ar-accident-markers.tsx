'use client'

import { useEffect, useMemo, useState } from 'react'
import { Car, ChevronLeft, ChevronRight, Undo2 } from 'lucide-react'
import { groundScreenYPercent, summarizeOffscreen, verticalFovFromHorizontal, type ARAccidentAround } from '@/lib/ar-risk-data'
import { isTiltFresh, isValidTilt, tiltToAttitude, type DeviceTilt } from '@/lib/ar-water-geometry'

/** 端末の傾きから仰角を読む。取れないときは null（ピンは水平の高さに置く）。 */
function useCameraPitch(tiltRef: React.RefObject<DeviceTilt | null> | undefined, active: boolean): number | null {
  const [pitch, setPitch] = useState<number | null>(null)
  useEffect(() => {
    if (!active || !tiltRef) { setPitch(null); return }
    const read = () => {
      const tilt = tiltRef.current
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      if (!isValidTilt(tilt) || !isTiltFresh(tilt, now)) { setPitch(null); return }
      // 2度刻みに丸めて、微小な揺れで再描画し続けないようにする。
      const next = Math.round(tiltToAttitude(tilt).pitchDeg / 2) * 2
      setPitch(previous => previous === next ? previous : next)
    }
    read()
    const timer = setInterval(read, 150)
    return () => clearInterval(timer)
  }, [tiltRef, active])
  return pitch
}

function viewportAspect(): number {
  if (typeof window === 'undefined' || !window.innerWidth) return 16 / 9
  return window.innerHeight / window.innerWidth
}

/** 距離の帯（0〜25m, 25〜50m, 50〜100m, …）。同じ方向でも距離が大きく違えば別のピンにする。 */
function distanceBand(meters: number): number {
  return Math.max(0, Math.floor(Math.log2(Math.max(1, meters) / 25)) + 1)
}

export function ARAccidentMarkers({ items, selectedId, distance, fov, suppressed, tiltRef, tiltReady, onSelect }: {
  items: ARAccidentAround[]; selectedId: number | null; distance: number; fov: number; suppressed: boolean
  tiltRef?: React.RefObject<DeviceTilt | null>; tiltReady: boolean; onSelect: (id: number) => void
}) {
  const pitch = useCameraPitch(tiltRef, tiltReady)
  const verticalFov = verticalFovFromHorizontal(fov, viewportAspect())
  const visible = useMemo(() => items.filter(item => item.inView), [items])
  const offscreen = useMemo(() => summarizeOffscreen(items), [items])
  const groups = useMemo(() => {
    const map = new Map<string, ARAccidentAround[]>()
    for (const item of visible) {
      const key = `${Math.round(item.x * 4)}:${distanceBand(item.distance)}`
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.values()]
  }, [visible])

  return <div className="ar-accident-markers" aria-label="実事故の方向">
    {groups.map(group => {
      const item = group.find(value => value.feature.properties.id === selectedId) ?? group[0]
      const near = Math.min(item.distance / Math.max(1, distance), 1)
      const scale = 1.15 - near * 0.4
      const top = groundScreenYPercent(item.distance, pitch ?? 0, verticalFov)
      const pressed = group.some(value => value.feature.properties.id === selectedId)
      return <button key={group[0].feature.properties.id} type="button"
        className={`ar-accident-pin${item.distance <= 50 && !suppressed ? ' ar-accident-pin--near' : ''}`}
        aria-label={`実事故 約${Math.round(item.distance)}m${group.length > 1 ? `・${group.length}件` : ''}`}
        aria-pressed={pressed} data-ground-top={top.toFixed(1)}
        style={{ left: `${50 + item.x * 36}%`, top: `${top}%`, zIndex: 100 - Math.round(near * 50),
          ['--pin-scale' as string]: scale.toFixed(2) }}
        onClick={() => onSelect(item.feature.properties.id)}>
        <span className="ar-accident-pin-chip"><Car size={20} aria-hidden="true" />
          <span>{Math.round(item.distance)}m{group.length > 1 ? `・${group.length}件` : ''}</span></span>
        <span className="ar-accident-pin-stem" aria-hidden="true" />
        <span className="ar-accident-pin-ground" aria-hidden="true" />
      </button>
    })}
    {(['left', 'right', 'back'] as const).map(side => {
      const list = offscreen[side]
      if (list.length === 0) return null
      const nearest = list[0]
      const label = side === 'left' ? '左' : side === 'right' ? '右' : '後ろ'
      return <button key={side} type="button" className={`ar-accident-edge ar-accident-edge--${side}`}
        aria-label={`${label}に実事故${list.length}件・最寄り約${Math.round(nearest.distance)}m`}
        onClick={() => onSelect(nearest.feature.properties.id)}>
        {side === 'left' && <ChevronLeft size={20} aria-hidden="true" />}
        {side === 'back' && <Undo2 size={18} aria-hidden="true" />}
        <span>{label}<b>{list.length}件</b><small>{Math.round(nearest.distance)}m</small></span>
        {side === 'right' && <ChevronRight size={20} aria-hidden="true" />}
      </button>
    })}
  </div>
}

/** 自分を中心に、表示距離内の事故を点で示す。上が向いている方向、扇形が画角。 */
export function ARAccidentRadar({ items, selectedId, distance, fov }: {
  items: ARAccidentAround[]; selectedId: number | null; distance: number; fov: number
}) {
  const r = 24
  const half = Math.min(170, fov / 2) * Math.PI / 180
  const wedge = `M${r} ${r} L${r + r * Math.sin(-half)} ${r - r * Math.cos(half)} A${r} ${r} 0 0 1 ${r + r * Math.sin(half)} ${r - r * Math.cos(half)} Z`
  return <svg className="ar-accident-radar" width={r * 2} height={r * 2} viewBox={`0 0 ${r * 2} ${r * 2}`}
    role="img" aria-label={`周りの実事故 ${items.length}件（上が向いている方向）`}>
    <circle cx={r} cy={r} r={r - 1} className="ar-accident-radar-bg" />
    <circle cx={r} cy={r} r={(r - 1) / 2} className="ar-accident-radar-ring" />
    <path d={wedge} className="ar-accident-radar-fov" />
    {items.map(item => {
      const d = Math.min(item.distance / Math.max(1, distance), 1) * (r - 4)
      const a = item.relativeAngle * Math.PI / 180
      const selected = item.feature.properties.id === selectedId
      return <circle key={item.feature.properties.id} cx={r + d * Math.sin(a)} cy={r - d * Math.cos(a)}
        r={selected ? 4 : 2.6} className={selected ? 'ar-accident-radar-dot--selected' : 'ar-accident-radar-dot'} />
    })}
    <circle cx={r} cy={r} r={3} className="ar-accident-radar-me" />
  </svg>
}
