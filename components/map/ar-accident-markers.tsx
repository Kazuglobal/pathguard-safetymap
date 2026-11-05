'use client'

import { useEffect, useMemo, useState } from 'react'
import { Car, ChevronLeft, ChevronRight, Undo2 } from 'lucide-react'
import { groundScreenYPercent, groupOverlappingPins, nextIdInGroup, pinLeftPercent, summarizeOffscreen,
  verticalFovFromHorizontal, type ARAccidentAround } from '@/lib/ar-risk-data'
import { computeVideoProjection, isTiltFresh, isValidTilt, tiltToAttitude, type DeviceTilt } from '@/lib/ar-water-geometry'

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

export interface ARVideoView {
  /** 画面に実際に映っている範囲の画角（度）。object-fit: cover の切り抜き後。 */
  horizontalFovDeg: number
  verticalFovDeg: number
  /** 映像の実寸から求めたか（false は推定）。 */
  measured: boolean
}

function fallbackView(fov: number): ARVideoView {
  const aspect = typeof window !== 'undefined' && window.innerWidth ? window.innerHeight / window.innerWidth : 16 / 9
  return { horizontalFovDeg: fov, verticalFovDeg: verticalFovFromHorizontal(fov, aspect), measured: false }
}

/**
 * カメラ映像の実寸と表示領域から、切り抜き後に画面に映っている画角を求める。
 * 背景の <video> は object-cover なので、元映像の水平FOVを画面比率で直接変換しない
 * （浸水シーンと同じ computeVideoProjection を使う）。メタデータ未取得のあいだは推定値。
 */
export function useARVideoView(videoRef: React.RefObject<HTMLVideoElement | null> | undefined, fov: number, active: boolean): ARVideoView {
  const [view, setView] = useState<ARVideoView>(() => fallbackView(fov))
  useEffect(() => {
    if (!active) return
    const read = () => {
      const video = videoRef?.current
      const projection = video ? computeVideoProjection({ videoWidth: video.videoWidth, videoHeight: video.videoHeight,
        displayWidth: video.clientWidth, displayHeight: video.clientHeight, sourceHorizontalFovDeg: fov }) : null
      const next = projection
        ? { horizontalFovDeg: projection.horizontalFovDeg, verticalFovDeg: projection.verticalFovDeg, measured: true }
        : fallbackView(fov)
      setView(previous => Math.abs(previous.horizontalFovDeg - next.horizontalFovDeg) < .1
        && Math.abs(previous.verticalFovDeg - next.verticalFovDeg) < .1 && previous.measured === next.measured ? previous : next)
    }
    read()
    // 映像のメタデータ取得・画面回転・リサイズに追従する。
    const timer = setInterval(read, 500)
    return () => clearInterval(timer)
  }, [videoRef, fov, active])
  return view
}

export function ARAccidentMarkers({ items, selectedId, distance, verticalFovDeg, suppressed, tiltRef, tiltReady, onSelect }: {
  items: ARAccidentAround[]; selectedId: number | null; distance: number; verticalFovDeg: number; suppressed: boolean
  tiltRef?: React.RefObject<DeviceTilt | null>; tiltReady: boolean; onSelect: (id: number) => void
}) {
  const pitch = useCameraPitch(tiltRef, tiltReady)
  const offscreen = useMemo(() => summarizeOffscreen(items), [items])
  // 画面に投影した位置で重なりをまとめる。水平に構えると遠近の違う事故が同じ高さに並ぶため、
  // 距離帯ではなく実際の画面上の重なりで判定する。items は近い順なので各グループの先頭が最寄り。
  const groups = useMemo(() => groupOverlappingPins(items.filter(item => item.inView).map(item => ({
    item, left: pinLeftPercent(item.x), top: groundScreenYPercent(item.distance, pitch ?? 0, verticalFovDeg),
  }))), [items, pitch, verticalFovDeg])

  return <div className="ar-accident-markers" aria-label="実事故の方向">
    {groups.map(group => {
      const ids = group.map(pin => pin.item.feature.properties.id)
      const shown = group.find(pin => pin.item.feature.properties.id === selectedId) ?? group[0]
      const { item } = shown
      const near = Math.min(item.distance / Math.max(1, distance), 1)
      const scale = 1.15 - near * 0.4
      const pressed = ids.includes(selectedId ?? NaN)
      const others = group.length > 1 ? `・ほか${group.length - 1}件` : ''
      return <button key={ids[0]} type="button"
        className={`ar-accident-pin${item.distance <= 50 && !suppressed ? ' ar-accident-pin--near' : ''}`}
        aria-label={`実事故 約${Math.round(item.distance)}m${group.length > 1 ? `・この方向に${group.length}件（タップで次の事故）` : ''}`}
        aria-pressed={pressed} data-ground-top={shown.top.toFixed(1)}
        style={{ left: `${shown.left}%`, top: `${shown.top}%`, zIndex: 100 - Math.round(near * 50),
          ['--pin-scale' as string]: scale.toFixed(2) }}
        onClick={() => onSelect(nextIdInGroup(ids, selectedId))}>
        <span className="ar-accident-pin-chip"><Car size={20} aria-hidden="true" />
          <span>{Math.round(item.distance)}m{others && <small>{others}</small>}</span></span>
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
