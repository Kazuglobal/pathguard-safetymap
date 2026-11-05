'use client'

import { useEffect, useMemo, useState } from 'react'
import { ImageIcon, Droplets, Waves, RotateCw, ChevronDown, ChevronUp, Navigation } from 'lucide-react'
import { useARRiskData } from '@/hooks/use-ar-risk-data'
import { locateARAccidents, accidentFilterLabel, compassLabel, relativeDirectionLabel, type ARAccidentAround, type ARPoint } from '@/lib/ar-risk-data'
import { hazardDepthLabel, hazardStatusLabel, HAZARD_OUTSIDE_NOTICE } from '@/lib/hazard-point'
import type { AccidentHeatmapFilters } from '@/lib/traffic-accident-heatmap'
import type { HazardType } from '@/lib/types'
import type { StreetViewTarget } from '@/lib/street-view'
import type { DeviceTilt } from '@/lib/ar-water-geometry'
import { AccidentFacts } from './accident-facts'
import { ARAccidentMarkers, ARAccidentRadar } from './ar-accident-markers'
import { ARInundationOverlay } from './ar-inundation-overlay'
import './ar-risk.css'

export function ARRealRisks({ enabled, point, heading, orientation, distance, fov, filters, suppressed, onStreetView, onLearningChange,
  videoRef, tiltRef, tiltReady = false }: {
  enabled: boolean; point: ARPoint | null; heading: number; orientation: boolean; distance: number; fov: number
  filters: AccidentHeatmapFilters; suppressed: boolean; onStreetView: (target: StreetViewTarget) => void
  onLearningChange?: (open: boolean) => void
  /** カメラ映像と端末の傾き。現地ARで水面を重ねるときだけ渡す。 */
  videoRef?: React.RefObject<HTMLVideoElement | null>
  tiltRef?: React.RefObject<DeviceTilt | null>
  tiltReady?: boolean
}) {
  const data = useARRiskData({ enabled, point, distance, filters })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [hazard, setHazard] = useState<HazardType | null>(null)
  // 浸水学習のシートと同じく、詳細をたたんでカメラを広く見せる。
  // 条件・選んだ事故・景色を見る操作・浸水の状態は、たたんでも隠さない。
  const [expanded, setExpanded] = useState(true)
  // 画角の外の事故も捨てない。画面上のピンは inView だけ、パネル・一覧・端の案内は全件から出す。
  const accidents = useMemo(() => point ? locateARAccidents(data.accidents?.features ?? [], point, heading, distance, orientation, fov) : [],
    [point, data.accidents, heading, distance, orientation, fov])
  // 選んだ記録は、カメラの向きが変わっても保持する。位置・条件が変わって表示距離外になったら外す。
  const pinned = accidents.find(item => item.feature.properties.id === selectedId)
  const selected = pinned ?? accidents.find(item => item.inView) ?? accidents[0]
  const openScene = () => { if (selected) {
    setSelectedId(selected.feature.properties.id)
    onStreetView({ coordinates: selected.feature.geometry.coordinates, properties: { ...selected.feature.properties } })
  } }
  const activeRisk = hazard ? data.hazards?.hazards[hazard] : null
  const showAnimation = Boolean(hazard && activeRisk?.kind === 'inside' && activeRisk.confirmed !== false && !suppressed)
  useEffect(() => { onLearningChange?.(enabled && showAnimation) }, [enabled, showAnimation, onLearningChange])
  if (!enabled) return null

  return <>
    {orientation && <ARAccidentMarkers items={accidents} selectedId={selected?.feature.properties.id ?? null}
      distance={distance} fov={fov} suppressed={suppressed} tiltRef={tiltRef} tiltReady={tiltReady}
      onSelect={setSelectedId} />}
    {showAnimation && hazard && data.hazards ? <ARInundationOverlay risks={data.hazards.hazards} selected={hazard}
      onSelect={setHazard} onClose={() => setHazard(null)} suppressed={suppressed}
      live videoRef={videoRef} tiltRef={tiltRef} tiltReady={tiltReady} sourceHorizontalFovDeg={fov}>
      {selected && <><span className="font-bold text-safety-strong">実事故 {selected.feature.properties.year}年・{Math.round(selected.distance)}m</span>
        <button type="button" className="min-h-11 font-bold text-forest-strong" onClick={openScene}>現地の景色を見る</button></>}
    </ARInundationOverlay> : <section className={`ar-risk-dock ${expanded ? '' : 'ar-risk-dock--collapsed'}`} aria-label="実事故と浸水想定">
      <div className="ar-risk-dock-head">
        {orientation && accidents.length > 0 && <ARAccidentRadar items={accidents} selectedId={selected?.feature.properties.id ?? null} distance={distance} fov={fov} />}
        <p className="text-xs text-ink-soft">{accidentFilterLabel(filters)} ／ 表示距離{distance}m</p>
        <button type="button" className="ar-sheet-toggle" aria-expanded={expanded}
          aria-label={expanded ? '詳細をたたむ' : '詳細をひらく'} onClick={() => setExpanded(value => !value)}>
          {expanded ? <ChevronDown size={20} aria-hidden="true" /> : <ChevronUp size={20} aria-hidden="true" />}</button>
      </div>
      {expanded && !orientation && <p>方角を取得できないため、近い順に表示しています。</p>}
      {data.accidentError ? <p role="status">{data.accidentError}</p> : !data.accidents ? <p role="status">実事故を確認しています…</p> :
        selected ? <>
          {expanded ? <>
            <AccidentFacts properties={{ ...selected.feature.properties }} compact />
            <ARAccidentWhere item={selected} orientation={orientation} />
          </> : <p className="ar-risk-summary">実事故 {selected.feature.properties.year}年・{selected.feature.properties.type ?? '種類不明'}
            ／{orientation ? `${relativeDirectionLabel(selected.relativeAngle)}・` : ''}約{Math.round(selected.distance)}m先</p>}
          <button type="button" className="ar-risk-cta" onClick={openScene}><ImageIcon size={19} aria-hidden="true" />現地の景色を見る</button>
          {expanded && accidents.length > 1 && <details><summary className="cursor-pointer py-2 text-xs">近くの実事故（{distance}m以内 {accidents.length}件・近い順）</summary>
            <div className="ar-accident-list">{accidents.map(item => <button key={item.feature.properties.id} type="button"
              aria-pressed={item.feature.properties.id === selected.feature.properties.id} onClick={() => setSelectedId(item.feature.properties.id)}>
              <span>{item.feature.properties.year}年・{item.feature.properties.type ?? '種類不明'}</span>
              <span>{orientation ? `${relativeDirectionLabel(item.relativeAngle)}・` : ''}{compassLabel(item.bearing)} {Math.round(item.distance)}m</span>
            </button>)}</div></details>}
        </> : <p>現在の表示範囲・条件で記録を確認できた実事故はありません。</p>}
      {data.accidents?.truncated && <p role="status">件数が多いため一部だけ表示しています。最寄りの全件を保証するものではありません。</p>}
      {data.hazardError && <p role="status">{data.hazardError}</p>}
      {(['flood', 'tsunami'] as const).map(type => {
        const risk = data.hazards?.hazards[type]
        const Icon = type === 'flood' ? Droplets : Waves
        // たたんだときは1行にまとめる。区域外・未収録の注意は短い表記で必ず残す。
        return <div key={type}>
          <div className="ar-risk-hazard-row"><span className="flex items-center gap-2"><Icon size={18} aria-hidden="true" />
            {type === 'flood' ? '洪水' : '津波'}：{risk ? hazardStatusLabel(risk.kind) : data.hazardError ? '取得不能' : '確認中'}
            {!expanded && risk?.kind === 'inside' && risk.zone && <span className="font-bold">{hazardDepthLabel(risk.zone)}</span>}
            {!expanded && risk?.kind === 'outside' && <span className="text-xs">（安全の保証ではありません）</span>}
            {!expanded && risk?.kind === 'no_coverage' && <span className="text-xs">（安全という意味ではありません）</span>}</span>
            {risk?.kind === 'inside' && <button type="button" disabled={suppressed || risk.confirmed === false} onClick={() => setHazard(type)}>
              {risk.confirmed === false ? '位置を確認中' : '深さを見る'}</button>}
          </div>
          {expanded && risk?.kind === 'inside' && risk.zone && <p className="mb-2">想定浸水深 {hazardDepthLabel(risk.zone)}</p>}
          {expanded && risk?.kind === 'outside' && <p className="mb-2 text-xs">{HAZARD_OUTSIDE_NOTICE}</p>}
          {expanded && risk?.kind === 'no_coverage' && <p className="mb-2 text-xs">この地点の公的データは未収録です。安全という意味ではありません。</p>}
        </div>
      })}
      {(data.accidentError || data.hazardError) && <button type="button" className="flex items-center gap-2 text-sm text-forest-strong" onClick={data.retry}><RotateCw size={16} />再試行</button>}
      {expanded && <p className="text-xs text-ink-soft">事故出典：警察庁 交通事故統計オープンデータを加工</p>}
    </section>}
  </>
}

/** どこにある事故か。方向・方位・距離・道路形状（記録にあるときだけ）と、画角外なら向き直しの案内。 */
function ARAccidentWhere({ item, orientation }: { item: ARAccidentAround; orientation: boolean }) {
  const { roadShape } = item.feature.properties
  const turn = Math.round(Math.abs(item.relativeAngle) / 5) * 5
  return <div className="ar-accident-where">
    <p className="ar-accident-where-main"><Navigation size={16} aria-hidden="true"
      style={{ transform: `rotate(${orientation ? item.relativeAngle : item.bearing}deg)` }} />
      {orientation ? `${relativeDirectionLabel(item.relativeAngle)}・` : ''}{compassLabel(item.bearing)}の方角・約{Math.round(item.distance)}m先</p>
    {roadShape && <p className="text-xs">道路形状：{roadShape}</p>}
    {orientation && !item.inView && <p className="ar-accident-turn" role="status">
      画面の外です。{item.relativeAngle > 0 ? '右' : '左'}へ約{turn}°向くと見えます</p>}
    <p className="text-xs text-ink-soft">過去に事故が記録された地点です（位置は記録の座標で、ずれることがあります）</p>
  </div>
}
