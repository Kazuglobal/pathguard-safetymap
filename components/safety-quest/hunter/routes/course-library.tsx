'use client'
import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'
import type { CourseView } from '@/lib/hunter/routes/types'
import type { RouteAttempt, RouteScenario } from '@/lib/hunter/routes/curriculum'
import type { SceneNote } from '@/lib/hunter/routes/notes'
import { SceneNotesEditor } from './scene-notes'
import { routeRequest } from './route-request'
export { routeRequest } from './route-request'
const PhotoQuizPlayer = dynamic(() => import('./photo-quiz-player').then(module => module.PhotoQuizPlayer), { loading: () => <p className="p-6">写真クイズを読み込み中…</p> })
const PhotoQuizEditor = dynamic(() => import('./photo-quiz-editor').then(module => module.PhotoQuizEditor), { loading: () => <p className="p-6">問題の編集画面を読み込み中…</p> })
const ScenePlayer = dynamic(() => import('./scene-player').then(module => module.ScenePlayer), { ssr: false, loading: () => <p className="p-6">3Dプレイヤーを読み込み中…</p> })
const btn = 'min-h-11 rounded-xl border border-teal-700 bg-white px-4 py-2 text-sm font-bold text-teal-900 disabled:opacity-40'
type Progress = { sceneId: string; scenario: string; cleared: boolean }
export function CourseLibrary({ refreshKey = 0 }: { refreshKey?: number }) {
  const [courses, setCourses] = useState<CourseView[]>([])
  const [active, setActive] = useState<CourseView | null>(null)
  const [sceneId, setSceneId] = useState('')
  const [progress, setProgress] = useState<Progress[]>([])
  const [scenario, setScenario] = useState<RouteScenario>('normal')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [pollAttempt, setPollAttempt] = useState(0)
  const [editingSceneId, setEditingSceneId] = useState('')
  const [quizMode, setQuizMode] = useState<'play' | 'edit' | null>(null)
  const refresh = useCallback(async () => {
    try { const data = await routeRequest('/api/hunter/routes'); setCourses(data.courses); setError('') }
    catch (err) { setError(err instanceof Error ? err.message : '一覧を取得できません。') }
  }, [])
  useEffect(() => { void refresh() }, [refresh, refreshKey])
  async function open(id: string) {
    setBusy(true); setError(''); setNotice(''); setQuizMode(null)
    try { const data = await routeRequest(`/api/hunter/routes/${id}`); setActive(data.course); setProgress(data.progress); setSceneId(data.course.scenes[0]?.id ?? ''); setScenario('normal') }
    catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  async function action(actionName: string, targetSceneId?: string) {
    if (!active) return
    setBusy(true); setError('')
    try {
      const data = await routeRequest(`/api/hunter/routes/${active.id}`, { action: actionName, sceneId: targetSceneId, revision: active.revision })
      setActive(data.course); setProgress(data.progress); await refresh()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  useEffect(() => {
    if (editingSceneId || !active?.canEdit || !active.scenes.some(scene => scene.status === 'running')) return
    let cancelled = false
    const timer = setTimeout(async () => {
      if (busy) return
      try {
        const data = await routeRequest(`/api/hunter/routes/${active.id}`, { action: 'sync' })
        if (!cancelled) { setActive(data.course); setProgress(data.progress) }
      } catch (err) { if (!cancelled) setError((err as Error).message) }
      finally { if (!cancelled) setPollAttempt(value => value + 1) }
    }, 15_000)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [active, busy, pollAttempt, editingSceneId])
  const locked = busy || !!editingSceneId || !!quizMode
  const generating = active?.scenes.some(scene => scene.status === 'submitting' || scene.status === 'running')
  const editingScene = active?.scenes.find(scene => scene.id === editingSceneId)
  const currentScene = active?.scenes.find(scene => scene.id === sceneId)
  const normalCleared = !!active?.scenes.length && active.scenes.every(scene => progress.some(item => item.sceneId === scene.id && item.scenario === 'normal' && item.cleared))
  async function complete(attempt: RouteAttempt) {
    if (!active || busy) throw new Error('処理が終わってから、もう一度保存してください。')
    setBusy(true); setError('')
    try {
      const data = await routeRequest(`/api/hunter/routes/${active.id}/progress`, { ...attempt, revision: active.revision, sceneId })
      setProgress(data.progress); setNotice(data.result.cleared ? 'ステージクリア！ 学習記録を保存しました。' : '記録を保存しました。もう一度考えてみよう。')
    } catch (err) { setError((err as Error).message); throw err } finally { setBusy(false) }
  }
  async function saveNotes(notes: SceneNote[]) {
    if (!active || !editingSceneId || busy) throw new Error('コースを読み直してください。')
    setBusy(true)
    try {
      const data = await routeRequest(`/api/hunter/routes/${active.id}/notes`, { revision: active.revision, sceneId: editingSceneId, notes })
      setActive(data.course); setProgress(data.progress); setEditingSceneId(''); setError('')
      setNotice(data.course.revision === active.revision ? '危険のメモに変更はありません。' : '危険のメモを保存しました。公開する前に、もう一度コースを確認してください。')
      await refresh()
    } finally { setBusy(false) }
  }
  return <section className="mb-8 rounded-2xl bg-white p-5" aria-label="保存したコース">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">自分と学校のコース</h2><button className={btn} disabled={locked} onClick={refresh}>一覧を更新</button></div>
    {error && <p role="alert" className="my-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {courses.length === 0 && !error && <p className="my-4 text-sm text-slate-600">まだコースはありません。下の写真から作成できます。</p>}
    <div className="my-4 grid gap-3 sm:grid-cols-2">{courses.map(course => <button disabled={locked} key={course.id} onClick={() => open(course.id)} className="min-h-24 rounded-xl border-2 border-slate-200 p-4 text-left hover:border-teal-600 disabled:opacity-50"><strong className="block text-lg">{course.title}</strong><span className="text-base text-slate-600">{course.scenes.length}地点 · {course.learningMode === 'photo-quiz-v1' ? course.status === 'ready' ? '写真クイズで遊べます' : '問題を作成しよう' : course.status === 'ready' ? '保存済み3D' : '保存した写真'} · {course.published ? '学校に公開中' : '下書き'}</span></button>)}</div>
    {active && <div className="border-t pt-5">
      <div className="flex items-center justify-between"><h3 className="text-lg font-bold">{active.title}</h3><button disabled={locked} className={btn} onClick={() => setActive(null)}>閉じる</button></div>
      {active.learningMode === 'photo-quiz-v1' ? <div className="my-5 space-y-4"><p className="text-lg leading-8">写真から気になる場所を探し、理由と安全な行動を考えよう。1回に3か所まで、続きはいつでも遊べます。</p><div className="flex flex-wrap gap-3">{active.status === 'ready' && <button disabled={locked} className={cn(btn, 'min-h-14 bg-teal-800 text-lg text-white')} onClick={() => setQuizMode('play')}>写真クイズで遊ぶ</button>}{active.canEdit && <button disabled={locked} className={`${btn} min-h-14 text-lg`} onClick={() => setQuizMode('edit')}>写真から問題をつくる・直す</button>}</div></div> : <div className="my-4 space-y-3"><p className="text-base text-slate-600">保存済みの3Dや写真を確認できます。この写真を使って、写真クイズ用の下書きも作成できます。</p>{active.canEdit && <button disabled={locked || generating} className={btn} onClick={() => action('copy-photo-quiz')}>写真クイズ用の下書きを作る</button>}</div>}
      {quizMode === 'play' && <PhotoQuizPlayer key={`${active.id}:${active.revision}`} courseId={active.id} onClose={() => setQuizMode(null)} />}
      {quizMode === 'edit' && <PhotoQuizEditor key={active.id} course={active} onClose={() => setQuizMode(null)} onSaved={course => { setActive(course); setQuizMode(null); setNotice('問題を保存しました。「写真クイズで遊ぶ」から内容を確認できます。'); void refresh() }} />}
      {!quizMode && active.learningMode !== 'photo-quiz-v1' && <>
      <div className="my-4 space-y-2">{active.scenes.map((scene, index) => <div key={scene.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3"><strong>{index + 1}. {scene.name}</strong><span className="text-sm">{({ queued: '生成待ち', submitting: '依頼処理中', running: '生成中', ready: '完成', failed: '失敗', unknown: '結果確認が必要' })[scene.status]}</span>{scene.error && <p className="w-full text-sm text-red-700">{scene.error}</p>}{scene.status === 'ready' && <button disabled={locked} className={btn} onClick={() => { setSceneId(scene.id); setNotice('') }}>この地点を見る</button>}{active.canEdit && scene.photoCount > 0 && <button disabled={locked || generating} className={btn} onClick={() => { setEditingSceneId(scene.id); setNotice('') }}>写真・危険メモを確認する</button>}</div>)}</div>
      {active.canEdit && generating && <button disabled={locked} className={btn} onClick={() => action('sync')}>以前の生成状況を確認</button>}
      {editingScene && <SceneNotesEditor key={`${active.id}:${editingScene.id}:${active.revision}`} courseId={active.id} sceneId={editingScene.id} photoCount={editingScene.photoCount} notes={editingScene.notes} onSave={saveNotes} onCancel={() => setEditingSceneId('')} />}
      {!editingScene && currentScene?.splatUrl && <div className="mt-5">
        <label className="font-bold">場面 <select disabled={locked} className="min-h-11 rounded-lg border px-3" value={scenario} onChange={event => { setScenario(event.target.value as RouteScenario); setNotice('') }}><option value="normal">いつもの道</option><option value="rain" disabled={!normalCleared}>雨の日</option><option value="evening" disabled={!normalCleared}>夕方</option><option value="earthquake" disabled={!normalCleared}>地震</option></select></label>
        {!normalCleared && <p className="mt-2 text-sm text-slate-600">すべての地点の「いつもの道」をクリアすると、他の場面が開きます。</p>}
        <ScenePlayer key={`${active.id}:${active.revision}:${sceneId}:${scenario}`} splatUrl={currentScene.splatUrl} scale={currentScene.scale} groundOffset={currentScene.groundOffset} schoolYear={active.learnerSchoolYear ?? active.schoolYear} scenario={scenario} normalCleared={normalCleared} noteContext={{ courseId: active.id, sceneId, notes: currentScene.notes }} onComplete={complete} />
      </div>}
      </>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-emerald-100 p-4 font-bold">{notice}</p>}
      {active.canEdit && active.status === 'ready' && <div className="mt-5 flex flex-wrap gap-3 border-t pt-4">{!active.reviewed ? <button disabled={locked} className={btn} onClick={() => action('review')}>全地点の風景・ぼかし・危険メモを確認しました</button> : <button disabled={locked} className={btn} onClick={() => action(active.published ? 'unpublish' : 'publish')}>{active.published ? '学校への公開をやめる' : '学校に公開する'}</button>}</div>}
    </div>}
  </section>
}
