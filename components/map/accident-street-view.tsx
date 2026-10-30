'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, ImageOff, LoaderCircle, RotateCw } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { loadStreetView, streetViewLocationInfo, type StreetViewTarget } from '@/lib/street-view'
import { AccidentFacts } from './accident-facts'

type ViewState = 'loading' | 'ready' | 'empty' | 'configuration' | 'network'

export function AccidentStreetView({ target, onClose }: { target: StreetViewTarget; onClose: () => void }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  const [state, setState] = useState<ViewState>('loading')
  const [metadata, setMetadata] = useState<{ distance: number; date: string | null } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [longitude, latitude] = target.coordinates

  useEffect(() => {
    if (!host) return
    let cancelled = false
    let panorama: google.maps.StreetViewPanorama | null = null
    const globals = window as Window & { gm_authFailure?: () => void }
    const previous = globals.gm_authFailure
    const authFailure = () => { if (!cancelled) setState('configuration'); previous?.() }
    globals.gm_authFailure = authFailure
    setState('loading'); setMetadata(null)
    const timeout = setTimeout(() => { if (!cancelled) setState(current => current === 'loading' ? 'network' : current) }, 15_000)
    async function initialize() {
      try {
        const api = await loadStreetView()
        if (cancelled) return
        const maps = api.maps
        const service = new maps.StreetViewService()
        // Multiple sources are intersected. Do not fall back to indoor/UGC imagery.
        const { data } = await service.getPanorama({
          location: { lat: latitude, lng: longitude }, radius: 50,
          preference: maps.StreetViewPreference.NEAREST,
          sources: ['google' as google.maps.StreetViewSource, maps.StreetViewSource.OUTDOOR],
        })
        if (cancelled) return
        if (!data.location?.pano || !data.location.latLng) { setState('empty'); return }
        const info = streetViewLocationInfo([longitude, latitude], data.location.latLng.toJSON())
        if (info.distance > 50) { setState('empty'); return }
        panorama = new maps.StreetViewPanorama(host, {
          pano: data.location.pano, pov: { heading: info.heading, pitch: 0 }, zoom: 0,
          addressControl: false, fullscreenControl: false, linksControl: false,
          clickToGo: false, motionTracking: false, motionTrackingControl: false,
          imageDateControl: true, showRoadLabels: true,
        })
        setMetadata({ distance: info.distance, date: data.imageDate ?? null })
        setState(current => current === 'configuration' ? current : 'ready')
      } catch (error) {
        if (cancelled) return
        const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
        setState(current => current === 'configuration' ? current :
          error instanceof Error && error.message === 'configuration' ? 'configuration' : code === 'ZERO_RESULTS' ? 'empty' : 'network')
      } finally { clearTimeout(timeout) }
    }
    void initialize()
    return () => {
      cancelled = true; clearTimeout(timeout)
      if (globals.gm_authFailure === authFailure) globals.gm_authFailure = previous
      if (panorama) { panorama.setVisible(false); google.maps.event.clearInstanceListeners(panorama) }
    }
  }, [latitude, longitude, attempt, host])

  const message = { empty: 'この地点から50m以内に対象のストリートビューがありません。',
    configuration: '現地の景色を表示する設定を確認中です。', network: '現地の景色を読み込めませんでした。' }
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="!fixed !inset-0 !z-[100] !flex !h-[100dvh] !max-w-none !translate-x-0 !translate-y-0 !flex-col !gap-0 !rounded-none !border-0 !bg-paper-card !p-0"
      overlayClassName="!z-[99] !bg-paper-card">
      <header className="flex shrink-0 items-center gap-3 border-b border-paper-deep px-4 py-3 pr-12">
        <button type="button" onClick={onClose} aria-label="元の画面に戻る" className="grid size-11 place-items-center rounded-full bg-paper-deep"><ArrowLeft size={22} /></button>
        <div><DialogTitle>現地の景色</DialogTitle><DialogDescription>事故当時の写真ではなく、周辺の景色です。</DialogDescription></div>
      </header>
      <div className="relative min-h-[200px] flex-1 bg-paper-deep">
        <div ref={setHost} className="absolute inset-0" data-testid="official-street-view" />
        {state === 'loading' && <div className="absolute inset-0 grid place-content-center gap-3 bg-paper-deep text-center" role="status"><LoaderCircle className="mx-auto animate-spin" /><p>現地の景色を読み込んでいます…</p></div>}
        {state !== 'ready' && state !== 'loading' && <div className="absolute inset-0 grid place-content-center gap-3 bg-paper-deep p-6 text-center" role="status">
          <ImageOff className="mx-auto" size={32} /><p>{message[state]}</p>
          {state === 'network' && <button className="min-h-11 rounded-full bg-forest px-5 text-white" type="button" onClick={() => setAttempt(value => value + 1)}><RotateCw className="mr-2 inline" size={18} />再試行</button>}
        </div>}
      </div>
      <footer className="max-h-[38dvh] shrink-0 overflow-auto border-t border-paper-deep px-5 py-4 text-ink">
        <AccidentFacts properties={target.properties} />
        {metadata && <p className="mt-2 text-xs text-ink-soft">事故地点と撮影位置の距離：約{Math.round(metadata.distance)}m ／ 撮影年月：{metadata.date ?? '不明'}</p>}
        <p className="mt-2 text-xs text-ink-soft">出典：警察庁 交通事故統計オープンデータを加工</p>
      </footer>
    </DialogContent>
  </Dialog>
}
