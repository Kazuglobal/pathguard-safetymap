'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Eye, Flag, RotateCcw, Volume2 } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import * as THREE from 'three'
import { RubyText } from '../ruby-text'
import { SceneNotesLearning } from './scene-notes'
import { evaluateReviewedNotes, type SceneNote } from '@/lib/hunter/routes/notes'
import {
  evaluateRouteAttempt, getScenarioCurriculum, ROUTE_SCENARIOS,
  type RouteAnswer, type RouteAttempt, type RouteHazard, type RouteQuestionKind, type RouteScenario,
} from '@/lib/hunter/routes/curriculum'

export type { RouteAnswer, RouteAttempt, RouteScenario }
export type ScenePlayerResult = RouteAttempt
export type ScenePlayerProps = {
  splatUrl: string
  scale?: number
  groundOffset?: number
  schoolYear: number
  scenario?: RouteScenario
  normalCleared?: boolean
  /** Calibrated scene-space rail, when available. The default is a short virtual viewing rail. */
  rail?: readonly [number, number, number][]
  noteContext?: { courseId: string; sceneId: string; notes: readonly SceneNote[] }
  onComplete: (result: ScenePlayerResult) => void | Promise<void>
}

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:cursor-not-allowed disabled:opacity-40'
const primary = `${button} !border-teal-800 !bg-teal-800 !text-white hover:!bg-teal-900`
const DEFAULT_RAIL: readonly [number, number, number][] = [[0, 0, 0], [0, 0, -0.75], [0, 0, -1.5], [0, 0, -2.25]]
const QUESTION_KINDS: readonly RouteQuestionKind[] = ['prediction', 'reason', 'action']
const QUESTION_LABELS = { prediction: '1 次を予測する', reason: '2 理由を考える', action: '3 安全な行動を選ぶ' }

type ViewState = { position: number; yaw: number; pitch: number }
type SceneStatus = 'loading' | 'ready' | 'error' | 'unsupported'

/** Render actual SPZ Gaussian splats, never a substitute panorama or procedural street. */
function SplatView({ splatUrl, scale = 1, groundOffset, rail = DEFAULT_RAIL }: Pick<ScenePlayerProps, 'splatUrl' | 'scale' | 'groundOffset' | 'rail'>) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<ViewState>({ position: 0, yaw: 0, pitch: 0 })
  const drag = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const [position, setPosition] = useState(0)
  const [status, setStatus] = useState<SceneStatus>('loading')
  const [progress, setProgress] = useState<number | null>(null)
  const [retry, setRetry] = useState(0)
  const reducedMotion = useReducedMotion()
  const points = useMemo(() => {
    const selected = rail.length >= 2 && rail.every(point => point.length === 3 && point.every(Number.isFinite)) ? rail : DEFAULT_RAIL
    // When metric ground alignment is available, use a child's eye height.
    return selected === DEFAULT_RAIL && Number.isFinite(groundOffset) ? selected.map(([x, , z]) => [x, 1.3, z] as [number, number, number]) : selected
  }, [rail, groundOffset])

  useEffect(() => {
    const container = host.current
    if (!container) return
    let cancelled = false
    let failed = false
    let renderer: THREE.WebGLRenderer | undefined
    let mesh: import('@sparkjsdev/spark').SplatMesh | undefined
    let spark: import('@sparkjsdev/spark').SparkRenderer | undefined
    let resize: ResizeObserver | undefined
    let canvas: HTMLCanvasElement | undefined
    const scene = new THREE.Scene()
    const controller = new AbortController()
    view.current = { position: 0, yaw: 0, pitch: 0 }
    setPosition(0)
    setProgress(null)
    setStatus('loading')
    const onContextLost = (event: Event) => {
      event.preventDefault()
      failed = true
      renderer?.setAnimationLoop(null)
      if (!cancelled) setStatus('error')
    }
    async function initialize() {
      try {
        canvas = document.createElement('canvas')
        const context = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' })
        if (!context) { setStatus('unsupported'); return }
        renderer = new THREE.WebGLRenderer({ canvas, context, antialias: false, alpha: false })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
        renderer.setClearColor('#233d37')
        renderer.domElement.className = 'h-full w-full'
        renderer.domElement.setAttribute('aria-hidden', 'true')
        renderer.domElement.addEventListener('webglcontextlost', onContextLost)
        container.appendChild(renderer.domElement)
        const camera = new THREE.PerspectiveCamera(65, 1, 0.05, 500)
        camera.rotation.order = 'YXZ'
        const cameraPosition = new THREE.Vector3()
        const targetPosition = new THREE.Vector3()
        const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1
        const safeOffset = Number.isFinite(groundOffset) ? groundOffset : 0
        const fit = () => {
          if (!renderer || !container.clientWidth || !container.clientHeight) return
          renderer.setSize(container.clientWidth, container.clientHeight, false)
          camera.aspect = container.clientWidth / container.clientHeight
          camera.updateProjectionMatrix()
        }
        resize = new ResizeObserver(fit)
        resize.observe(container)
        fit()
        const imported = await import('@sparkjsdev/spark')
        if (cancelled) return
        spark = new imported.SparkRenderer({ renderer, lodSplatScale: 0.5 })
        scene.add(spark)
        // Fetch with cancellation first. A same-origin authenticated asset endpoint also works.
        const response = await fetch(splatUrl, { signal: controller.signal, credentials: 'same-origin' })
        if (!response.ok) throw new Error('Scene asset is unavailable')
        const bytes = await response.arrayBuffer()
        if (cancelled) return
        setProgress(100)
        mesh = new imported.SplatMesh({ fileBytes: bytes, lod: true })
        await mesh.initialized
        if (cancelled) { mesh.dispose(); mesh = undefined; return }
        if (mesh.numSplats === 0) throw new Error('Scene asset is empty')
        mesh.scale.setScalar(safeScale)
        // Marble exports OpenCV axes. Rotate after metric ground alignment:
        // R_x(PI) * (scale * point - groundOffset * Y) yields +offset in Three.js Y.
        mesh.rotation.x = Math.PI
        mesh.position.y = safeOffset
        scene.add(mesh)
        const firstPoint = points[0]
        cameraPosition.set(firstPoint[0], firstPoint[1], firstPoint[2])
        camera.position.copy(cameraPosition)
        renderer.setAnimationLoop(() => {
          if (cancelled || failed || document.hidden || !renderer) return
          try {
            const target = points[view.current.position]
            targetPosition.set(target[0], target[1], target[2])
            if (reducedMotion) cameraPosition.copy(targetPosition)
            else cameraPosition.lerp(targetPosition, 0.12)
            camera.position.copy(cameraPosition)
            camera.rotation.set(view.current.pitch, view.current.yaw, 0, 'YXZ')
            renderer.render(scene, camera)
          } catch {
            failed = true
            renderer.setAnimationLoop(null)
            setStatus('error')
          }
        })
        setStatus('ready')
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    void initialize()
    return () => {
      cancelled = true
      controller.abort()
      resize?.disconnect()
      renderer?.setAnimationLoop(null)
      canvas?.removeEventListener('webglcontextlost', onContextLost)
      if (mesh?.isInitialized) mesh.dispose()
      spark?.dispose()
      renderer?.dispose()
      canvas?.remove()
    }
  }, [splatUrl, scale, groundOffset, retry, points, reducedMotion])

  function move(direction: number) {
    view.current.position = Math.max(0, Math.min(points.length - 1, view.current.position + direction))
    setPosition(view.current.position)
  }
  function look(yaw: number, pitch = 0) {
    view.current.yaw += yaw
    view.current.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, view.current.pitch + pitch))
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (status !== 'ready') return
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 's', 'a', 'd', 'Home'].includes(event.key)) return
    event.preventDefault()
    if (event.key === 'ArrowUp' || event.key === 'w') move(1)
    if (event.key === 'ArrowDown' || event.key === 's') move(-1)
    if (event.key === 'ArrowLeft' || event.key === 'a') look(0.15)
    if (event.key === 'ArrowRight' || event.key === 'd') look(-0.15)
    if (event.key === 'Home') reset()
  }
  function reset() { view.current = { position: 0, yaw: 0, pitch: 0 }; setPosition(0) }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return
    look(-(event.clientX - drag.current.x) * 0.004, -(event.clientY - drag.current.y) * 0.004)
    drag.current.x = event.clientX
    drag.current.y = event.clientY
  }

  return <section aria-label="写真から生成した3Dの風景" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="relative h-[min(60vh,520px)] min-h-72 bg-[#233d37]">
      <div ref={host} role="group" aria-label="3Dを見回す。ドラッグ、または矢印キーで操作" aria-describedby="route-view-help" tabIndex={status === 'ready' ? 0 : -1}
        className="h-full w-full touch-none cursor-grab focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-[-4px] focus-visible:outline-emerald-300 active:cursor-grabbing"
        onKeyDown={onKeyDown} onPointerDown={event => {
          if (status !== 'ready' || event.button !== 0) return
          event.currentTarget.focus()
          drag.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
          event.currentTarget.setPointerCapture(event.pointerId)
        }} onPointerMove={onPointerMove} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }} />
      {status === 'loading' && <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white"><Eye size={36} /><p className="font-bold">3Dの風景を読みこんでいます</p><p className="text-sm text-emerald-100">{progress === 100 ? '写真の立体データを準備しています。' : 'コースの大きさにより、少し時間がかかります。'}</p></div>}
      {(status === 'error' || status === 'unsupported') && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white"><Eye size={32} /><p className="text-lg font-bold">{status === 'unsupported' ? 'この端末では3Dを表示できません' : '3Dの風景を読みこめませんでした'}</p><p className="max-w-md text-sm leading-6 text-emerald-100">{status === 'unsupported' ? '別の端末や、WebGL 2に対応したブラウザーで開いてください。下の想定問題は、このまま学べます。' : '通信を確認して、もう一度読みこんでください。下の想定問題は、このまま学べます。'}</p><button type="button" onClick={() => setRetry(value => value + 1)} className={button}><RotateCcw size={18} />もう一度読みこむ</button></div>}
      {status === 'ready' && <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-black/65 px-3 py-2 text-xs font-bold text-white">写真を参考にした3D・補完した風景を含みます</div>}
    </div>
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={status !== 'ready' || position === 0} onClick={() => move(-1)}><ArrowDown size={18} />戻る</button><button type="button" className={primary} disabled={status !== 'ready' || position === points.length - 1} onClick={() => move(1)}><ArrowUp size={18} />進む</button><span className="self-center px-2 text-sm tabular-nums">見学位置 {position + 1} / {points.length}</span></div>
        <div className="flex flex-wrap gap-2"><button type="button" aria-label="左を見る" className={button} disabled={status !== 'ready'} onClick={() => look(0.3)}><ArrowLeft size={18} /></button><button type="button" aria-label="右を見る" className={button} disabled={status !== 'ready'} onClick={() => look(-0.3)}><ArrowRight size={18} /></button><button type="button" className={button} disabled={status !== 'ready'} onClick={reset}><RotateCcw size={16} />最初の向き</button></div>
      </div>
      <p id="route-view-help" className="text-xs leading-5 text-slate-600">指やマウスでドラッグして見回せます。矢印キーの上下で移動、左右で見回せます。{rail === DEFAULT_RAIL && '見学位置は仮の直線です。実際の歩道の位置を示していません。'}</p>
    </div>
  </section>
}

/** Separate, explicitly imagined teaching animation; never overlaid as a located photo hazard. */
function GentleOutcome({ traffic }: { traffic: boolean }) {
  const reducedMotion = useReducedMotion()
  return <svg role="img" aria-label={traffic ? '人が止まって、自転車が通り過ぎるのを確認する想定アニメ' : '一度止まり、周りを確認して安全な方向を選ぶ想定アニメ'} viewBox="0 0 360 110" className="h-28 w-full rounded-xl bg-emerald-50">
    <path d="M20 74H340" stroke="#bccfc8" strokeWidth="32" />
    <path d="M20 74H340" stroke="white" strokeWidth="2" strokeDasharray="10 10" />
    <motion.g initial={reducedMotion ? false : { x: -25 }} animate={{ x: 0 }} transition={{ duration: 1 }}>
      <circle cx="117" cy="31" r="10" fill="#0f766e" /><path d="M117 43V69M117 48L101 58M117 48L130 50M117 69L106 91M117 69L131 90" stroke="#0f766e" strokeWidth="7" strokeLinecap="round" />
    </motion.g>
    <circle cx="154" cy="61" r="15" fill="#fff" stroke="#db791d" strokeWidth="3" /><path d="M146 61H162" stroke="#db791d" strokeWidth="3" />
    {traffic ? <motion.g initial={reducedMotion ? false : { x: 75 }} animate={{ x: 0 }} transition={{ duration: 2, delay: 0.4 }}>
      <circle cx="218" cy="76" r="13" fill="none" stroke="#496278" strokeWidth="3" /><circle cx="260" cy="76" r="13" fill="none" stroke="#496278" strokeWidth="3" /><path d="M218 76L231 54L248 76H218M231 54H252L260 76M250 49H261" fill="none" stroke="#496278" strokeWidth="3" />
    </motion.g> : <><circle cx="252" cy="60" r="22" fill="#d1fae5" /><path d="M240 60L249 69L265 50" fill="none" stroke="#0f766e" strokeWidth="5" strokeLinecap="round" /></>}
  </svg>
}

function Training({ schoolYear, scenario, normalCleared, onComplete, reviewedNoteIds, notesComplete }: Pick<ScenePlayerProps, 'schoolYear' | 'scenario' | 'normalCleared' | 'onComplete'> & { reviewedNoteIds: string[]; notesComplete: boolean }) {
  const lessons = useMemo(() => getScenarioCurriculum(scenario, schoolYear), [scenario, schoolYear])
  const [activeIndex, setActiveIndex] = useState(0)
  const [foundIds, setFoundIds] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<string, RouteAnswer>>({})
  const [mistakes, setMistakes] = useState<RouteAnswer[]>([])
  const [questionIndex, setQuestionIndex] = useState(0)
  const [feedback, setFeedback] = useState<'correct' | 'retry' | null>(null)
  const [completed, setCompleted] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [speechError, setSpeechError] = useState('')
  const feedbackRef = useRef<HTMLDivElement>(null)
  const lesson = lessons[activeIndex]
  const kind = QUESTION_KINDS[questionIndex]
  const found = foundIds.includes(lesson?.id)
  const young = schoolYear <= 3
  const currentAnswer = answers[lesson?.id]
  const locked = scenario !== 'normal' && !normalCleared
  const isDone = completed.includes(lesson?.id)
  const allDone = completed.length === lessons.length
  const reduceMotion = useReducedMotion()

  useEffect(() => () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel() }, [])
  useEffect(() => { if (feedback) feedbackRef.current?.focus() }, [feedback])
  function Copy({ text }: { text: string }) { return young ? <RubyText text={text} /> : <>{text}</> }
  function readAloud(text: string) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { setSpeechError('このブラウザーでは読み上げを使えません。'); return }
    setSpeechError('')
    window.speechSynthesis.cancel()
    const speech = new SpeechSynthesisUtterance(text)
    speech.lang = 'ja-JP'
    speech.rate = young ? 0.8 : 0.95
    speech.onerror = event => { if (!['interrupted', 'canceled'].includes(event.error)) setSpeechError('読み上げができませんでした。端末の音声設定を確認してください。') }
    window.speechSynthesis.speak(speech)
  }
  function selectLesson(index: number) { setActiveIndex(index); setQuestionIndex(0); setFeedback(null); setSpeechError(''); if ('speechSynthesis' in window) window.speechSynthesis.cancel() }
  function choose(choice: string) {
    setAnswers(old => ({ ...old, [lesson.id]: { hazardId: lesson.id, prediction: '', reason: '', action: '', ...old[lesson.id], [kind]: choice } }))
    setFeedback(null)
  }
  function check() {
    if (!currentAnswer?.[kind]) return
    if (currentAnswer[kind] !== lesson.questions[kind].correctId) {
      setMistakes(previous => [...previous, { ...currentAnswer }].slice(-120))
      setFeedback('retry'); return
    }
    setFeedback('correct')
    if (questionIndex === 2) setCompleted(previous => previous.includes(lesson.id) ? previous : [...previous, lesson.id])
  }
  async function finish() {
    const attempt: RouteAttempt = { scenario, foundIds, answers: Object.values(answers), mistakes, reviewedNoteIds }
    if (!notesComplete || !evaluateRouteAttempt(attempt, normalCleared).cleared) return
    setSaving(true)
    setSaveError('')
    try { await onComplete(attempt); setSaved(true) }
    catch { setSaveError('学習記録を保存できませんでした。通信を確認して、もう一度保存してください。') }
    finally { setSaving(false) }
  }

  if (locked) return <section className="rounded-2xl bg-amber-50 p-6" role="status"><h2 className="text-lg font-bold">いつもの道をクリアすると遊べます</h2><p className="mt-2 text-sm">まず、いつもの通学路で危険の理由と安全な行動を学ぼう。</p></section>
  if (!lesson) return <p role="alert">この場面の問題が見つかりませんでした。</p>

  return <section aria-labelledby="route-training-heading" className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-1 text-sm font-bold text-teal-800">この場所で考える想定</p><h2 id="route-training-heading" className="text-2xl font-black"><Copy text="もしもの危険を見つけよう" /></h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">ここからは学習用の想定です。写真から見つけた危険や、3D内の正確な位置を示すものではありません。</p></div><span className="rounded-full bg-teal-100 px-4 py-2 text-sm font-bold text-teal-900">{completed.length} / {lessons.length} クリア</span></div>
    <div className="flex flex-wrap gap-2" aria-label="学ぶ危険を選ぶ">{lessons.map((item, index) => <button type="button" key={item.id} onClick={() => selectLesson(index)} aria-pressed={activeIndex === index} className={`${button} text-sm ${activeIndex === index ? '!border-teal-700 !bg-teal-50' : ''}`}>{completed.includes(item.id) && <Check size={16} />}<Copy text={item.title} /></button>)}</div>
    <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">学習のための想定</span><button type="button" className={`${button} text-sm`} onClick={() => readAloud(`${lesson.title}。${lesson.situation}。${found && !isDone ? lesson.questions[kind].prompt + '。' + lesson.questions[kind].choices.map(choice => choice.text).join('。') : lesson.focus}`)}><Volume2 size={17} />読み上げ</button></div>
      <h3 className="mt-5 text-xl font-bold"><Copy text={lesson.title} /></h3>
      <p className="mt-4 text-base leading-8"><Copy text={lesson.situation} /></p>
      {speechError && <p className="mt-2 text-sm text-amber-800" role="status">{speechError}</p>}
      {!found && <div className="mt-5 rounded-xl bg-[#fbf5e9] p-5"><p className="mb-4 leading-7"><Copy text={`3Dを見回しながら、${lesson.focus}を考えてみよう。`} /></p><button type="button" onClick={() => setFoundIds(previous => [...previous, lesson.id])} className={primary}><Eye size={18} /><Copy text="気をつけるところを考えた" /></button></div>}
      {found && !isDone && <div className="mt-6 space-y-5">
        <ol className="grid grid-cols-3 gap-2 text-xs sm:text-sm">{QUESTION_KINDS.map((item, index) => <li key={item} className={`rounded-lg p-3 font-bold ${index === questionIndex ? 'bg-teal-100 text-teal-900' : 'bg-slate-100 text-slate-600'}`}><Copy text={QUESTION_LABELS[item]} /></li>)}</ol>
        <fieldset><legend className="mb-4 text-lg font-bold"><Copy text={lesson.questions[kind].prompt} /></legend><div className="space-y-3">{lesson.questions[kind].choices.map(choice => <label key={choice.id} className={`flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-4 leading-7 ${currentAnswer?.[kind] === choice.id ? 'border-teal-700 bg-teal-50' : 'border-slate-300 hover:bg-slate-50'}`}><input type="radio" name={`${lesson.id}-${kind}`} value={choice.id} checked={currentAnswer?.[kind] === choice.id} onChange={() => choose(choice.id)} className="mt-2 h-4 w-4 accent-teal-800" disabled={feedback === 'correct'} /><Copy text={choice.text} /></label>)}</div></fieldset>
        {feedback !== 'correct' && <button type="button" className={primary} disabled={!currentAnswer?.[kind]} onClick={check}><Copy text="答えを確かめる" /></button>}
        {feedback && <div ref={feedbackRef} tabIndex={-1} role="status" className={`rounded-xl p-5 outline-none ${feedback === 'correct' ? 'bg-emerald-50' : 'bg-amber-50'}`}><p className="font-bold">{feedback === 'correct' ? 'よく考えられたね！' : 'もう一度、場面を考えてみよう。'}</p><p className="mt-2 text-sm leading-7"><Copy text={feedback === 'correct' ? '次の問いでも、安全につながる答えを考えよう。' : `ヒント：${lesson.focus}に注目してみよう。何が見えていないかな？`} /></p>{feedback === 'correct' && questionIndex < 2 && <button type="button" className={`${button} mt-4`} onClick={() => { setQuestionIndex(index => index + 1); setFeedback(null) }}>次へ<ArrowRight size={17} /></button>}</div>}
      </div>}
      {isDone && <motion.div initial={reduceMotion ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4 rounded-xl bg-emerald-50/50 p-4" role="status"><p className="flex items-center gap-2 font-bold text-teal-900"><Check size={20} />危険の理由と、安全な行動がわかった！</p><GentleOutcome traffic={lesson.category === 'traffic' || lesson.category === 'darkness'} /><p className="text-xs text-slate-500">学習アニメ（想定）</p><p className="leading-8"><Copy text={lesson.outcome} /></p>{!allDone && <button type="button" className={primary} onClick={() => selectLesson(lessons.findIndex(item => !completed.includes(item.id)))}>次の危険へ<ArrowRight size={18} /></button>}</motion.div>}
      <details className="mt-5 text-xs text-slate-600"><summary className="cursor-pointer py-2">学習内容の参考資料</summary><ul className="mt-2 space-y-2">{lesson.sources.map(source => <li key={source.url}><a className="underline underline-offset-2" href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>
    </article>
    {allDone && <section className="rounded-2xl bg-teal-900 p-6 text-white">
      <h3 className="flex items-center gap-2 text-xl font-black"><Flag />{notesComplete ? 'この場面をクリア！' : '問題はクリア！ 写真のメモも確かめよう'}</h3>
      <p className="my-4 leading-7">危険を予測して、理由と安全な行動を選べたね。{scenario === 'normal' ? 'すべての地点の記録を保存すると、雨・夕方・地震の場面にも挑戦できます。' : 'いつもの道でも、状況が変わったら一度立ち止まって考えよう。'}</p>
      {!notesComplete && <p role="status" className="mb-4">上の写真にある危険のメモを、すべて確認してから保存しよう。</p>}
      <button type="button" className={button} onClick={() => void finish()} disabled={saving || saved || !notesComplete}>{saving ? '記録を保存中…' : saved ? '記録を保存しました' : 'クリアの記録を保存する'}</button>
      {saveError && <p role="alert" className="mt-3 text-sm">{saveError}</p>}
    </section>}
  </section>
}

export function ScenePlayer({ splatUrl, scale, groundOffset, schoolYear, scenario = 'normal', normalCleared = false, rail, noteContext, onComplete }: ScenePlayerProps) {
  const scenarioLabel = ROUTE_SCENARIOS.find(item => item.id === scenario)?.label ?? 'いつもの道'
  const [reviewedNoteIds, setReviewedNoteIds] = useState<string[]>([])
  const notesComplete = evaluateReviewedNotes(noteContext?.notes ?? [], scenario, reviewedNoteIds).complete
  return <div className="space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-black">{scenarioLabel}</h2><p className="text-xs text-slate-600">{schoolYear <= 3 ? 'ふりがな・読み上げ・2つの選択肢' : '複数の危険を考える・3つの選択肢'}</p></div>
    <SplatView splatUrl={splatUrl} scale={scale} groundOffset={groundOffset} rail={rail} />
    {noteContext && (scenario === 'normal' || normalCleared) && <SceneNotesLearning key={`${splatUrl}:${scenario}`} {...noteContext} scenario={scenario} schoolYear={schoolYear} reviewedIds={reviewedNoteIds} onReview={id => setReviewedNoteIds(current => current.includes(id) ? current : [...current, id])} />}
    <Training key={`${splatUrl}:${scenario}:${schoolYear}`} schoolYear={schoolYear} scenario={scenario} normalCleared={normalCleared} onComplete={onComplete} reviewedNoteIds={reviewedNoteIds} notesComplete={notesComplete} />
  </div>
}
