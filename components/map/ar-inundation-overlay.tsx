'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Droplets, Waves, Pause, Play, RotateCw, Info, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
import type { HazardType } from '@/lib/types'
import {
  hazardDepthLabel,
  HAZARD_LEARNING_NOTICE,
  HAZARD_LEARNING_TITLE,
  HAZARD_WATER_SCENE_NOTICE,
  HAZARD_WATER_SCENE_NOTICE_SHORT,
  HAZARD_LEARNING_NOTICE_SHORT,
  type HazardPointRisk,
} from '@/lib/hazard-point'
import { AR_ASSUMED_CAMERA_HEIGHT_M, buildDepthTimeline, type DeviceTilt } from '@/lib/ar-water-geometry'
import { depthGuideMarksWithin, layoutDepthGuideMarks, DEPTH_GUIDE_CAVEAT } from '@/lib/hazard-depth-guide'
import { DEFAULT_FOV } from '@/lib/ar-constants'
import './ar-risk.css'

// WebGLの水面はクライアントでだけ読み込む(SSRを避ける)。
const ARWaterScene = dynamic(() => import('./ar-water-scene').then(module => module.ARWaterScene), { ssr: false })

interface Props {
  risks: Record<HazardType, HazardPointRisk>
  selected: HazardType
  onSelect: (type: HazardType) => void
  onClose: () => void
  suppressed?: boolean
  children?: React.ReactNode
  sample?: boolean
  /** 現在地のカメラ映像に水面を重ねられる現地AR表示か。地図で選んだ地点では重ねない。 */
  live?: boolean
  videoRef?: React.RefObject<HTMLVideoElement | null>
  tiltRef?: React.RefObject<DeviceTilt | null>
  tiltReady?: boolean
  /** 元映像全体の水平FOV（度・推定値を含む） */
  sourceHorizontalFovDeg?: number
}

export function ARInundationOverlay({
  risks,
  selected,
  onSelect,
  onClose,
  suppressed = false,
  children,
  sample = false,
  live = false,
  videoRef,
  tiltRef,
  tiltReady = false,
  sourceHorizontalFovDeg = DEFAULT_FOV,
}: Props) {
  const risk = risks[selected]
  const [acknowledged, setAcknowledged] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [replay, setReplay] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const [visible, setVisible] = useState(true)
  const [sceneError, setSceneError] = useState<string | null>(null)
  const [submerged, setSubmerged] = useState(false)
  // 地図アプリのシートと同じように、説明をたたんでカメラを広く見せる。
  // 学習イメージの限界と注意文は、たたんでも隠さない。
  const [expanded, setExpanded] = useState(true)
  const sheet = useRef<HTMLDivElement>(null)
  const [sheetHeight, setSheetHeight] = useState(325)
  const zone = risk.kind === 'inside' ? risk.zone : undefined
  const canShow = Boolean(zone) && risk.confirmed !== false && !suppressed && visible
  const knownDepth = Boolean(zone && (zone.depthMinMeters !== null || zone.depthMaxMeters !== null))
  const zoneKey = zone?.zoneId
  const timeline = useMemo(() => (zone ? buildDepthTimeline(zone) : null), [zone])

  useEffect(() => {
    if (!sheet.current) return
    const update = () => setSheetHeight(sheet.current?.getBoundingClientRect().height ?? 325)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(sheet.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    setAcknowledged(false); setPlaying(false); setSceneError(null); setSubmerged(false); setExpanded(true)
  }, [zoneKey, selected, suppressed])
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update(); query.addEventListener('change', update)
    const visibility = () => { setVisible(!document.hidden); if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', visibility)
    return () => { query.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  // センサーが途絶えたら水位の上昇を止める。復旧しても自動では再開せず、利用者の操作を待つ。
  useEffect(() => {
    if (live && !tiltReady) setPlaying(false)
  }, [live, tiltReady])

  // One scale for the endpoints AND the 1.7m reference person. Large or open
  // ranges use a compressed scale; never invent a finite upper endpoint.
  const openUpper = Boolean(zone && zone.depthMaxMeters === null)
  const scaleMax = Math.max(3, zone?.depthMaxMeters ?? (zone?.depthMinMeters ?? 3) * 1.25)
  const scale = 230 / scaleMax
  const lower = (zone?.depthMinMeters ?? 0) * scale
  const upper = (zone?.depthMaxMeters ?? scaleMax) * scale
  const guideMarks = layoutDepthGuideMarks(
    depthGuideMarksWithin(zone?.depthMaxMeters ?? zone?.depthMinMeters ?? null),
    { scalePxPerMeter: scale, personHeightPx: 1.7 * scale, availableHeightPx: 236 },
  )
  // 目盛りが短いときは、範囲の吹き出しが上下の数値と重なるので外へ出す。
  const rulerTight = upper - lower < 90
  // たたんだときは短い表記にする。限界と注意は、たたんでも必ず出す。
  const sceneNoticeText = expanded ? HAZARD_WATER_SCENE_NOTICE : HAZARD_WATER_SCENE_NOTICE_SHORT
  const learningNoticeText = expanded ? HAZARD_LEARNING_NOTICE : HAZARD_LEARNING_NOTICE_SHORT

  // カメラ映像へ水面を重ねるのは、現地AR・区域内・深さあり・有効な傾き・WebGL正常のときだけ。
  const showScene = Boolean(live && canShow && acknowledged && knownDepth && timeline && videoRef && tiltRef && tiltReady && !sceneError)
  const sceneFallbackReason = !live || !acknowledged || !knownDepth || !canShow
    ? null
    : sceneError ?? (tiltReady ? null : '端末の傾きを取得できないため、高さの比較で表示しています。')

  return <section className={`ar-inundation ar-inundation--${selected}`} aria-label={HAZARD_LEARNING_TITLE}>
    <button className="ar-depth-close" type="button" onClick={onClose} aria-label="浸水学習を閉じる"><ArrowLeft size={20} /></button>
    <div className="ar-inundation-tabs" role="group" aria-label="災害の種類">
      {(['flood', 'tsunami'] as const).map(type => {
        const Icon = type === 'flood' ? Droplets : Waves
        return <button key={type} type="button" aria-pressed={selected === type} onClick={() => onSelect(type)}
          disabled={risks[type].kind !== 'inside'}><Icon aria-hidden="true" size={22} />{type === 'flood' ? '洪水' : '津波'}</button>
      })}
    </div>

    {showScene && timeline && videoRef && tiltRef && <ARWaterScene videoRef={videoRef} tiltRef={tiltRef} timeline={timeline}
      hazard={selected} playing={playing} reducedMotion={reducedMotion} replayKey={replay}
      sourceHorizontalFovDeg={sourceHorizontalFovDeg} onFailure={setSceneError} onSubmergedChange={setSubmerged} />}

    {showScene && submerged && <div className="ar-depth-submerged" role="status">
      <strong>仮想視点（水面下）</strong>
      <span>仮定した端末の高さ（約{AR_ASSUMED_CAMERA_HEIGHT_M}m）より深いため、水面の下から見た表示にしています。あなたや端末が実際に水没する高さを判定したものではありません。</span>
    </div>}

    {canShow && acknowledged && knownDepth && !showScene && <div className="ar-depth-visual" style={{ bottom: sheetHeight + 16 }} aria-label="人物と想定浸水深の高さ比較">
      <span className="ar-depth-caption">高さの比較イメージ</span>
      {!showScene && <div className="ar-depth-water-clip" style={{ height: upper }}>
        {/* This is an educational screen overlay; it is not a terrain model. */}
        <img key={replay} className={`ar-depth-water ${selected === 'tsunami' ? 'ar-depth-water--tsunami' : ''}`}
          src="/images/ar/water-surface.png" alt="" aria-hidden="true"
          style={{ animationPlayState: playing && !reducedMotion ? 'running' : 'paused',
            animationName: reducedMotion ? 'none' : selected === 'tsunami' ? 'ar-depth-emphasis' : 'ar-water-rise' }} />
      </div>}
      <div className="ar-depth-person" style={{ height: 1.7 * scale }}>
        <img src="/images/ar/height-reference-adult.png" alt="高さ約170cmの比較用人物" />
        <span>大人<br />約170cm</span>
      </div>
      {guideMarks.map(mark => <div key={mark.depthMeters} className="ar-depth-guide" style={{ bottom: mark.bottomPx }}>
        <span>{mark.depthMeters}m・{mark.shortLabel}</span>
      </div>)}
      <div className={`ar-depth-ruler ${rulerTight ? 'ar-depth-ruler--tight' : ''}`} style={{ height: upper - lower, bottom: lower, borderTop: openUpper ? 'none' : undefined }}>
        <span className="ar-depth-endpoint ar-depth-endpoint--top">{openUpper ? '上限なし' : `${zone?.depthMaxMeters?.toFixed(1)}m`}</span>
        <span className="ar-depth-range">{zone && hazardDepthLabel(zone)}<small>の範囲</small></span>
        {zone?.depthMinMeters !== null && <span className="ar-depth-endpoint ar-depth-endpoint--bottom">{zone?.depthMinMeters?.toFixed(1)}m</span>}
      </div>
    </div>}

    <div className={`ar-inundation-sheet ${acknowledged && knownDepth ? 'ar-inundation-sheet--active' : ''} ${expanded ? '' : 'ar-inundation-sheet--collapsed'}`} ref={sheet}>
      <div className="ar-depth-heading"><div><p>{selected === 'flood' ? '洪水' : '津波'}の想定浸水深</p>
        <strong>{zone ? hazardDepthLabel(zone) : '確認できません'}</strong></div>
      </div>
      {!acknowledged ? <div className="ar-depth-start">
        <p>{suppressed ? '位置精度や移動速度のため表示を停止しています。' : risk.confirmed === false ? '位置の判定を確認しています。' : '安全な場所で立ち止まって確認してください。'}</p>
        {live && knownDepth && <p className="ar-depth-scene-notice">{HAZARD_WATER_SCENE_NOTICE}</p>}
        <button type="button" disabled={!canShow} onClick={() => { setAcknowledged(true); setPlaying(true); setExpanded(false) }}>
          <Play size={20} aria-hidden="true" />立ち止まって{knownDepth ? '再生する' : '説明を見る'}</button>
      </div> : <div className="ar-depth-controls">
        {knownDepth ? <>
          <button type="button" disabled={!canShow || reducedMotion} onClick={() => setPlaying(value => !value)}>
            {playing && !reducedMotion ? <Pause aria-hidden="true" size={22} /> : <Play aria-hidden="true" size={22} />}
            {reducedMotion ? '静止画で表示中' : playing ? '一時停止' : '再生する'}</button>
          <button type="button" className="ar-depth-replay" aria-label="もう一度" disabled={!canShow || reducedMotion}
            onClick={() => { setReplay(value => value + 1); setPlaying(true) }}><RotateCw aria-hidden="true" size={20} />
            <span className="ar-depth-replay-label">もう一度</span></button>
          <button type="button" className="ar-depth-sheet-toggle" aria-expanded={expanded}
            aria-label={expanded ? '説明をたたむ' : '説明をひらく'} onClick={() => setExpanded(value => !value)}>
            {expanded ? <ChevronDown size={20} aria-hidden="true" /> : <ChevronUp size={20} aria-hidden="true" />}</button>
        </> : <p>この地点には深さの情報がないため、高さの比較は表示できません。</p>}
      </div>}
      {live && knownDepth && acknowledged && <p className="ar-depth-scene-notice">{sceneNoticeText}</p>}
      {sceneFallbackReason && <p className="ar-depth-scene-notice" role="status">{sceneFallbackReason}</p>}
      {expanded && guideMarks.length > 0 && acknowledged && knownDepth && <p className="ar-depth-guide-caveat">
        {guideMarks.map(mark => <span key={mark.depthMeters}>{mark.depthMeters}m：{mark.label}</span>)}
        {DEPTH_GUIDE_CAVEAT}
        <span>出典：{[...new Set(guideMarks.map(mark => mark.sourceName))].join('、')}</span></p>}
      {selected === 'tsunami' && <p className="ar-tsunami-action">津波警報が出たら、海や川から離れて高い場所へ避難しましょう。</p>}
      <p className="ar-depth-notice"><Info size={18} aria-hidden="true" /><span>{learningNoticeText}</span></p>
      {expanded && <p className="ar-depth-source">{sample ? 'デザイン用サンプル・実地点の想定ではありません' :
        `出典：${risk.sources.map(source => `${source.name}／${source.region}／${source.dataYear ?? '対象年不明'}${source.dataYear ? '年版' : ''}`).join('、') || '公的な浸水想定データ'}`}</p>}
      {expanded && children && <div className="ar-depth-accident">{children}</div>}
    </div>
  </section>
}
