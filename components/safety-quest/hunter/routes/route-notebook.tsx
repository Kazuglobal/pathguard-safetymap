'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, ArrowRight, Camera, Check, FileText, ImageOff, RefreshCw } from 'lucide-react'
import type { CourseView } from '@/lib/hunter/routes/types'
import type { PhotoQuizOutline, PhotoQuizScenario } from '@/lib/hunter/routes/photo-quiz-schema'
import { routePhotoUrl } from '@/lib/hunter/routes/notes'
import { routeRequest } from './route-request'
import { SchoolPanel } from './school-panel'
const Player = dynamic(() => import('./photo-quiz-player').then(m => m.PhotoQuizPlayer))
const Editor = dynamic(() => import('./photo-quiz-editor').then(m => m.PhotoQuizEditor))
const Checklist = dynamic(() => import('./quiz-checklist').then(m => m.QuizChecklist))
const LegacyLibrary = dynamic(() => import('./course-library').then(m => m.CourseLibrary))
const scenes: Record<PhotoQuizScenario, string> = { normal: 'いつもの道', rain: '雨の日', evening: '夕方', earthquake: '地震が起きたら' }
export const NotebookLupe = () => <img className="notebook-lupe" src="/images/hunter/route-lupe.png" alt="" width="64" height="64" />
export function NotebookPhoto({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return src && !failed ? <img className="notebook-photo" src={src} alt={alt} onError={() => setFailed(true)} /> : <div className="notebook-photo notebook-photo-empty" role="img" aria-label="写真を表示できません"><ImageOff size={32} /></div>
}

export function RouteNotebook({ refreshKey, onCreate, request = routeRequest, photoSource = routePhotoUrl }: { refreshKey: number; onCreate: () => void; request?: typeof routeRequest; photoSource?: typeof routePhotoUrl }) {
  const [courses, setCourses] = useState<CourseView[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'own' | 'school'>('own')
  const [active, setActive] = useState<CourseView | null>(null)
  const [outline, setOutline] = useState<PhotoQuizOutline | null>(null)
  const [mode, setMode] = useState<'path' | 'play' | 'edit' | 'print'>('path')
  const [scenario, setScenario] = useState<PhotoQuizScenario>('normal')
  const [printHint, setPrintHint] = useState(false)
  const [legacy, setLegacy] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const lock = useRef(false)
  const refresh = useCallback(async () => {
    setLoading(true)
    try { const data = await request('/api/hunter/routes'); setCourses(data.courses); setError('') }
    catch (err) { setError((err as Error).message) } finally { setLoading(false) }
  }, [request])
  useEffect(() => { void refresh() }, [refresh, refreshKey])
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }) }, [active?.id, mode])
  async function open(course: CourseView) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const data = await request(`/api/hunter/routes/${course.id}`)
      const detail = await request(`/api/hunter/routes/${course.id}/quiz`)
      setActive(data.course); setOutline(detail.outline); setScenario('normal'); setMode('path')
    } catch (err) { setError((err as Error).message) } finally { lock.current = false; setBusy(false) }
  }
  async function refreshOutline() {
    setMode('path')
    if (!active) return
    setBusy(true); setOutline(null)
    try { setOutline((await request(`/api/hunter/routes/${active.id}/quiz`)).outline) }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function publish(action: 'review' | 'publish' | 'unpublish') {
    if (!active || lock.current) return
    lock.current = true; setBusy(true); setError('')
    try { setActive((await request(`/api/hunter/routes/${active.id}`, { action, revision: active.revision })).course); void refresh() }
    catch (err) { setError((err as Error).message) } finally { lock.current = false; setBusy(false) }
  }
  const visible = courses.filter(course => course.learningMode === 'photo-quiz-v1' && (tab === 'own' ? (course.ownedByMe ?? course.canEdit) : course.published))
  const schoolDrafts = courses.filter(course => course.learningMode === 'photo-quiz-v1' && course.canEdit && course.ownedByMe === false && !course.published)
  const items = outline?.items.filter(item => item.scenario === scenario) ?? []
  const current = items.find(item => !item.cleared)?.id
  const normal = outline?.items.filter(item => item.scenario === 'normal') ?? []
  const unlocked = normal.length > 0 && normal.every(item => item.cleared)
  if (legacy) return <><button className="notebook-link" onClick={() => setLegacy(false)}><ArrowLeft size={20} />通学路ノート</button><LegacyLibrary refreshKey={refreshKey} /></>
  return <>
    <header className="notebook-top">{active ? <button className="notebook-link" disabled={busy} onClick={() => { setActive(null); setOutline(null); setMode('path'); setError('') }}><ArrowLeft size={22} />通学路ノート</button> : <Link className="notebook-brand" href="/safety-quest/hunter"><ArrowLeft size={20} />きけんハンター</Link>}<NotebookLupe /></header>
    {error && <div role="alert" className="notebook-status"><p>{error}</p><button className="notebook-link" onClick={() => active ? open(active) : refresh()}>もう一度読み込む</button></div>}
    {active ? <>
      {mode === 'play' ? <Player request={request} autoStart courseId={active.id} initialScenario={scenario} onClose={() => void refreshOutline()} /> : mode === 'edit' ? <Editor course={active} onClose={() => setMode('path')} onSaved={course => { void open(course); void refresh() }} /> : mode === 'print' && outline?.latestCompleted ? <Checklist session={outline.latestCompleted} onClose={() => setMode('path')} /> : <>
        <h1 ref={heading} tabIndex={-1} className="notebook-title"><span>{active.title}</span></h1>
        <p className="notebook-subtitle">いつもの道を、たしかめよう。</p>
        <label className="block text-base font-bold">学ぶ場面<select className="mt-2 min-h-12 w-full rounded-xl border border-[#ded8c9] bg-white px-4" value={scenario} onChange={event => setScenario(event.target.value as PhotoQuizScenario)}>{Object.entries(scenes).map(([key, label]) => <option key={key} value={key} disabled={key !== 'normal' && (!unlocked || !outline?.items.some(item => item.scenario === key))}>{label}{key !== 'normal' && !unlocked ? '（いつもの道をクリアすると開く）' : ''}</option>)}</select></label>
        {busy && <p role="status" className="notebook-status">学習記録を読み込んでいます…</p>}
        <ol className="notebook-trail" aria-label="コースの道順">{items.map((item, index) => <li key={item.id} className="notebook-stop" data-current={item.id === current} data-cleared={item.cleared}><span className="notebook-number">{item.cleared ? <Check size={23} aria-label="クリア" /> : index + 1}</span><div className="notebook-stop-content"><NotebookPhoto src={item.photoUrl} alt={`${item.title}の写真`} /><div><h3>{item.title}</h3><p className="notebook-meta">{item.cleared ? '理由と行動をたしかめたよ。' : item.id === current ? '次にたしかめる場所' : 'どんなところか、見てみよう。'}</p></div></div></li>)}</ol>
        {!busy && !items.length && <p className="notebook-status">この場面の問題は、まだ準備中です。</p>}
        <button className="notebook-button notebook-button-primary w-full" disabled={busy || !items.length || active.status !== 'ready'} onClick={() => setMode('play')}>{current ? '次の場所へ' : 'もう一度たしかめる'}<ArrowRight size={22} /></button>
        <p className="notebook-meta mt-5 text-center">{items.filter(item => item.cleared).length} / {items.length}か所 たしかめた · 時間制限なし</p>
        {outline?.latestCompleted && <button className="notebook-print-link w-full" onClick={() => setMode('print')}><FileText size={28} /><span><strong>親子チェックシート</strong><span className="notebook-meta">最近の学習を、家でも話そう。</span></span><ArrowRight className="ml-auto shrink-0" size={20} /></button>}
        {active.canEdit && <details className="notebook-settings"><summary>写真・問題の編集</summary><button className="notebook-button" disabled={busy} onClick={() => setMode('edit')}><Camera size={20} />写真から問題をつくる・直す</button>{active.status === 'ready' && <button className="notebook-button" disabled={busy} onClick={() => publish(!active.reviewed ? 'review' : active.published ? 'unpublish' : 'publish')}>{!active.reviewed ? '全地点の写真・ぼかし・問題を確認しました' : active.published ? '学校への公開をやめる' : '学校に公開する（任意）'}</button>}</details>}
      </>}
    </> : <>
      <h1 ref={heading} tabIndex={-1} className="notebook-title">みんなの<br /><span>通学路ノート</span></h1><p className="notebook-subtitle">あそぶ道を、えらぼう。</p>
      <div className="notebook-tabs" role="group" aria-label="コースの表示範囲"><button className="notebook-tab" aria-pressed={tab === 'own'} onClick={() => setTab('own')}>自分のコース</button><button className="notebook-tab" aria-pressed={tab === 'school'} onClick={() => setTab('school')}>学校のコース</button></div>
      {loading ? <p role="status" className="notebook-status">コースを読み込んでいます…</p> : !visible.length && !error ? <div className="notebook-empty"><img src="/images/hunter/onboarding-1.png" alt="親子とルペが、まちへ出かける絵" /><h2 className="text-xl font-black">{tab === 'own' ? 'いつもの道が、クイズになる。' : '学校のみんなと、道を学ぼう。'}</h2><p className="notebook-meta">{tab === 'own' ? '大人と一緒に写真を選んで、最初のコースをつくろう。' : '公開されたコースがここに並びます。学校への参加は下からできます。'}</p></div> : <div aria-label="保存したコース">{visible.map(course => <article key={course.id} className="notebook-course"><div className="notebook-course-row"><NotebookPhoto src={course.scenes[0]?.photoCount ? photoSource(course.id, course.scenes[0].id, 0) : undefined} alt={`${course.title}の写真`} /><div><h2>{course.title}</h2><p className="notebook-meta">{course.scenes.length}地点 · {course.status === 'ready' ? '写真で学ぼう' : '問題を準備中'}</p><p className="notebook-meta">{course.published ? '学校に公開中' : '自分だけの下書き'}</p></div></div><button className="notebook-button notebook-button-primary" disabled={busy} aria-label={`${course.title}のコースを見る`} onClick={() => void open(course)}>コースを見る<ArrowRight size={22} /></button></article>)}</div>}
      <div className="notebook-utilities"><button className="notebook-button" onClick={onCreate}><Camera size={23} />写真からコースをつくる<ArrowRight size={18} /></button><button className="notebook-print-link" onClick={() => setPrintHint(value => !value)} aria-expanded={printHint}><FileText size={32} className="shrink-0 text-[#006b58]" /><span><strong>親子チェックシート</strong><span className="notebook-meta">今日の学びを、家でも話そう。</span></span><ArrowRight size={20} className="ml-auto shrink-0" /></button>{printHint && <p role="status" className="notebook-status">コースを開くと、クリアした学習からチェックシートをつくれます。まずは上のコースを選びましょう。</p>}</div>
      <details className="notebook-settings"><summary>学校で使う場合の設定（任意）</summary><SchoolPanel onJoined={refresh} />{schoolDrafts.length > 0 && <section aria-label="先生が確認する下書き"><h2 className="text-lg font-bold">先生が確認する下書き</h2><p className="notebook-meta">学校への公開前に、写真や問題を確認できます。</p>{schoolDrafts.map(course => <button key={course.id} className="notebook-button mt-3 w-full" disabled={busy} onClick={() => void open(course)}>{course.title}の下書きを確認<ArrowRight size={20} /></button>)}</section>}<button className="notebook-link" disabled={loading} onClick={refresh}><RefreshCw size={18} />一覧を更新</button>{courses.some(course => course.learningMode !== 'photo-quiz-v1') && <button className="notebook-link ml-4" onClick={() => setLegacy(true)}>以前の3Dコースを開く</button>}</details>
    </>}
  </>
}
