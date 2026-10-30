'use client'

import { useEffect, useMemo, useState } from 'react'
import { Car, ImageIcon, Droplets, Waves, RotateCw } from 'lucide-react'
import { useARRiskData } from '@/hooks/use-ar-risk-data'
import { projectARAccidents, accidentFilterLabel, type ARPoint } from '@/lib/ar-risk-data'
import { hazardDepthLabel, hazardStatusLabel, HAZARD_OUTSIDE_NOTICE } from '@/lib/hazard-point'
import type { AccidentHeatmapFilters } from '@/lib/traffic-accident-heatmap'
import type { HazardType } from '@/lib/types'
import type { StreetViewTarget } from '@/lib/street-view'
import { AccidentFacts } from './accident-facts'
import { ARInundationOverlay } from './ar-inundation-overlay'
import './ar-risk.css'

export function ARRealRisks({ enabled, point, heading, orientation, distance, fov, filters, suppressed, onStreetView, onLearningChange }: {
  enabled: boolean; point: ARPoint | null; heading: number; orientation: boolean; distance: number; fov: number
  filters: AccidentHeatmapFilters; suppressed: boolean; onStreetView: (target: StreetViewTarget) => void
  onLearningChange?: (open: boolean) => void
}) {
  const data = useARRiskData({ enabled, point, distance, filters })
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [hazard, setHazard] = useState<HazardType | null>(null)
  const accidents = useMemo(() => point ? projectARAccidents(data.accidents?.features ?? [], point, heading, distance, orientation, fov) : [],
    [point, data.accidents, heading, distance, orientation, fov])
  // Cards retain the chosen factual record when the camera turns away. Only
  // direction markers follow the current FOV. Position/filter changes still
  // remove records that are no longer part of the fetched/displayed distance.
  const selectedFeature = data.accidents?.features.find(feature => feature.properties.id === selectedId)
  const pinned = selectedFeature && point
    ? projectARAccidents([selectedFeature], point, heading, distance, false, fov)[0] : undefined
  const selected = pinned ?? accidents[0]
  // Collapse overlapping screen positions, without merging the factual records.
  const markerGroups = useMemo(() => {
    const groups = new Map<number, typeof accidents>()
    for (const item of accidents) {
      const bucket = Math.round(item.x * 3)
      groups.set(bucket, [...(groups.get(bucket) ?? []), item])
    }
    return [...groups.values()]
  }, [accidents])
  const openScene = () => { if (selected) {
    setSelectedId(selected.feature.properties.id)
    onStreetView({ coordinates: selected.feature.geometry.coordinates, properties: { ...selected.feature.properties } })
  } }
  const activeRisk = hazard ? data.hazards?.hazards[hazard] : null
  const showAnimation = Boolean(hazard && activeRisk?.kind === 'inside' && activeRisk.confirmed !== false && !suppressed)
  useEffect(() => { onLearningChange?.(enabled && showAnimation) }, [enabled, showAnimation, onLearningChange])
  if (!enabled) return null

  return <>
    {orientation && <div className="ar-accident-markers" aria-label="実事故の方向">
      {markerGroups.map(group => {
        const item = group.find(value => value.feature.properties.id === selectedId) ?? group[0]
        return <button key={group[0].feature.properties.id} type="button" className="ar-accident-marker"
          aria-label={`実事故 約${Math.round(item.distance)}m${group.length > 1 ? `・${group.length}件` : ''}`}
          aria-pressed={selected?.feature.properties.id === item.feature.properties.id}
          style={{ left: `${50 + item.x * 36}%`, top: `${25 + Math.min(item.distance / distance, 1) * 8}%`,
            ...(item.distance <= 50 && !suppressed ? { borderWidth: 3 } : {}) }}
          onClick={() => setSelectedId(item.feature.properties.id)}>
          <Car size={23} aria-hidden="true" /><span>実事故・{Math.round(item.distance)}m{group.length > 1 ? `（${group.length}件）` : ''}</span>
        </button>
      })}
    </div>}
    {showAnimation && hazard && data.hazards ? <ARInundationOverlay risks={data.hazards.hazards} selected={hazard}
      onSelect={setHazard} onClose={() => setHazard(null)} suppressed={suppressed}>
      {selected && <><span className="font-bold text-safety-strong">実事故 {selected.feature.properties.year}年・{Math.round(selected.distance)}m</span>
        <button type="button" className="min-h-11 font-bold text-forest-strong" onClick={openScene}>現地の景色を見る</button></>}
    </ARInundationOverlay> : <section className="ar-risk-dock" aria-label="実事故と浸水想定">
      <p className="text-xs text-ink-soft">{accidentFilterLabel(filters)} ／ 表示距離{distance}m</p>
      {!orientation && <p>方角を取得できないため、近い順に表示しています。</p>}
      {data.accidentError ? <p role="status">{data.accidentError}</p> : !data.accidents ? <p role="status">実事故を確認しています…</p> :
        selected ? <>
          <AccidentFacts properties={{ ...selected.feature.properties }} compact />
          <p>約{Math.round(selected.distance)}m先 ／ 過去に事故が記録された地点です</p>
          <button type="button" className="ar-risk-cta" onClick={openScene}><ImageIcon size={19} aria-hidden="true" />現地の景色を見る</button>
          {(!orientation || accidents.length > 1) && <details><summary className="cursor-pointer py-2 text-xs">近くの実事故（表示中 {accidents.length}件）</summary>
            <div className="ar-accident-list">{accidents.map(item => <button key={item.feature.properties.id} type="button" onClick={() => setSelectedId(item.feature.properties.id)}>
              <span>{item.feature.properties.year}年・{item.feature.properties.type ?? '種類不明'}</span><span>{Math.round(item.distance)}m</span>
            </button>)}</div></details>}
        </> : <p>現在の表示範囲・条件で記録を確認できた実事故はありません。</p>}
      {data.accidents?.truncated && <p role="status">件数が多いため一部だけ表示しています。最寄りの全件を保証するものではありません。</p>}
      {data.hazardError && <p role="status">{data.hazardError}</p>}
      {(['flood', 'tsunami'] as const).map(type => {
        const risk = data.hazards?.hazards[type]
        const Icon = type === 'flood' ? Droplets : Waves
        return <div key={type}>
          <div className="ar-risk-hazard-row"><span className="flex items-center gap-2"><Icon size={18} aria-hidden="true" />
            {type === 'flood' ? '洪水' : '津波'}：{risk ? hazardStatusLabel(risk.kind) : data.hazardError ? '取得不能' : '確認中'}</span>
            {risk?.kind === 'inside' && <button type="button" disabled={suppressed || risk.confirmed === false} onClick={() => setHazard(type)}>
              {risk.confirmed === false ? '位置を確認中' : '深さを見る'}</button>}
          </div>
          {risk?.kind === 'inside' && risk.zone && <p className="mb-2">想定浸水深 {hazardDepthLabel(risk.zone)}</p>}
          {risk?.kind === 'outside' && <p className="mb-2 text-xs">{HAZARD_OUTSIDE_NOTICE}</p>}
          {risk?.kind === 'no_coverage' && <p className="mb-2 text-xs">この地点の公的データは未収録です。安全という意味ではありません。</p>}
        </div>
      })}
      {(data.accidentError || data.hazardError) && <button type="button" className="flex items-center gap-2 text-sm text-forest-strong" onClick={data.retry}><RotateCw size={16} />再試行</button>}
      <p className="text-[10px] text-ink-soft">事故出典：警察庁 交通事故統計オープンデータを加工</p>
    </section>}
  </>
}
