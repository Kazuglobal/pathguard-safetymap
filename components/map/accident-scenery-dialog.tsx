'use client'

import { useState } from 'react'
import { ArrowLeft, MapPin, RotateCw } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { buildGoogleMapsEmbedUrls } from '@/lib/google-maps-embed'
import type { StreetViewTarget } from '@/lib/street-view'
import { AccidentFacts } from './accident-facts'

export function AccidentSceneryDialog({ target, onClose }: {
  target: StreetViewTarget
  onClose: () => void
}) {
  const [attempt, setAttempt] = useState(0)
  const [returnFocus] = useState(() =>
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
      ? document.activeElement : null,
  )
  const urls = buildGoogleMapsEmbedUrls(target.coordinates, process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY)

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent
        className="!fixed !inset-0 !z-[100] !flex !h-[100dvh] !max-w-none !translate-x-0 !translate-y-0 !animate-none !flex-col !gap-0 !overflow-y-auto !rounded-none !border-0 !bg-paper-card !p-0 !transition-none"
        overlayClassName="!z-[99] !animate-none !bg-paper-card"
        onCloseAutoFocus={event => {
          event.preventDefault()
          // The map's inert/visibility state must be restored before focusing its popup.
          requestAnimationFrame(() => { if (returnFocus?.isConnected) returnFocus.focus() })
        }}
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-paper-deep px-4 py-3 pr-12 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button type="button" onClick={onClose} aria-label="元の地図に戻る" className="grid size-11 shrink-0 place-items-center rounded-full bg-paper-deep text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest">
            <ArrowLeft size={22} aria-hidden="true" />
          </button>
          <div className="min-w-0 space-y-1">
            <DialogTitle className="text-ink">現地の景色</DialogTitle>
            <DialogDescription>事故当時の写真ではなく、周辺の景色です。</DialogDescription>
            <p className="text-xs text-ink-soft">撮影位置は事故地点と異なる場合があります。景色の中を移動しても、地図の事故地点は固定です。</p>
          </div>
        </header>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-paper-deep px-5 py-3 text-ink">
          <AccidentFacts properties={target.properties} />
          {urls && <button type="button" onClick={() => setAttempt(value => value + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-paper-deep bg-paper px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest">
            <RotateCw size={16} aria-hidden="true" />再読み込み
          </button>}
        </div>

        {urls ? <div className="grid min-h-[560px] flex-1 grid-cols-1 gap-3 p-3 md:min-h-[360px] md:grid-cols-2">
          <section className="flex min-h-[260px] min-w-[200px] flex-col overflow-hidden rounded-xl border border-paper-deep bg-white">
            <h2 className="flex shrink-0 items-center gap-2 border-b border-paper-deep px-3 py-2 text-sm font-bold text-ink"><MapPin size={16} aria-hidden="true" />事故地点</h2>
            <iframe key={`map-${urls.map}-${attempt}`} title="事故地点のGoogle地図" src={urls.map} className="min-h-[200px] w-full flex-1 border-0" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          </section>
          <section className="flex min-h-[260px] min-w-[200px] flex-col overflow-hidden rounded-xl border border-paper-deep bg-white">
            <h2 className="shrink-0 border-b border-paper-deep px-3 py-2 text-sm font-bold text-ink">周辺のストリートビュー</h2>
            <iframe key={`street-${urls.streetView}-${attempt}`} title="事故地点周辺のストリートビュー" src={urls.streetView} className="min-h-[200px] w-full flex-1 border-0" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
          </section>
        </div> : <div role="status" className="grid min-h-[200px] flex-1 place-content-center gap-2 p-6 text-center text-ink">
          <p>現地の景色を表示する設定を確認中です。</p>
          <p className="text-sm text-ink-soft">元の地図に戻って、事故情報を引き続き確認できます。</p>
        </div>}

        <footer className="shrink-0 border-t border-paper-deep px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-xs text-ink-soft">
          <p>出典：警察庁 交通事故統計オープンデータを加工</p>
          {urls && <p className="mt-1">景色がない地点もあります。画像やエラーの案内は Google の表示をご確認ください。</p>}
        </footer>
      </DialogContent>
    </Dialog>
  )
}
