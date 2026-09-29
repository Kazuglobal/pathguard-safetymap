'use client'
import { useMemo, useRef, useState } from 'react'
import type { PhotoQuizView } from '@/lib/hunter/routes/photo-quiz-schema'
import type { PrintPurpose } from '@/lib/report-generation/print-document'
import { buildQuizPrintDocument } from '@/lib/report-generation/quiz-print-document'
import type { PreparedPrint } from '@/lib/report-generation/print-pages'
import { ReportPrintPreview } from '@/components/routes/report-print-preview'
import { printPreparedPages, savePrintPdf } from '@/lib/report-generation/print-output'

export function QuizChecklist({ session, onClose }: { session: PhotoQuizView; onClose: () => void }) {
  const [prepared, setPrepared] = useState<PreparedPrint | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [purpose, setPurpose] = useState<PrintPurpose>('family')
  const [selectedIds, setSelectedIds] = useState(() => session.learned.map(item => item.id))
  const [sharedTitle, setSharedTitle] = useState('みんなの通学路')
  const [placeNames, setPlaceNames] = useState<Record<string, string>>({})
  const [furigana, setFurigana] = useState(session.schoolYear <= 2)
  const [generatedAt] = useState(() => new Date().toISOString())
  const lock = useRef(false)
  const source = useMemo(() => buildQuizPrintDocument(session, { purpose, selectedIds, sharedTitle, placeNames, furigana, generatedAt }), [session, purpose, selectedIds, sharedTitle, placeNames, furigana, generatedAt])
  const button = 'min-h-14 rounded-xl border-2 border-teal-800 bg-white px-4 py-3 text-lg font-bold text-teal-950 disabled:opacity-40'
  async function output(kind: 'pdf' | 'print') {
    if (!prepared || prepared.source !== source || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { if (kind === 'pdf') await savePrintPdf(prepared); else await printPreparedPages(prepared) }
    catch (err) { setError(err instanceof Error ? err.message : '保存できませんでした。もう一度お試しください。') }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="space-y-4 border-t-2 border-teal-800 pt-5" aria-label="今日の親子チェックシート">
    <h4 className="text-2xl font-bold">今日学んだ場所を、親子でたしかめよう</h4>
    <p className="text-lg leading-8">今日クリアした{session.learned.length}か所から、用紙に載せる場所を選びます。</p>
    <fieldset className="space-y-3 rounded-xl border-2 border-slate-300 p-4" disabled={busy}><legend className="text-lg font-bold">用途と載せる内容</legend>
      <label className="block text-lg">使う場面<select value={purpose} onChange={event => setPurpose(event.target.value as PrintPurpose)} className="mt-2 min-h-14 w-full rounded-lg border-2 bg-white px-3"><option value="family">家庭でつかう</option><option value="school">学校で配る</option></select></label>
      {purpose === 'school' && <><p className="text-base leading-7">コース名と場所名を配布用の名前に置き換えます。元の詳しいメモや写真は載せません。</p><label className="block text-lg">配布用のコース名<input className="mt-2 min-h-14 w-full rounded-lg border-2 px-3" maxLength={64} value={sharedTitle} onChange={event => setSharedTitle(event.target.value)} /></label></>}
      {session.learned.map(item => <div key={item.id} className="rounded-lg border p-3"><label className="flex min-h-12 items-center gap-3 text-lg"><input type="checkbox" className="h-5 w-5 accent-teal-800" checked={selectedIds.includes(item.id)} onChange={() => setSelectedIds(values => values.includes(item.id) ? values.filter(id => id !== item.id) : [...values, item.id])} />{item.title}</label>{purpose === 'school' && selectedIds.includes(item.id) && <label className="block">用紙にのせる場所の名前<input className="mt-2 min-h-12 w-full rounded-lg border-2 px-3" maxLength={60} placeholder={`たしかめる場所 ${selectedIds.indexOf(item.id) + 1}`} value={placeNames[item.id] ?? ''} onChange={event => setPlaceNames(names => ({ ...names, [item.id]: event.target.value }))} /></label>}</div>)}
      <label className="flex min-h-12 items-center gap-3 text-lg"><input type="checkbox" className="h-5 w-5 accent-teal-800" checked={furigana} onChange={event => setFurigana(event.target.checked)} />ふりがなを付ける</label>
      {furigana && <p className="text-base leading-7">辞書にある言葉に付きます。地名などの読み方は、親子で確認してください。</p>}
    </fieldset>
    {selectedIds.length ? <ReportPrintPreview source={source} onReady={setPrepared} /> : <p role="status" className="rounded-xl bg-amber-50 p-4 text-lg">載せる場所を1か所以上選んでください。</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-lg text-red-900">{error}</p>}
    <div className="flex flex-wrap gap-3"><button className={button} disabled={busy || prepared?.source !== source} onClick={() => output('pdf')}>{busy ? '用意しています…' : 'PDFを保存'}</button><button className={button} disabled={busy || prepared?.source !== source} onClick={() => output('print')}>印刷する</button><button className={button} disabled={busy} onClick={onClose}>ふりかえりに戻る</button></div>
  </section>
}
