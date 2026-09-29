'use client'

import { useEffect, useRef, useState } from 'react'
import { photoQuizConfigSchema, photoQuizItemSchema, type PhotoQuizItem, type PhotoQuizScenario } from '@/lib/hunter/routes/photo-quiz-schema'
import { routePhotoUrl } from '@/lib/hunter/routes/notes'
import type { CourseView } from '@/lib/hunter/routes/types'
import { routeRequest } from './route-request'
import { cn } from '@/lib/utils'

type Template = { id: string; title: string; category: string; focus: string; hypothetical: string; outcome: string; scenarios: PhotoQuizScenario[] }
const button = 'min-h-12 rounded-xl border-2 border-teal-800 bg-white px-4 py-3 text-base font-bold text-teal-950 disabled:opacity-40'
const input = 'mt-2 min-h-12 w-full rounded-xl border-2 border-slate-400 bg-white px-3 py-2 text-lg font-normal text-slate-950'
const scenarios: Record<PhotoQuizScenario, string> = { normal: 'いつもの道', rain: '雨の日', evening: '夕方', earthquake: '地震が起きたら' }

export function PhotoQuizEditor({ course, onSaved, onClose }: { course: CourseView; onSaved: (course: CourseView) => void; onClose: () => void }) {
  const [items, setItems] = useState<PhotoQuizItem[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [revision, setRevision] = useState(course.revision)
  const [draft, setDraft] = useState<PhotoQuizItem | null>(null)
  const [busy, setBusy] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [photoReady, setPhotoReady] = useState(false)
  const [photoError, setPhotoError] = useState(false)
  const [remote, setRemote] = useState<{ revision: number; items: PhotoQuizItem[] } | null>(null)
  const [localBackup, setLocalBackup] = useState<PhotoQuizItem[] | null>(null)
  const lock = useRef(false)
  const photoUrl = draft ? routePhotoUrl(course.id, draft.sceneId, draft.photoIndex) : ''
  useEffect(() => {
    let cancelled = false
    setBusy(true); setError('')
    routeRequest(`/api/hunter/routes/${course.id}/quiz-config`).then(data => {
      if (cancelled) return
      setItems(data.items); setTemplates(data.templates); setRevision(data.revision); setLoaded(true)
    }).catch(err => { if (!cancelled) setError(err.message) }).finally(() => { if (!cancelled) setBusy(false) })
    return () => { cancelled = true }
  }, [course.id, retry])
  useEffect(() => { setPhotoReady(false); setPhotoError(false) }, [photoUrl])
  function change(patch: Partial<PhotoQuizItem>) { setDraft(value => value ? { ...value, ...patch } : null); setError('') }
  function add() {
    const scene = course.scenes.find(value => value.photoCount > 0), template = templates[0]
    if (!scene || !template) return
    setDraft({ id: crypto.randomUUID(), sceneId: scene.id, photoIndex: 0, title: template.title, templateId: template.id, scenario: 'normal', observed: '', hypothetical: template.hypothetical, region: { x: 0.35, y: 0.35, width: 0.3, height: 0.3 } })
    setError('')
  }
  function keepDraft() {
    const parsed = photoQuizItemSchema.safeParse(draft)
    if (!parsed.success) { setError('場所の名前、写真で見えること、もし起きたらの内容を入力し、写真の範囲を確認してください。'); return }
    setItems(values => values.some(value => value.id === parsed.data.id) ? values.map(value => value.id === parsed.data.id ? parsed.data : value) : [...values, parsed.data])
    setDraft(null); setError('')
  }
  function move(index: number, offset: number) {
    setItems(values => { const next = [...values]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next })
  }
  async function save() {
    if (lock.current || draft) return
    const parsed = photoQuizConfigSchema.safeParse({ revision, items })
    if (!parsed.success) { setError('問題の内容を確認してください。保存できる問題は96問までです。'); return }
    lock.current = true; setBusy(true); setError('')
    try { const data = await routeRequest(`/api/hunter/routes/${course.id}/quiz-config`, parsed.data); onSaved(data.course) }
    catch (err) { setError((err as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  async function checkSaved() {
    if (lock.current) return
    lock.current = true; setBusy(true)
    try {
      const latest = await routeRequest(`/api/hunter/routes/${course.id}/quiz-config`)
      const canonical = photoQuizConfigSchema.parse({ revision, items }).items
      if (JSON.stringify(latest.items) === JSON.stringify(canonical)) {
        const saved = await routeRequest(`/api/hunter/routes/${course.id}`)
        onSaved(saved.course)
      } else if (latest.revision !== revision) {
        setRemote({ revision: latest.revision, items: latest.items })
        setError('別の編集が保存されています。下で内容を比べてから、最新の内容を読み込んでください。自分の編集はメモとして残せます。')
      } else { setError('この編集はまだ保存されていません。「コースに保存する」からもう一度保存できます。') }
    } catch (err) { setError((err as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  const currentTemplate = templates.find(value => value.id === draft?.templateId)
  return <section className="mt-6 space-y-5 rounded-2xl border-2 border-teal-800 bg-white p-4 text-slate-950 sm:p-6" aria-label="写真クイズの編集">
    <h3 className="text-2xl font-bold">写真から問題をつくる</h3>
    <p className="text-lg leading-8">① 写真と場所を選ぶ → ② 写真で見えることを書く → ③ 学ぶ危険を選ぶ。保存後に実際のクイズを遊んで、内容を確認できます。</p>
    {error && <div role="alert" className="rounded-xl border-2 border-red-700 bg-red-50 p-4 text-lg"><p>{error}</p>{!loaded && <button className={`${button} mt-3`} disabled={busy} onClick={() => setRetry(value => value + 1)}>読み直す</button>}</div>}
    {error && loaded && !draft && <button className={button} disabled={busy} onClick={checkSaved}>保存された内容を確認する</button>}
    {remote && <div className="space-y-3 rounded-xl border-2 border-amber-700 bg-amber-50 p-4"><h4 className="text-xl font-bold">現在保存されている問題</h4><ol className="space-y-2">{remote.items.map((item, index) => <li key={item.id}><strong>{index + 1}. {item.title}</strong><p>{item.observed}</p><p>もし：{item.hypothetical}</p></li>)}</ol><button className={button} disabled={busy} onClick={() => { setLocalBackup(items); setItems(remote.items); setRevision(remote.revision); setRemote(null); setError('') }}>自分の編集をメモに残して、最新を読み込む</button></div>}
    {localBackup && <details className="rounded-xl border-2 border-slate-300 p-4"><summary className="min-h-12 cursor-pointer text-lg font-bold">読み込み前の自分の編集メモ</summary><p className="my-3">必要な内容をコピーして、問題に反映してください。このメモは画面を閉じると消えます。</p><textarea readOnly aria-label="自分の編集メモ" className={input} rows={8} value={localBackup.map((item, index) => `${index + 1}. ${item.title}（${scenarios[item.scenario]}）\n写真で見えること：${item.observed}\nもし：${item.hypothetical}`).join('\n\n')} /></details>}
    {busy && <p role="status">読み込み・保存中…</p>}
    {!draft && loaded && <><ol className="space-y-3">{items.map((item, index) => <li key={item.id} className="rounded-xl border-2 border-slate-200 p-4"><strong className="block text-xl">{index + 1}. {item.title}</strong><p className="my-2 text-base">{scenarios[item.scenario]} · {course.scenes.find(scene => scene.id === item.sceneId)?.name} · 写真 {item.photoIndex + 1}</p><div className="flex flex-wrap gap-2"><button className={button} disabled={busy} onClick={() => { setDraft(item); setError('') }}>問題を編集</button><button className={button} aria-label={`${item.title}を前へ`} disabled={busy || index === 0} onClick={() => move(index, -1)}>↑ 前へ</button><button className={button} aria-label={`${item.title}を後ろへ`} disabled={busy || index === items.length - 1} onClick={() => move(index, 1)}>↓ 後ろへ</button><button className={button} disabled={busy} onClick={() => setItems(values => values.filter(value => value.id !== item.id))}>一覧から外す</button></div></li>)}</ol>{items.length === 0 && <p className="rounded-xl bg-slate-100 p-5 text-lg">まだ問題がありません。まず「いつもの道」を1問つくりましょう。</p>}<button className={button} disabled={busy || items.length >= 96 || !course.scenes.some(scene => scene.photoCount)} onClick={add}>＋ 写真の問題を追加</button></>}
    {draft && <div className="space-y-5 rounded-xl bg-slate-50 p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-lg font-bold">写真の地点<select className={input} value={draft.sceneId} onChange={event => change({ sceneId: event.target.value, photoIndex: 0 })}>{course.scenes.filter(scene => scene.photoCount > 0).map(scene => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></label><label className="text-lg font-bold">使う写真<select className={input} value={draft.photoIndex} onChange={event => change({ photoIndex: Number(event.target.value) })}>{Array.from({ length: course.scenes.find(scene => scene.id === draft.sceneId)?.photoCount ?? 0 }, (_, index) => <option key={index} value={index}>写真 {index + 1}</option>)}</select></label></div>
      <p className="text-lg leading-8">写真をタップすると囲みが移動します。下のスライダーで大きさと位置を調整できます。顔・表札・ナンバーが隠れていることも確認してください。</p>
      <div className="relative overflow-hidden rounded-xl bg-slate-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={photoUrl} src={photoUrl} alt="問題に使う写真。囲みで見つけてほしい場所を指定します" className="block h-auto w-full cursor-crosshair" draggable={false} onLoad={() => setPhotoReady(true)} onError={() => { setPhotoReady(false); setPhotoError(true) }} onClick={event => {
          if (!photoReady) return
          const bounds = event.currentTarget.getBoundingClientRect(), region = draft.region
          change({ region: { ...region, x: Math.max(0, Math.min(1 - region.width, (event.clientX - bounds.left) / bounds.width - region.width / 2)), y: Math.max(0, Math.min(1 - region.height, (event.clientY - bounds.top) / bounds.height - region.height / 2)) } })
        }} />
        {photoReady && <div className="pointer-events-none absolute border-4 border-amber-600 bg-amber-300/25" style={{ left: `${draft.region.x * 100}%`, top: `${draft.region.y * 100}%`, width: `${draft.region.width * 100}%`, height: `${draft.region.height * 100}%` }} />}
      </div>
      {photoError && <p role="alert" className="text-lg text-red-800">写真を読み込めません。写真を選び直すか、時間をおいて編集し直してください。</p>}
      <div className="grid gap-4 sm:grid-cols-2">{(['x', 'y', 'width', 'height'] as const).map(key => <label key={key} className="text-base font-bold">{{ x: '左からの位置', y: '上からの位置', width: '囲みの横幅', height: '囲みの高さ' }[key]}：{Math.round(draft.region[key] * 100)}%<input className="block h-12 w-full accent-teal-800" type="range" min={key === 'width' || key === 'height' ? 2 : 0} max={key === 'x' ? Math.round((1 - draft.region.width) * 100) : key === 'y' ? Math.round((1 - draft.region.height) * 100) : 100} value={Math.round(draft.region[key] * 100)} onChange={event => {
          const region = { ...draft.region, [key]: Number(event.target.value) / 100 }
          region.x = Math.max(0, Math.min(region.x, 1 - region.width)); region.y = Math.max(0, Math.min(region.y, 1 - region.height)); change({ region })
        }} /></label>)}</div>
      <label className="block text-lg font-bold">場所の名前<input className={input} maxLength={60} value={draft.title} onChange={event => change({ title: event.target.value })} /></label>
      <label className="block rounded-xl border-l-4 border-sky-700 bg-sky-50 p-4 text-lg font-bold">写真で見えること<textarea className={input} rows={3} maxLength={240} placeholder="例：交差点の角に高い塀があり、向こうの道が見えにくい。" value={draft.observed} onChange={event => change({ observed: event.target.value })} /><span className="mt-2 block text-base font-normal">写真で確認できる事実だけを書きます。分からないことは、下の「もし起きたら」に分けます。</span></label>
      <label className="block text-lg font-bold">学ぶ危険<select className={input} value={draft.templateId} onChange={event => { const template = templates.find(value => value.id === event.target.value)!; change({ templateId: template.id, hypothetical: template.hypothetical, scenario: template.scenarios.includes(draft.scenario) ? draft.scenario : template.scenarios[0] }) }}>{templates.map(template => <option key={template.id} value={template.id}>{template.title}</option>)}</select></label>
      <label className="block text-lg font-bold">出題する場面<select className={input} value={draft.scenario} onChange={event => change({ scenario: event.target.value as PhotoQuizScenario })}>{Object.entries(scenarios).map(([value, label]) => <option key={value} value={value} disabled={!currentTemplate?.scenarios.includes(value as PhotoQuizScenario)}>{label}</option>)}</select></label>
      <label className="block rounded-xl border-l-4 border-amber-700 bg-amber-50 p-4 text-lg font-bold">もし、こんなことが起きたら<textarea className={input} rows={3} maxLength={240} value={draft.hypothetical} onChange={event => change({ hypothetical: event.target.value })} /></label>
      {currentTemplate && <div className="rounded-xl border-2 border-teal-700 bg-teal-50 p-4 text-lg leading-8"><strong className="block">この問題で伝える安全な行動</strong><p>{currentTemplate.outcome}</p><p className="mt-2 text-base">この説明が写真の場所に合うか確認してください。合わない場合は、学ぶ危険や使う写真を選び直します。</p></div>}
      <div className="flex flex-wrap gap-3"><button className={cn(button, 'bg-teal-800 text-white')} onClick={keepDraft} disabled={!photoReady}>問題一覧に反映</button><button className={button} onClick={() => { setDraft(null); setError('') }}>この編集を取り消す</button></div>
    </div>}
    <div className="flex flex-wrap gap-3 border-t pt-5"><button className={cn(button, 'grow bg-teal-800 text-white')} disabled={busy || !loaded || !!draft || !!remote} onClick={save}>コースに保存する</button><button className={button} disabled={busy} onClick={onClose}>保存せず閉じる</button></div>
    <p className="text-base leading-7">保存すると、学校に公開中のコースは公開をいったん解除します。自分だけで使う場合、学校への公開は不要です。</p>
  </section>
}
