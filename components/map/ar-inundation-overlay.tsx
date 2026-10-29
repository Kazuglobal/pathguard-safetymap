'use client'

import { useEffect, useRef, useState } from 'react'
import { Droplets, Waves, Pause, Play, RotateCw, Info, ArrowLeft } from 'lucide-react'
import type { HazardType } from '@/lib/types'
import { hazardDepthLabel, HAZARD_LEARNING_NOTICE, type HazardPointRisk } from '@/lib/hazard-point'
import './ar-risk.css'

interface Props {
  risks: Record<HazardType, HazardPointRisk>
  selected: HazardType
  onSelect: (type: HazardType) => void
  onClose: () => void
  suppressed?: boolean
  children?: React.ReactNode
  sample?: boolean
}

export function ARInundationOverlay({ risks, selected, onSelect, onClose, suppressed = false, children, sample = false }: Props) {
  const risk = risks[selected]
  const [acknowledged, setAcknowledged] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [replay, setReplay] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [visible, setVisible] = useState(true)
  const sheet = useRef<HTMLDivElement>(null)
  const [sheetHeight, setSheetHeight] = useState(325)
  const zone = risk.kind === 'inside' ? risk.zone : undefined
  const canShow = Boolean(zone) && risk.confirmed !== false && !suppressed && visible
  const knownDepth = Boolean(zone && (zone.depthMinMeters !== null || zone.depthMaxMeters !== null))
  const zoneKey = zone?.zoneId

  useEffect(() => {
    if (!sheet.current) return
    const update = () => setSheetHeight(sheet.current?.getBoundingClientRect().height ?? 325)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(sheet.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    setAcknowledged(false); setPlaying(false)
  }, [zoneKey, selected, suppressed])
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update(); query.addEventListener('change', update)
    const visibility = () => { setVisible(!document.hidden); if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', visibility)
    return () => { query.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility) }
  }, [])

  // One scale for the endpoints AND the 1.7m reference person. Large or open
  // ranges use a compressed scale; never invent a finite upper endpoint.
  const openUpper = Boolean(zone && zone.depthMaxMeters === null)
  const scaleMax = Math.max(3, zone?.depthMaxMeters ?? (zone?.depthMinMeters ?? 3) * 1.25)
  const scale = 230 / scaleMax
  const lower = (zone?.depthMinMeters ?? 0) * scale
  const upper = (zone?.depthMaxMeters ?? scaleMax) * scale

  return <section className={`ar-inundation ar-inundation--${selected}`} aria-label="AR浸水学習">
    <button className="ar-depth-close" type="button" onClick={onClose} aria-label="浸水学習を閉じる"><ArrowLeft size={20} /></button>
    <div className="ar-inundation-tabs" role="group" aria-label="災害の種類">
      {(['flood', 'tsunami'] as const).map(type => {
        const Icon = type === 'flood' ? Droplets : Waves
        return <button key={type} type="button" aria-pressed={selected === type} onClick={() => onSelect(type)}
          disabled={risks[type].kind !== 'inside'}><Icon aria-hidden="true" size={22} />{type === 'flood' ? '洪水' : '津波'}</button>
      })}
    </div>

    {canShow && acknowledged && knownDepth && <div className="ar-depth-visual" style={{ bottom: sheetHeight + 16 }} aria-label="人物と想定浸水深の高さ比較">
      <span className="ar-depth-caption">高さの比較イメージ</span>
      <div className="ar-depth-water-clip" style={{ height: upper }}>
        {/* This is an educational screen overlay; it is not a terrain model. */}
        <img key={replay} className={`ar-depth-water ${selected === 'tsunami' ? 'ar-depth-water--tsunami' : ''}`}
          src="/images/ar/water-surface.png" alt="" aria-hidden="true"
          style={{ animationPlayState: playing && !reducedMotion ? 'running' : 'paused',
            animationName: reducedMotion ? 'none' : selected === 'tsunami' ? 'ar-depth-emphasis' : 'ar-water-rise' }} />
      </div>
      <div className="ar-depth-person" style={{ height: 1.7 * scale }}>
        <img src="/images/ar/height-reference-adult.png" alt="高さ約170cmの比較用人物" />
        <span>大人<br />約170cm</span>
      </div>
      <div className="ar-depth-ruler" style={{ height: upper - lower, bottom: lower, borderTop: openUpper ? 'none' : undefined }}>
        <span className="ar-depth-endpoint ar-depth-endpoint--top">{openUpper ? '上限なし' : `${zone?.depthMaxMeters?.toFixed(1)}m`}</span>
        <span className="ar-depth-range">{zone && hazardDepthLabel(zone)}<small>の範囲</small></span>
        {zone?.depthMinMeters !== null && <span className="ar-depth-endpoint ar-depth-endpoint--bottom">{zone?.depthMinMeters?.toFixed(1)}m</span>}
      </div>
    </div>}

    <div className={`ar-inundation-sheet ${acknowledged && knownDepth ? 'ar-inundation-sheet--active' : ''}`} ref={sheet}>
      <div className="ar-depth-heading"><div><p>{selected === 'flood' ? '洪水' : '津波'}の想定浸水深</p>
        <strong>{zone ? hazardDepthLabel(zone) : '確認できません'}</strong></div>
      </div>
      {!acknowledged ? <div className="ar-depth-start">
        <p>{suppressed ? '位置精度や移動速度のため表示を停止しています。' : risk.confirmed === false ? '位置の判定を確認しています。' : '安全な場所で立ち止まって確認してください。'}</p>
        <button type="button" disabled={!canShow} onClick={() => { setAcknowledged(true); setPlaying(true) }}>
          <Play size={20} aria-hidden="true" />立ち止まって{knownDepth ? '再生する' : '説明を見る'}</button>
      </div> : <div className="ar-depth-controls">
        {knownDepth ? <>
          <button type="button" disabled={!canShow || reducedMotion} onClick={() => setPlaying(value => !value)}>
            {playing && !reducedMotion ? <Pause aria-hidden="true" size={22} /> : <Play aria-hidden="true" size={22} />}
            {reducedMotion ? '静止画で表示中' : playing ? '一時停止' : '再生する'}</button>
          <button type="button" className="ar-depth-replay" disabled={!canShow || reducedMotion}
            onClick={() => { setReplay(value => value + 1); setPlaying(true) }}><RotateCw aria-hidden="true" size={20} />もう一度</button>
        </> : <p>この地点には深さの情報がないため、高さの比較は表示できません。</p>}
      </div>}
      {selected === 'tsunami' && <p className="ar-tsunami-action">津波警報が出たら、海や川から離れて高い場所へ避難しましょう。</p>}
      <p className="ar-depth-notice"><Info size={18} aria-hidden="true" /><span>{HAZARD_LEARNING_NOTICE}</span></p>
      <p className="ar-depth-source">{sample ? 'デザイン用サンプル・実地点の想定ではありません' :
        `出典：${risk.sources.map(source => `${source.name}／${source.region}／${source.dataYear ?? '対象年不明'}${source.dataYear ? '年版' : ''}`).join('、') || '公的な浸水想定データ'}`}</p>
      {children && <div className="ar-depth-accident">{children}</div>}
    </div>
  </section>
}
