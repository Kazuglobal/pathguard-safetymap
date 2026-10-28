'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, MapPin, Plus, Volume2 } from 'lucide-react'
import { MAX_SCENE_NOTES, NOTE_CATEGORIES, NOTE_SOURCES, notesForScenario, routePhotoUrl, sceneNoteSchema, type SceneNote } from '@/lib/hunter/routes/notes'
import { ROUTE_SCENARIOS, type RouteScenario } from '@/lib/hunter/routes/curriculum'
import { RubyText } from '../ruby-text'

const button = 'min-h-11 rounded-xl border border-teal-700 bg-white px-4 py-2 text-sm font-bold text-teal-900 disabled:cursor-not-allowed disabled:opacity-40'
const input = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900'
const EMPTY_NOTES: readonly SceneNote[] = []

function SourceLabel({ source }: { source: SceneNote['source'] }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${source === 'observed' ? 'bg-sky-100 text-sky-900' : 'bg-amber-100 text-amber-900'}`}>{NOTE_SOURCES[source]}</span>
}

/** Native image proportions keep normalized markers aligned without object-fit gutters. */
function MarkedPhoto({ url, markers, onSelect, onPlace }: {
  url: string; markers: readonly { id: string; point: SceneNote['point']; label: string; selected?: boolean }[]
  onSelect?: (id: string) => void; onPlace?: (point: SceneNote['point']) => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  return <div>
    <div className={`relative overflow-hidden rounded-xl bg-slate-100 ${loaded ? '' : 'min-h-40'}`}
      onClick={event => {
        if (!onPlace || !loaded) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (rect.width && rect.height) onPlace({ x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) })
      }}>
      {/* Authenticated private photos must not go through a public image optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="個人情報を隠した通学路の写真" className={`block h-auto w-full ${failed ? 'hidden' : ''}`} onLoad={() => { setLoaded(true); setFailed(false) }} onError={() => { setLoaded(false); setFailed(true) }} draggable={false} />
      {!loaded && <p role={failed ? 'alert' : 'status'} className="p-5 text-sm text-slate-600">{failed ? '写真を読み込めませんでした。通信を確認して、コースを開き直してください。' : '写真を読み込んでいます…'}</p>}
      {loaded && markers.map(marker => <button type="button" key={marker.id} aria-label={marker.label} aria-pressed={marker.selected} disabled={!onSelect}
        style={{ left: `clamp(22px, ${marker.point.x * 100}%, calc(100% - 22px))`, top: `clamp(22px, ${marker.point.y * 100}%, calc(100% - 22px))` }}
        className={`absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white font-black text-white shadow-lg ${marker.selected ? 'bg-teal-800' : 'bg-amber-700'}`}
        onClick={event => { event.stopPropagation(); onSelect?.(marker.id) }}><MapPin size={23} /></button>)}
    </div>
    {onPlace && <p className="mt-2 text-xs text-slate-600">写真をタップして位置を選びます。下の位置スライダーでも調整できます。</p>}
  </div>
}

export function SceneNotesEditor({ courseId, sceneId, photoCount, notes, onSave, onCancel }: {
  courseId: string; sceneId: string; photoCount: number; notes: readonly SceneNote[]
  onSave: (notes: SceneNote[]) => Promise<void>; onCancel: () => void
}) {
  const [items, setItems] = useState<SceneNote[]>([...notes])
  const [draft, setDraft] = useState<SceneNote | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [photoIndex, setPhotoIndex] = useState(0)
  const photoUrl = routePhotoUrl(courseId, sceneId, photoIndex)
  function change(patch: Partial<SceneNote>) { setDraft(current => current ? { ...current, ...patch } : current); setError('') }
  function add() {
    setDraft({ id: crypto.randomUUID(), photoIndex, point: { x: 0.5, y: 0.5 }, category: 'traffic', scenario: 'normal',
      source: 'imagined', title: '', detail: '', evidence: '' })
    setError('')
  }
  function commitDraft() {
    const parsed = sceneNoteSchema.safeParse(draft)
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'メモの内容を確認してください。'); return }
    const note = parsed.data
    setItems(current => current.some(item => item.id === note.id) ? current.map(item => item.id === note.id ? note : item) : [...current, note])
    setDraft(null); setError('')
  }
  async function save() {
    setBusy(true); setError('')
    try { await onSave(items) }
    catch (err) { setError(err instanceof Error ? err.message : '保存できませんでした。もう一度お試しください。') }
    finally { setBusy(false) }
  }

  return <section className="my-5 space-y-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-4 sm:p-6" aria-label="危険のメモを編集">
    <h4 className="text-xl font-bold">写真を見て、危険のメモを直す</h4>
    <p className="text-sm leading-6 text-slate-600">写真に写っている特徴と、これから起こるかもしれない危険を分けて記入してください。人の名前や住所は入れないでください。位置は写真上の目印です。</p>
    <fieldset disabled={busy} className="space-y-4">
      <label className="block text-sm font-bold">写真<select className={`${input} mt-1`} value={photoIndex} onChange={event => { const index = Number(event.target.value); setPhotoIndex(index); change({ photoIndex: index }) }}>{Array.from({ length: photoCount }, (_, index) => <option key={index} value={index}>写真 {index + 1}</option>)}</select></label>
      <MarkedPhoto key={photoUrl} url={photoUrl} markers={draft ? [{ id: draft.id, point: draft.point, label: '編集中の目印', selected: true }] : items.filter(note => note.photoIndex === photoIndex).map(note => ({ id: note.id, point: note.point, label: `${note.title}を編集` }))}
        onPlace={draft ? point => change({ point }) : undefined} onSelect={draft ? undefined : id => { setDraft(items.find(item => item.id === id) ?? null); setError('') }} />
      {!draft && <button type="button" className={`${button} inline-flex items-center gap-2`} disabled={items.length >= MAX_SCENE_NOTES || !photoCount} onClick={add}><Plus size={18} />危険のメモを追加（{items.length}/{MAX_SCENE_NOTES}）</button>}
      {draft && <div className="space-y-4 rounded-xl border bg-white p-4" role="group" aria-label="メモの内容">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold">情報の区別<select className={`${input} mt-1`} value={draft.source} onChange={event => change({ source: event.target.value as SceneNote['source'] })}>{Object.entries(NOTE_SOURCES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="text-sm font-bold">危険の種類<select className={`${input} mt-1`} value={draft.category} onChange={event => change({ category: event.target.value as SceneNote['category'] })}>{Object.entries(NOTE_CATEGORIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className="text-sm font-bold">学ぶ場面<select className={`${input} mt-1`} value={draft.scenario} onChange={event => change({ scenario: event.target.value as RouteScenario })}>{ROUTE_SCENARIOS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
          <label className="text-sm font-bold">メモの名前<input className={`${input} mt-1`} value={draft.title} maxLength={60} onChange={event => change({ title: event.target.value })} placeholder="例：かべの向こうが見えない" /></label>
        </div>
        <label className="block text-sm font-bold">写真で確認できた特徴{draft.source === 'observed' ? '（必須）' : '（任意）'}<textarea className={`${input} mt-1`} rows={2} maxLength={240} value={draft.evidence} onChange={event => change({ evidence: event.target.value })} placeholder="例：曲がり角に高いかべが写っている" /></label>
        <label className="block text-sm font-bold">どんな危険を考える？<textarea className={`${input} mt-1`} rows={3} maxLength={240} value={draft.detail} onChange={event => change({ detail: event.target.value })} placeholder="例：かげから自転車が出てくるかもしれない" /></label>
        <p className="text-xs text-slate-600">「写真で確認」は作成者の確認です。車の接近など、写真で分からない出来事は想定として書きます。</p>
        <div className="grid gap-4 sm:grid-cols-2">{(['x', 'y'] as const).map(axis => <label key={axis} className="text-sm">目印の{axis === 'x' ? '左右' : '上下'}位置 {Math.round(draft.point[axis] * 100)}%<input type="range" min={0} max={100} step={1} className="block min-h-11 w-full accent-teal-700" value={draft.point[axis] * 100} onChange={event => change({ point: { ...draft.point, [axis]: Number(event.target.value) / 100 } })} /></label>)}</div>
        <div className="flex flex-wrap gap-3"><button type="button" className={button} onClick={commitDraft}>メモを一覧に反映</button><button type="button" className={button} onClick={() => { setDraft(null); setError('') }}>このメモの変更をやめる</button></div>
      </div>}
      <ul className="space-y-2">{items.map((note, index) => <li key={note.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-3"><span className="text-sm">{index + 1}. {note.title}（写真{note.photoIndex + 1}）</span><SourceLabel source={note.source} /><button type="button" className={button} disabled={!!draft} onClick={() => { setDraft(note); setPhotoIndex(note.photoIndex); setError('') }}>{note.title}を編集</button><button type="button" className={`${button} !border-red-200 !text-red-800`} disabled={!!draft} onClick={() => setItems(current => current.filter(item => item.id !== note.id))}>{note.title}を削除</button></li>)}</ul>
      <p className="text-sm leading-6 text-slate-600">変更を保存すると学校への公開を一度止め、コースの確認をやり直します。更新前のクリアは、この版のクリアには引き継ぎません。</p>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="button" disabled={!!draft} className={`${button} !bg-teal-800 !text-white`} onClick={() => void save()}>{busy ? '保存中…' : 'コースに保存する'}</button><button type="button" className={button} onClick={onCancel}>変更を破棄して戻る</button></div>
    </fieldset>
  </section>
}

export function SceneNotesLearning({ courseId, sceneId, notes = EMPTY_NOTES, scenario, schoolYear, reviewedIds, onReview }: {
  courseId: string; sceneId: string; notes?: readonly SceneNote[]; scenario: RouteScenario; schoolYear: number
  reviewedIds: readonly string[]; onReview: (id: string) => void
}) {
  const relevant = notesForScenario(notes, scenario)
  const [activeId, setActiveId] = useState(relevant[0]?.id ?? '')
  const [speechError, setSpeechError] = useState('')
  const spoken = useRef(false)
  const detailRef = useRef<HTMLDivElement>(null)
  const note = relevant.find(item => item.id === activeId) ?? relevant[0]
  const young = schoolYear <= 3
  useEffect(() => () => { if (spoken.current && 'speechSynthesis' in window) window.speechSynthesis.cancel() }, [])
  function copy(text: string) { return young ? <RubyText text={text} /> : text }
  function select(id: string) { setActiveId(id); setSpeechError(''); if (spoken.current && 'speechSynthesis' in window) window.speechSynthesis.cancel(); detailRef.current?.focus() }
  function speak() {
    if (!note) return
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { setSpeechError('このブラウザーでは読み上げを使えません。'); return }
    window.speechSynthesis.cancel(); spoken.current = true; setSpeechError('')
    const utterance = new SpeechSynthesisUtterance(`${NOTE_SOURCES[note.source]}。${note.title}。写真で確認した特徴。${note.evidence || '記入されていません'}。考える危険。${note.detail}`)
    utterance.lang = 'ja-JP'; utterance.rate = young ? 0.8 : 0.95
    utterance.onerror = event => { if (!['interrupted', 'canceled'].includes(event.error)) setSpeechError('読み上げができませんでした。端末の音声設定を確認してください。') }
    window.speechSynthesis.speak(utterance)
  }
  if (!note) return null
  const photoUrl = routePhotoUrl(courseId, sceneId, note.photoIndex)
  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6" aria-label="この通学路の危険メモ">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-bold">{copy('写真の目印を確かめよう')}</h3><span className="text-sm font-bold text-teal-800">{relevant.filter(item => reviewedIds.includes(item.id)).length} / {relevant.length} 確認</span></div>
    <p className="text-sm leading-6 text-slate-600">作成者が写真に付けたメモです。「写真で確認した特徴」と「学習のための想定」を分けて読もう。目印は写真上の位置です。</p>
    <MarkedPhoto key={photoUrl} url={photoUrl} markers={relevant.filter(item => item.photoIndex === note.photoIndex).map(item => ({ id: item.id, point: item.point, label: `${item.title}の目印`, selected: item.id === note.id }))} onSelect={select} />
    <div className="flex flex-wrap gap-2" aria-label="確認するメモを選ぶ">{relevant.map((item, index) => <button type="button" key={item.id} aria-pressed={item.id === note.id} className={`${button} ${item.id === note.id ? '!bg-teal-50' : ''}`} onClick={() => select(item.id)}>{reviewedIds.includes(item.id) && <Check size={14} className="mr-1 inline" />}{index + 1}. {copy(item.title)}</button>)}</div>
    <div ref={detailRef} tabIndex={-1} className="space-y-3 rounded-xl bg-slate-50 p-4 outline-none">
      <div className="flex flex-wrap items-center justify-between gap-3"><SourceLabel source={note.source} /><button type="button" className={button} onClick={speak}><Volume2 size={16} className="mr-1 inline" />メモを読み上げ</button></div>
      <h4 className="text-lg font-bold">{copy(note.title)}</h4>
      {note.evidence && <p className="whitespace-pre-wrap text-sm leading-7"><strong>写真で確認した特徴：</strong>{copy(note.evidence)}</p>}
      <p className="whitespace-pre-wrap leading-8"><strong>考える危険：</strong>{copy(note.detail)}</p>
      {speechError && <p role="status" className="text-sm text-amber-900">{speechError}</p>}
      <button type="button" className={`${button} !bg-teal-800 !text-white`} disabled={reviewedIds.includes(note.id)} onClick={() => onReview(note.id)}>{reviewedIds.includes(note.id) ? 'このメモを確認しました' : 'この危険のメモを確認した'}</button>
    </div>
  </section>
}
