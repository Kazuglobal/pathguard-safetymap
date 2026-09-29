'use client'
import { useEffect, useRef, useState } from 'react'
import type { PrintDocument } from '@/lib/report-generation/print-document'
import { PRINT_CSS, preparePrintPages, type PreparedPrint } from '@/lib/report-generation/print-pages'
import { Button } from '@/components/ui/button'

export function ReportPrintPreview({ source, onReady, onPageChange }: { source: PrintDocument; onReady: (result: PreparedPrint | null) => void; onPageChange?: (page: number) => void }) {
  const [prepared, setPrepared] = useState<PreparedPrint | null>(null)
  const [page, setPage] = useState(0)
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [scale, setScale] = useState(0.5)
  const viewport = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  useEffect(() => { onPageChange?.(page) }, [page, onPageChange])
  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setPrepared(null); setError(''); onReady(null)
    void preparePrintPages(source, controller.signal).then(result => {
      if (cancelled) return
      setPrepared(result); setPage(0); onReady(result)
    }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : '仕上がりを表示できません。') })
    return () => { cancelled = true; controller.abort() }
  }, [source, retry, onReady])
  useEffect(() => {
    if (!viewport.current) return
    const resize = () => setScale(Math.min(1, Math.max(0.1, (viewport.current!.clientWidth - 24) / (210 * 96 / 25.4))))
    resize()
    const observer = new ResizeObserver(resize); observer.observe(viewport.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const host = sheet.current
    if (!host || !prepared) return
    host.replaceChildren(prepared.pages[page].cloneNode(true))
    return () => host.replaceChildren()
  }, [prepared, page, reading])
  return <section aria-label="印刷の仕上がり" className="min-w-0 rounded-xl border border-slate-200 bg-slate-100">
    <style>{PRINT_CSS}</style>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white p-4">
      <div><h3 className="text-lg font-bold text-slate-900">仕上がりを確認</h3><p role="status" className="text-sm text-slate-700">{prepared ? `A4たて・${prepared.pages.length}ページ` : '用紙を準備しています…'}</p></div>
      <Button variant="outline" className="min-h-11" onClick={() => setReading(value => !value)}>{reading ? '用紙全体を見る' : '内容を大きく読む'}</Button>
    </div>
    {error && <div role="alert" className="p-5 text-red-800"><p>{error}</p><Button variant="outline" className="mt-3 min-h-11" onClick={() => setRetry(value => value + 1)}>もう一度読み込む</Button></div>}
    {prepared?.warnings.map(warning => <p role="status" key={warning} className="m-3 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950">{warning}</p>)}
    <div ref={viewport} className="overflow-hidden p-3">
      {!prepared && !error && <div className="mx-auto h-96 max-w-sm animate-pulse rounded-sm bg-white" aria-label="用紙を準備中" />}
      {reading ? <div className="space-y-4 rounded-lg bg-white p-4 text-lg leading-8 text-slate-900"><h3 className="font-bold">{source.title}</h3>{source.items.map(item => <article key={item.id} className="border-t py-4"><h4 className="font-bold">{item.number}. {item.title}</h4><p className="mt-2 whitespace-pre-wrap">{item.observation}</p><p className="mt-3 font-bold">{item.action}</p></article>)}</div> : <div style={{ height: prepared ? 297 * 96 / 25.4 * scale : 0 }} className="relative mx-auto w-full"><div ref={sheet} className="absolute left-1/2 top-0 origin-top-left shadow-sm" style={{ transform: `translateX(-${210 * 96 / 25.4 * scale / 2}px) scale(${scale})` }} /></div>}
    </div>
    {prepared && <div className="flex flex-wrap items-center justify-center gap-3 border-t bg-white p-3"><Button variant="outline" className="min-h-11" disabled={page === 0} onClick={() => setPage(value => value - 1)}>前のページ</Button><span className="text-sm font-bold">{page + 1} / {prepared.pages.length}</span><Button variant="outline" className="min-h-11" disabled={page === prepared.pages.length - 1} onClick={() => setPage(value => value + 1)}>次のページ</Button></div>}
  </section>
}
