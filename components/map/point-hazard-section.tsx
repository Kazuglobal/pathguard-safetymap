'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { hazardDepthLabel, hazardStatusLabel, HAZARD_OUTSIDE_NOTICE, type HazardPointResult } from '@/lib/hazard-point'
import type { HazardType } from '@/lib/types'
import { ARInundationOverlay } from './ar-inundation-overlay'

export function PointHazardSection({ center, locationSource }: { center: [number, number]; locationSource: 'map' | 'gps' }) {
  const [data, setData] = useState<HazardPointResult | null>(null)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<HazardType | null>(null)
  const [revision, setRevision] = useState(0)
  const [longitude, latitude] = center
  useEffect(() => {
    const controller = new AbortController()
    setData(null); setError(false); setSelected(null)
    const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude) })
    void fetch(`/api/hazard/point-risks?${query}`, { signal: controller.signal, credentials: 'same-origin' })
      .then(async response => {
        if (!response.ok) throw new Error('lookup failed')
        const result = await response.json() as HazardPointResult
        if (!result?.hazards?.flood || !result?.hazards?.tsunami) throw new Error('invalid lookup')
        if (!controller.signal.aborted) setData(result)
      }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [latitude, longitude, revision])
  return <section className="border-t border-paper-deep bg-paper-card p-4 text-ink" aria-label="この地点の浸水想定">
    <h3 className="font-bold">浸水の想定</h3>
    <p className="mt-1 text-xs text-ink-soft">{locationSource === 'map' ? '地図で選択した地点の浸水想定です。' : '調べた現在地の浸水想定です。'}</p>
    {error ? <><p role="status" className="mt-3 text-sm">取得不能：浸水想定を確認できません。</p><button type="button" className="min-h-11 text-sm text-forest-strong" onClick={() => setRevision(v => v + 1)}>再試行</button></> : !data ? <p className="mt-3 text-sm" role="status">浸水想定を確認しています…</p> :
      (['flood', 'tsunami'] as const).map(type => {
        const risk = data.hazards[type]
        return <div key={type} className="mt-3 border-t border-paper-deep pt-3 text-sm">
          <p className="font-semibold">{type === 'flood' ? '洪水' : '津波'}：{hazardStatusLabel(risk.kind)}</p>
          {risk.kind === 'inside' && risk.zone && <><p>想定浸水深 {hazardDepthLabel(risk.zone)}</p>
            <button className="my-2 min-h-11 rounded-full bg-forest px-5 text-white" type="button" onClick={() => setSelected(type)}>浸水の深さを見る</button></>}
          {risk.kind === 'outside' && <p className="mt-1 text-xs">{HAZARD_OUTSIDE_NOTICE}</p>}
          {risk.kind === 'no_coverage' && <p className="mt-1 text-xs">この地点の公的データは未収録です。安全という意味ではありません。</p>}
          {risk.sources.map(source => <p key={source.name + source.region} className="mt-1 text-xs text-ink-soft">出典：{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{source.name}</a> : source.name} ／ {source.region} ／ データ年度：{source.dataYear ?? '不明'}{source.importedAt ? ` ／ 取込日：${source.importedAt.slice(0, 10)}` : ''}</p>)}
        </div>
      })}
    {selected && data && <Dialog open onOpenChange={open => { if (!open) setSelected(null) }}>
      <DialogContent className="!fixed !inset-0 !z-[90] !h-[100dvh] !max-w-none !translate-x-0 !translate-y-0 !rounded-none !bg-paper !p-0" overlayClassName="!z-[89]">
        <div className="px-6 pt-5 text-ink"><DialogTitle>地点の浸水学習</DialogTitle><DialogDescription>{locationSource === 'map' ? '地図で選んだ地点' : '調べた現在地'}の学習イメージです。カメラ映像ではありません。</DialogDescription></div>
        <ARInundationOverlay risks={data.hazards} selected={selected} onSelect={setSelected} onClose={() => setSelected(null)} />
      </DialogContent>
    </Dialog>}
  </section>
}
