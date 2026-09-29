'use client'

import { useEffect, useRef, useState } from 'react'
import type { PhotoQuizAnswer, PhotoQuizScenario, PhotoQuizView } from '@/lib/hunter/routes/photo-quiz-schema'
import { RubyText } from '../ruby-text'
import { routeRequest } from './route-request'
import { ArrowLeft, ArrowRight, Volume2 } from 'lucide-react'
import './route-notebook.css'
import dynamic from 'next/dynamic'
const QuizChecklist = dynamic(() => import('./quiz-checklist').then(module => module.QuizChecklist), { loading: () => <p role="status">チェックシートを準備中…</p> })

const button = 'min-h-14 rounded-xl border-2 border-teal-800 bg-white px-5 py-3 text-lg font-bold text-teal-950 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:opacity-40'
const primary = 'notebook-button notebook-button-primary'
const scenarios: Record<PhotoQuizScenario, string> = { normal: 'いつもの道', rain: '雨の日', evening: '夕方', earthquake: '地震が起きたら' }

export function PhotoQuizPlayer({ courseId, onClose, initialScenario = 'normal', autoStart = false, request = routeRequest }: { courseId: string; onClose: () => void; initialScenario?: PhotoQuizScenario; autoStart?: boolean; request?: typeof routeRequest }) {
  const [intro, setIntro] = useState(autoStart)
  const [session, setSession] = useState<PhotoQuizView | null>(null)
  const [scenario, setScenario] = useState<PhotoQuizScenario>(initialScenario)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null)
  const [imageResult, setImageResult] = useState<{ key: string; status: 'ready' | 'error' } | null>(null)
  const [imageRetry, setImageRetry] = useState(0)
  const imageKey = `${session?.item?.photoUrl ?? ''}:${imageRetry}`
  const imageState = imageResult?.key === imageKey ? imageResult.status : 'loading'
  const [showChecklist, setShowChecklist] = useState(false)
  const pending = useRef<PhotoQuizAnswer | null>(null)
  const lock = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const [speechAvailable, setSpeechAvailable] = useState(false)
  useEffect(() => { setSpeechAvailable('speechSynthesis' in window); return () => { window.speechSynthesis?.cancel() } }, [])
  useEffect(() => {
    setSelected(''); setPoint(null); setShowChecklist(false); heading.current?.focus()
    window.speechSynthesis?.cancel()
  }, [session?.stage, session?.index])
  useEffect(() => { if (autoStart) void start() }, [])
  const label = intro && session?.stage === 'find' ? '写真をよく見よう。' : session?.stage === 'find' ? '気になる場所をさがそう' : session?.stage === 'feedback' ? '安全な行動をたしかめよう' : session?.stage === 'complete' ? '今日の学習、クリア！' : session?.question?.prompt ?? '写真で通学路を学ぼう'
  const text = (value: string) => session && session.schoolYear <= 2 ? <RubyText text={value} /> : value
  function readAloud() {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance([
      label,
      session?.stage === 'find' ? '写真で気になる場所を選んで、この場所をたしかめるボタンを押そう。' : undefined,
      session?.item?.observed ? `写真でたしかめること。${session.item.observed}` : undefined,
      session?.item && session.stage !== 'find' ? `もし、こんなことが起きたら。${session.item.hypothetical}` : undefined,
      session?.feedback?.text,
      ...(session?.question?.choices.map((choice, index) => `${index + 1}番。${choice.text}`) ?? []),
      ...(session?.stage === 'complete' ? session.learned.map(item => `${item.title}。${item.action}`) : []),
    ].filter(Boolean).join('。'))
    utterance.lang = 'ja-JP'; utterance.rate = session && session.schoolYear <= 2 ? 0.85 : 1
    window.speechSynthesis.speak(utterance)
  }
  async function start() {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { const data = await request(`/api/hunter/routes/${courseId}/quiz`, { scenario }); pending.current = null; setSession(data.session) }
    catch (err) { setError((err as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  async function answer(value?: Omit<PhotoQuizAnswer, 'requestId' | 'version'>) {
    if (!session || lock.current) return
    const payload = pending.current ?? (value ? { ...value, requestId: crypto.randomUUID(), version: session.version } : null)
    if (!payload) return
    pending.current = payload; lock.current = true; setBusy(true); setError('')
    try {
      const data = await request(`/api/hunter/routes/${courseId}/quiz/${session.id}/answers`, payload)
      pending.current = null; setSession(data.session); setSelected(''); setPoint(null)
    } catch (err) { setError((err as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  async function resume() {
    if (!session || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { const data = await request(`/api/hunter/routes/${courseId}/quiz/${session.id}`); pending.current = null; setSession(data.session); setSelected(''); setPoint(null) }
    catch (err) { setError((err as Error).message) }
    finally { lock.current = false; setBusy(false) }
  }
  const disabled = busy || !!pending.current
  const region = session?.item?.region
  if (session?.stage === 'complete' && showChecklist) return <QuizChecklist session={session} onClose={() => setShowChecklist(false)} />
  return <section className="quiz-adventure mx-auto max-w-3xl space-y-5" aria-label="写真クイズ" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-bold text-teal-800">通学路 3分クイズ{session && ` · ${scenarios[session.scenario]}`}</p><button className="notebook-link" disabled={busy} onClick={onClose}><ArrowLeft size={20} />コースの道順</button></div>
    {session && session.stage !== 'complete' && !(intro && session.stage === 'find') && <div><p className="mb-2 text-lg font-bold">場所 {session.index + 1} / {session.total}　·　{({ find: '① さがす', reason: '② 理由を考える', action: '③ 行動を選ぶ', feedback: '④ たしかめる' })[session.stage]}</p><progress className="h-3 w-full accent-teal-700" value={session.index} max={session.total} aria-label="たしかめた場所" /></div>}
    <div className="flex flex-wrap items-start justify-between gap-3"><h3 ref={heading} aria-label={label} tabIndex={-1} className="scroll-mt-24 text-2xl font-extrabold leading-relaxed outline-none sm:text-3xl">{text(label)}</h3>{speechAvailable && <button className="notebook-button" onClick={readAloud}><Volume2 size={22} />読み上げる</button>}</div>
    {error && <div role="alert" className="space-y-3 rounded-xl border-2 border-red-700 bg-red-50 p-4 text-lg text-red-950"><p>{error}</p>{session && <div className="flex flex-wrap gap-3">{pending.current && <button className={button} disabled={busy} onClick={() => answer()}>同じ回答をもう一度送る</button>}<button className={button} disabled={busy} onClick={resume}>保存した続きを読み直す</button><button className={button} disabled={busy} onClick={() => { pending.current = null; if (autoStart) { onClose(); return } setSession(null); setError('') }}>コースを選び直す</button></div>}</div>}
    {!session && !autoStart && <div className="space-y-5"><p className="text-lg leading-8">写真で気になる場所を見つけて、理由と安全な行動を考えよう。1回に3か所まで。時間制限はありません。</p><label className="block text-lg font-bold">学ぶ場面<select className="mt-2 min-h-14 w-full rounded-xl border-2 border-slate-400 bg-white px-4" value={scenario} onChange={event => setScenario(event.target.value as PhotoQuizScenario)} disabled={busy}>{Object.entries(scenarios).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label><p className="text-base leading-7">「いつもの道」の全地点をクリアすると、作成済みのほかの場面も遊べます。</p><button className={`${primary} w-full`} disabled={busy} onClick={start}>{busy ? '学習記録を読み込み中…' : 'はじめる・続きから遊ぶ'}</button></div>}
    {!session && autoStart && <p role="status" className="notebook-status">{error ? <button className="notebook-button" disabled={busy} onClick={start}>もう一度はじめる</button> : '学習記録と写真を準備しています…'}</p>}
    {session?.item && <>
      <div className="quiz-photo relative overflow-hidden rounded-xl bg-slate-100">
        {/* Keep the image's native aspect ratio so points match the saved photo coordinates. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={imageKey} src={session.item.photoUrl} alt="気になる場所をたしかめる通学路の写真" draggable={false} className={`block h-auto w-full ${session.stage === 'find' && !intro ? 'cursor-crosshair' : ''}`} onLoad={() => setImageResult({ key: imageKey, status: 'ready' })} onError={() => setImageResult({ key: imageKey, status: 'error' })} onClick={event => {
          if (intro || session.stage !== 'find' || disabled || imageState !== 'ready') return
          const bounds = event.currentTarget.getBoundingClientRect()
          setPoint({ x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) })
        }} />
        {imageState === 'ready' && region && <div aria-hidden="true" className="pointer-events-none absolute border-4 border-amber-500 bg-amber-300/20" style={{ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />}
        {imageState === 'ready' && point && <span aria-hidden="true" className="pointer-events-none absolute grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-white bg-teal-800 text-xl font-bold text-white shadow" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}>＋</span>}
      </div>
      {imageState !== 'ready' && <div role="status" className="rounded-xl bg-slate-100 p-4 text-lg">{imageState === 'error' ? <><p>写真を読み込めませんでした。</p><button className={button} onClick={() => setImageRetry(value => value + 1)}>写真を読み直す</button></> : '写真を読み込み中…'}</div>}
      {session.stage === 'find' && !intro && <div className="space-y-4"><p className="text-lg leading-8">{text('写真をタップしてから「この場所をたしかめる」を押そう。')}</p><details className="rounded-xl border p-4"><summary className="min-h-11 cursor-pointer text-lg font-bold">タップの代わりに位置を選ぶ</summary>{(['x', 'y'] as const).map(axis => <label key={axis} className="mt-4 block text-lg">{axis === 'x' ? '左から右' : '上から下'}：{Math.round((point?.[axis] ?? 0.5) * 100)}%<input type="range" min="0" max="100" step="1" disabled={disabled || imageState !== 'ready'} value={Math.round((point?.[axis] ?? 0.5) * 100)} onChange={event => setPoint(value => ({ ...(value ?? { x: 0.5, y: 0.5 }), [axis]: Number(event.target.value) / 100 }))} className="mt-2 h-11 w-full accent-teal-800" /></label>)}<button className={`${button} mt-3`} disabled={disabled || imageState !== 'ready'} onClick={() => setPoint({ x: 0.5, y: 0.5 })}>真ん中を選ぶ</button></details><div className="flex flex-wrap gap-3"><button className={`${primary} grow`} disabled={disabled || !point || imageState !== 'ready'} onClick={() => answer({ kind: 'point', point: point! })}>この場所をたしかめる</button><button className={button} disabled={disabled || imageState !== 'ready'} onClick={() => answer({ kind: 'hint' })}>ヒントを見る</button></div></div>}
      {intro && session.stage === 'find' && <div className="space-y-5"><p className="text-lg leading-8">写真の中で、気になる場所はあるかな？</p><div className="flex items-center gap-3"><img src="/images/hunter/route-lupe.png" className="notebook-lupe" alt="" /><p className="notebook-status grow">よく見て、さがしてみよう！</p></div><button className={`${primary} w-full`} disabled={imageState !== 'ready' || busy} onClick={() => setIntro(false)}>この写真でクイズをはじめる<ArrowRight size={20} /></button></div>}
      {session.item.observed && <div className="rounded-xl border-l-4 border-sky-700 bg-sky-50 p-4 text-lg leading-8"><strong className="block">写真でたしかめること</strong>{text(session.item.observed)}</div>}
      {session.stage !== 'find' && <div className="rounded-xl border-l-4 border-amber-700 bg-amber-50 p-4 text-lg leading-8"><strong className="block">もし、こんなことが起きたら</strong>{text(session.item.hypothetical)}</div>}
    </>}
    {session?.feedback && <p role="status" className={`rounded-xl border-2 p-4 text-xl font-bold leading-9 ${session.feedback.correct ? 'border-teal-700 bg-teal-50' : 'border-amber-700 bg-amber-50'}`}>{text(session.feedback.text)}</p>}
    {session?.question && <fieldset className="space-y-3" disabled={disabled}><legend className="mb-3 text-lg">{text('ひとつ選んで、答えをたしかめよう。')}</legend>{session.question.choices.map((choice, index) => <label key={choice.id} className={`flex min-h-16 cursor-pointer items-start gap-3 rounded-xl border-2 p-4 text-xl leading-9 ${selected === choice.id ? 'border-teal-800 bg-teal-50' : 'border-slate-300 bg-white'}`}><input className="mt-2 h-5 w-5 shrink-0 accent-teal-800" type="radio" aria-label={`${index + 1}. ${choice.text}`} name={`quiz-${session.id}`} value={choice.id} checked={selected === choice.id} onChange={() => setSelected(choice.id)} /><span>{index + 1}. {text(choice.text)}</span></label>)}<button className={`${primary} w-full`} disabled={disabled || !selected} onClick={() => answer({ kind: 'choice', choiceId: selected })}>答えをたしかめる</button></fieldset>}
    {session?.stage === 'feedback' && <button className={`${primary} w-full`} disabled={disabled} onClick={() => answer({ kind: 'next' })}>{session.index + 1 === session.total ? '今日のふりかえりを見る' : '次の場所へ'}</button>}
    {session?.stage === 'complete' && <div className="space-y-4"><p className="text-lg leading-8">{text('見つけた理由と、安全な行動をたしかめられたね。学習記録を保存しました。')}</p><ol className="space-y-3">{session.learned.map((item, index) => <li key={item.id} className="rounded-xl bg-teal-50 p-5 text-lg leading-8"><strong className="mb-2 block text-xl">{index + 1}. {text(item.title)}</strong>{text(item.action)}</li>)}</ol><button className={`${primary} w-full`} disabled={busy} onClick={() => { if (autoStart) { onClose(); return } setSession(null); setError('') }}>続きの場所・ほかの場面を学ぶ</button></div>}
    {session?.stage === 'complete' && <button className={`${button} w-full`} onClick={() => setShowChecklist(true)}>今日の親子チェックシートをつくる</button>}
  </section>
}
