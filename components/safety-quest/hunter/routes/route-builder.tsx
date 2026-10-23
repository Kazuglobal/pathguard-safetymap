'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowDown, ArrowUp, Camera, Check, MapPin, ShieldCheck, Trash2 } from 'lucide-react'
import { MaskConfirm } from '../mask-confirm'
import { routeRequest } from './route-request'
import { RouteNotebook } from './route-notebook'
import './route-notebook.css'

import { readPhotoGps, suggestPhotoOrder, type PhotoGps } from '@/lib/hunter/routes/photo-order'

type Photo = { id: string; file: File; url: string; masked?: string; included: boolean; scene: string; gps?: PhotoGps | null }
const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:opacity-40'

export function RouteBuilder() {
  const [creating, setCreating] = useState(false)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [title, setTitle] = useState('学校東側コース')
  const [grade, setGrade] = useState('1')
  const [editing, setEditing] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [consent, setConsent] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [saved, setSaved] = useState('')
  const [readingGps, setReadingGps] = useState(false)
  const readingRef = useRef(false)
  const urls = useRef(new Set<string>())
  useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)) }, [])
  const selected = photos.filter(photo => photo.included)
  const ready = !readingGps && selected.length >= 1 && selected.every(photo => photo.masked && photo.scene.trim()) && !!title.trim()
  const active = photos.find(photo => photo.id === editing)
  async function save() {
    if (!ready || !consent || saving) return
    setSaving(true); setError(''); setSaved('')
    try {
      const scenes: { name: string; photos: string[] }[] = []
      const names = new Set<string>()
      for (const photo of selected) {
        const name = photo.scene.trim()
        let scene = scenes.at(-1)
        if (scene?.name !== name) {
          if (names.has(name)) throw new Error('同じ地点の写真を隣り合わせにしてください。')
          scene = { name, photos: [] }; names.add(name); scenes.push(scene)
        }
        scene.photos.push(photo.masked!)
      }
      if (scenes.length > 8 || scenes.some(scene => scene.photos.length > 8)) throw new Error('1コース8地点、1地点8枚までに分けてください。')
      await routeRequest('/api/hunter/routes', { title, schoolYear: Number(grade), model: 'marble-1.0-draft', consent: true, scenes })
      setRefreshKey(key => key + 1); setSaved('写真を保存しました。一覧でコースを開き、「写真から問題をつくる・直す」に進みましょう。')
      setPreview(false); setCreating(false)
      urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); setPhotos([])
    } catch (err) { setError((err as Error).message) } finally { setSaving(false) }
  }
  function update(id: string, patch: Partial<Photo>) {
    setPhotos(items => items.map(item => item.id === id ? { ...item, ...patch } : item))
    setPreview(false)
  }
  function move(index: number, direction: number) {
    setPhotos(items => { const next = [...items]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next })
    setPreview(false)
  }
  function add(files: FileList | null) {
    if (!files || readingRef.current || saving) return
    const incoming = Array.from(files)
    if (photos.length + incoming.length > 24) { setError('写真は24枚まで選べます。'); return }
    if (incoming.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024)) {
      setError('JPEG・PNG・WebPの写真を選んでください。1枚20MBまでです。'); return
    }
    setError('')
    const added: Photo[] = incoming.map(file => {
      const url = URL.createObjectURL(file); urls.current.add(url)
      return { id: crypto.randomUUID(), file, url, included: true, scene: '' }
    })
    setPhotos(items => [...items, ...added])
    readingRef.current = true; setReadingGps(true)
    const suggestInitialOrder = photos.length === 0
    void Promise.all(added.map(async photo => ({ id: photo.id, gps: await readPhotoGps(photo.file) }))).then(locations => {
      setPhotos(items => {
        const updated = items.map(item => {
          const location = locations.find(value => value.id === item.id)
          return location ? { ...item, gps: location.gps } : item
        })
        return suggestInitialOrder ? suggestPhotoOrder(updated) : updated
      })
    }).finally(() => { readingRef.current = false; setReadingGps(false) })
    setPreview(false)
  }
  if (active) return <main className="mx-auto max-w-3xl p-4"><h1 className="mb-4 text-xl font-bold">写真のぼかしを確認</h1><MaskConfirm key={active.id} file={active.file} onCancel={() => setEditing(null)} onConfirm={masked => {
    // Re-edit the processed pixels so earlier manual masks cannot disappear.
    const bytes = Uint8Array.from(atob(masked.split(',')[1]), char => char.charCodeAt(0))
    const file = new File([bytes], 'masked.webp', { type: 'image/webp' })
    update(active.id, { masked, file }); setEditing(null)
  }} /></main>

  return <main className="route-notebook">
    <div className="notebook-page">
      {saved && <p role="status" className="notebook-status">{saved}</p>}
      {!creating ? <RouteNotebook refreshKey={refreshKey} onCreate={() => { setCreating(true); window.scrollTo({ top: 0, behavior: 'instant' }) }} /> : <>
      <button className="notebook-link mb-6" onClick={() => setCreating(false)}><ArrowLeft size={20} />通学路ノート</button>
      <h1 className="notebook-title"><span>写真からコースをつくろう</span></h1>
      <p className="notebook-subtitle">いつもの道の写真を、大人と一緒に選ぼう。</p>
      <ol className="mb-8 grid grid-cols-3 gap-2 text-center text-sm font-bold"><li className="rounded-xl bg-teal-100 p-3">1 写真をえらぶ</li><li className="rounded-xl bg-teal-100 p-3">2 区間・ぼかし</li><li className="rounded-xl bg-white p-3">3 内容を確認</li></ol>
      <section className="mb-6 grid gap-5 rounded-2xl bg-white p-5 sm:grid-cols-2">
        <label className="min-w-0 font-bold">コースの名前<input value={title} maxLength={64} onChange={event => { setTitle(event.target.value); setPreview(false) }} className="mt-2 block min-h-12 w-full rounded-xl border border-slate-300 px-3" /><span className="mt-2 block text-xs font-normal text-slate-600">児童の名前や自宅の住所は入れないでください。</span></label>
        <label className="font-bold">学年<select value={grade} onChange={event => setGrade(event.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-slate-300 px-3">{Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>{i < 6 ? `小学${i + 1}年生` : `中学${i - 5}年生`}</option>)}</select></label>
      </section>
      <section className="mb-6 rounded-2xl border-2 border-dashed border-teal-300 bg-white p-6">
        <h2 className="flex items-center gap-2 text-xl font-bold"><Camera />通学路の写真をえらぼう</h2>
        <p className="my-3 text-sm leading-6 text-slate-600">大人と一緒に、安全な場所から撮影してください。同じ交差点は別の方向からも撮ると、周りの様子が伝わります。</p>
        <label className={`${button} w-full min-w-0 flex-wrap justify-start`}>写真を追加<input aria-label="通学路の写真を追加" type="file" multiple disabled={readingGps || saving} accept="image/jpeg,image/png,image/webp" className="min-h-11 w-full min-w-0 max-w-full py-2 text-sm" onChange={event => { add(event.target.files); event.target.value = '' }} /></label>
        <p className="mt-3 text-xs text-slate-500">保存前の写真は画面を閉じると消えます。JPEGの位置情報は端末内で順番の提案に使い、保存する画像から取り除きます。</p>
        {readingGps && <p role="status" className="mt-2 text-sm">写真の位置情報を確認中…</p>}
        {error && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{error}</p>}
      </section>
      {photos.length > 0 && <section aria-label="写真の順番と共有範囲" className="space-y-4">
        <h2 className="text-xl font-bold">学校へ向かう順にならべよう</h2>
        <p className="text-sm text-slate-600">自宅付近は「この写真を使う」を外します。同じ場所の写真には同じ地点名をつけてください。</p>
        <p className="text-sm text-slate-600">最初に選んだ写真は位置情報から近い順に提案します。道路に沿った正確な順番ではないため、矢印で直してください。位置情報がない写真や後から追加した写真は最後に並びます。</p>
        {photos.map((photo, index) => <article key={photo.id} className={`grid gap-4 rounded-2xl border bg-white p-4 sm:grid-cols-[180px_1fr] ${photo.included ? 'border-slate-200' : 'border-dashed border-slate-400'}`}>
          <img src={photo.masked ?? photo.url} alt={`通学路の写真 ${index + 1}`} className="aspect-video w-full rounded-xl object-cover" />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><label className="flex min-h-11 items-center gap-2 font-bold"><input type="checkbox" checked={photo.included} onChange={event => update(photo.id, { included: event.target.checked })} className="h-5 w-5" />{index + 1}. この写真を使う</label><span className="text-xs text-slate-600">{photo.masked ? 'ぼかし確認済み' : 'ぼかし未確認'} · {photo.gps ? '位置情報あり' : '位置情報なし'}</span></div>
            <label className="block min-w-0 text-sm font-bold">地点名<input placeholder="例：学校前の交差点" value={photo.scene} maxLength={60} onChange={event => update(photo.id, { scene: event.target.value })} className="mt-2 block min-h-11 w-full min-w-0 rounded-lg border px-3" /></label>
            <div className="flex flex-wrap gap-2">
              <button className={button} onClick={() => setEditing(photo.id)}><ShieldCheck size={16} />ぼかしを確認</button>
              <button className={button} disabled={readingGps || index === 0} aria-label={`写真${index + 1}を前へ`} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>
              <button className={button} disabled={readingGps || index === photos.length - 1} aria-label={`写真${index + 1}を後ろへ`} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>
              <button className={button} aria-label={`写真${index + 1}を削除`} onClick={() => { URL.revokeObjectURL(photo.url); urls.current.delete(photo.url); setPhotos(items => items.filter(item => item.id !== photo.id)); setPreview(false) }}><Trash2 size={16} /></button>
            </div>
          </div>
        </article>)}
      </section>}
      <section className="my-6 rounded-2xl bg-white p-5">
        <p className="mb-4 text-sm text-slate-600">顔は自動検出を試みます。表札・ナンバーや検出されなかった顔は、ぼかし画面で隠してください。</p>
        <button className={`${button} w-full !bg-teal-800 !text-white`} disabled={!ready} onClick={() => setPreview(true)}><Check size={18} />使う写真を確認する（{selected.length}枚）</button>
        {!ready && <p className="mt-3 text-base text-slate-600">写真を1枚以上選び、地点名とすべてのぼかしを確認してください。</p>}
      </section>
      {preview && <section aria-label="コースの確認" className="mb-8 rounded-2xl border-2 border-teal-600 bg-white p-6"><h2 className="text-xl font-bold">{title}：写真の準備ができました</h2><ol className="my-4 space-y-3">{selected.map((photo, index) => <li key={photo.id} className="flex items-center gap-3"><MapPin size={18} className="shrink-0" /><span className="min-w-0 flex-1 break-words">{index + 1}. {photo.scene}</span><img src={photo.masked} alt={`確認済み写真 ${index + 1}`} className="ml-auto h-16 w-24 shrink-0 rounded-lg object-cover" /></li>)}</ol>
        <label className="my-4 flex items-start gap-3 text-sm leading-6"><input className="mt-1 h-5 w-5 shrink-0" type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />ぼかし・自宅付近の除外を確認しました。確認した写真を保存します。子どもの利用は保護者または先生と確認してください。</label>
        <button disabled={!consent || saving} className={`${button} !bg-teal-800 !text-white`} onClick={save}>{saving ? '保存中…' : 'この写真でコースを保存する'}</button>
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      </section>}
      </>}
    </div>
  </main>
}
