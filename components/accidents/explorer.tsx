'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Map, List, MapPin, SlidersHorizontal, ChevronRight, FileText } from 'lucide-react'
import type { RankedLocation, RankingsResponse } from '@/lib/accidents/query'
const AccidentMap = dynamic(() => import('./map'), { ssr: false })
const control = 'min-h-11 rounded-xl border border-border bg-card px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest-strong'
interface Area { code: string; name: string }
export default function AccidentExplorer() {
  const params = useSearchParams(), router = useRouter(), pathname = usePathname()
  const [response, setResponse] = useState<RankingsResponse | null>(null)
  const [error, setError] = useState(false), [loading, setLoading] = useState(true), [reload,setReload]=useState(0)
  const [prefectures,setPrefectures]=useState<Area[]>([]), [cities,setCities]=useState<Area[]>([])
  const [selected,setSelected]=useState<RankedLocation|null>(null), [more,setMore]=useState(false)
  const moreController=useRef<AbortController|null>(null)
  const key = params.toString(), prefecture=params.get('prefecture')??'', municipality=params.get('municipality')??''
  const fetchParams=new URLSearchParams(key);fetchParams.delete('view');const fetchKey=fetchParams.toString()
  const view=params.get('view')??'list', participant=params.get('participant')??'all'
  const change=(patch: Record<string,string>)=>{
    const next=new URLSearchParams(key)
    if (Object.keys(patch).some(k=>k!=='view')) { next.delete('offset');next.delete('version') }
    for(const [k,v] of Object.entries(patch)) v ? next.set(k,v) : next.delete(k)
    router.push(`${pathname}?${next}`)
  }
  useEffect(()=>{
    const abort=new AbortController();moreController.current?.abort();setMore(false)
    setLoading(true);setError(false);setSelected(null);setResponse(null)
    fetch(`/api/accidents/rankings?${fetchKey}`,{signal:abort.signal}).then(async r=>{
      if(!r.ok) throw new Error('fetch');return r.json() as Promise<RankingsResponse>
    }).then(setResponse).catch(e=>{if(e.name!=='AbortError')setError(true)}).finally(()=>{if(!abort.signal.aborted)setLoading(false)})
    return()=>{abort.abort();moreController.current?.abort()}
  },[fetchKey,reload])
  useEffect(()=>{
    const abort=new AbortController()
    const suffix=response?.metadata ? `&version=${response.metadata.version}` : ''
    Promise.all([fetch(`/api/accidents/areas?${suffix}`,{signal:abort.signal}),prefecture ? fetch(`/api/accidents/areas?prefecture=${prefecture}${suffix}`,{signal:abort.signal}) : null]).then(async ([a,b])=>{
      if(!a.ok || (b&&!b.ok))throw new Error('areas')
      setPrefectures((await a.json()).items);setCities(b ? (await b.json()).items : [])
    }).catch(e=>{if(e.name!=='AbortError')setError(true)})
    return()=>abort.abort()
  },[prefecture,response?.metadata?.version,reload])
  const loadMore=async()=>{
    if(!response?.metadata||response.nextOffset===null||more)return
    const abort=new AbortController();moreController.current=abort;setMore(true)
    setError(false)
    const next=new URLSearchParams(key);next.set('offset',String(response.nextOffset));next.set('limit','20');next.set('version',response.metadata.version)
    try { const r=await fetch(`/api/accidents/rankings?${next}`,{signal:abort.signal});if(!r.ok)throw new Error('fetch');const page:RankingsResponse=await r.json()
      if(page.status!=='ready'||page.metadata?.version!==response.metadata.version)throw new Error('version')
      setResponse({...page,items:[...response.items,...page.items]})
    }catch(e){if(!abort.signal.aborted)setError(true)}finally{if(!abort.signal.aborted)setMore(false)}
  }
  const select=(item:RankedLocation)=>{setSelected(item);document.getElementById(`location-${item.id}`)?.scrollIntoView({block:'nearest',behavior:'smooth'})}
  const years=response?.metadata?.years??[]
  return <main className="min-h-screen bg-paper text-ink px-4 py-6 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-7 flex items-center justify-between"><Link href="/" className="flex min-h-11 items-center gap-2 text-xl font-bold"><MapPin className="text-forest-strong"/>PathGuardian</Link><button className="min-h-11 px-3 text-forest-strong" aria-label="地図へ切り替え" onClick={()=>change({view:'map'})}><Map/></button></header>
      <h1 className="text-2xl font-bold sm:text-3xl">あなたの街の事故を調べる</h1>
      <p className="mt-3 mb-6 leading-7">地域や移動の種類を選んで、<br className="sm:hidden"/>事故の多い場所を確認できます。</p>
      <section aria-label="検索条件" className="max-w-xl space-y-3">
        <div className="rounded-xl border border-border bg-card p-4"><p className="mb-2">地域を選ぶ</p><div className="flex gap-2">
          <label className="flex-1"><span className="sr-only">都道府県</span><select value={prefecture} className={`${control} w-full`} onChange={e=>change({prefecture:e.target.value,municipality:''})}><option value="">全国</option>{prefectures.map(a=><option key={a.code} value={a.code}>{a.name}</option>)}</select></label>
          <label className="flex-1"><span className="sr-only">市区町村</span><select disabled={!prefecture} value={municipality} className={`${control} w-full disabled:opacity-50`} onChange={e=>change({municipality:e.target.value})}><option value="">すべての市区町村</option>{cities.map(a=><option key={a.code} value={a.code}>{a.name}</option>)}</select></label>
        </div></div>
        <div className="grid grid-cols-3 rounded-xl border border-border bg-card p-1" aria-label="事故の種類">{[['all','すべて'],['bicycle','自転車'],['pedestrian','歩行者']].map(([v,label])=><button key={v} aria-pressed={participant===v} className={`min-h-11 rounded-xl ${participant===v?'bg-forest-strong text-white':'text-ink'}`} onClick={()=>change({participant:v})}>{label}</button>)}</div>
        <details className="border-y border-border py-2"><summary className="flex min-h-11 cursor-pointer items-center gap-2 font-semibold text-forest-strong"><SlidersHorizontal size={20}/>条件を変える</summary>
          <div className="grid grid-cols-2 gap-3 py-3">
            {['from','to'].map(k=><label key={k}>{k==='from'?'開始年':'終了年'}<select className={`${control} mt-1 w-full`} value={params.get(k)??''} onChange={e=>change({[k]:e.target.value})}><option value="">{k==='from'?'最初の年':'最新の年'}</option>{years.map(y=><option value={y} key={y}>{y}年</option>)}</select></label>)}
            <label>時間帯<select className={`${control} mt-1 w-full`} value={params.get('time')??'all'} onChange={e=>change({time:e.target.value})}>{[['all','すべて'],['morning','朝7〜9時'],['afternoon','午後2〜5時'],['evening','夕方5〜7時']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
            <label>場所<select className={`${control} mt-1 w-full`} value={params.get('kind')??'all'} onChange={e=>change({kind:e.target.value})}>{[['all','すべて'],['intersection','交差点'],['road','道路']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
            <label className="col-span-2 flex min-h-11 items-center gap-2"><input type="checkbox" checked={params.get('severity')==='fatal'} onChange={e=>change({severity:e.target.checked?'fatal':'all'})}/>死亡事故に絞る</label>
          </div>
        </details>
        <div className="grid grid-cols-2 rounded-full border border-border p-1 lg:hidden">{[['list','一覧'],['map','地図']].map(([v,t])=><button key={v} className={`flex min-h-11 items-center justify-center gap-2 rounded-full ${view===v?'bg-forest-strong text-white':''}`} aria-pressed={view===v} onClick={()=>change({view:v})}>{v==='list'?<List size={20}/>:<Map size={20}/>} {t}</button>)}</div>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className={`${view==='map'?'hidden lg:block':''}`} aria-label="事故件数ランキング">
          <h2 className="text-2xl font-bold">事故が多い場所</h2>
          <p className="mt-3 leading-7">事故件数の多い順です。<br/>事故に遭う確率を示すものではありません。</p>
          {response?.metadata&&<p className="mt-2">{params.get('from')??Math.min(...years)}〜{params.get('to')??Math.max(...years)}年</p>}
          {loading&&<p role="status" className="py-8">読み込み中…</p>}
          {error&&<div role="alert" className="py-6"><p>読み込めませんでした</p><button className={`${control} mt-2`} onClick={()=>setReload(n=>n+1)}>もう一度読み込む</button></div>}
          {!loading&&!error&&response?.status==='preparing'&&<div className="py-8"><h3 className="text-lg font-semibold">集計準備中です</h3><p className="mt-2 leading-7">事故データと道路の情報を確認しています。<br/>確認が終わった地域から表示します。</p></div>}
          {!loading&&!error&&response?.status==='unavailable'&&<p className="py-8">この地域または集計の版は未収録です。条件を選び直してください。</p>}
          {!loading&&!error&&response?.status==='ready'&&!response.items.length&&<p className="py-8">この条件で集計できた事故は0件です。未確定の事故は下の「数え方とデータについて」で確認できます。</p>}
          <ol className="mt-5 divide-y divide-border bg-card">{response?.items.map(item=><li id={`location-${item.id}`} key={item.id} className={`p-4 ${selected?.id===item.id?'bg-forest-soft':''}`}>
            <div className="flex items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest-soft font-bold text-forest-strong">{item.rank}</span><div className="flex-1"><Link className="text-lg font-semibold underline-offset-4 hover:underline" href={`/accidents/locations/${item.id}?${new URLSearchParams({...Object.fromEntries(params),version:response.metadata!.version})}`}>{item.name}</Link><p className="text-2xl font-bold text-forest-strong">{item.count.toLocaleString()}<span className="ml-1 text-base">件</span></p></div><button className="flex min-h-11 items-center gap-1 text-forest-strong" onClick={()=>{select(item);change({view:'map'});setSelected(item)}} aria-label={`${item.name}を地図で見る`}><Map size={20}/><span className="hidden sm:inline">地図で見る</span><ChevronRight size={16}/></button></div>
          </li>)}</ol>
          {response?.nextOffset!==null&&response?.status==='ready'&&<button disabled={more} className="mt-4 min-h-11 w-full rounded-full bg-forest-soft font-bold text-forest-strong" onClick={loadMore}>{more?'読み込み中…':'もっと見る'}</button>}
        </section>
        <section aria-label="ランキング地点の地図" className={`${view==='list'?'hidden lg:block':''} min-h-96 lg:sticky lg:top-6 lg:self-start`}><AccidentMap items={response?.items??[]} selected={selected} onSelect={select}/></section>
      </div>
      <details className="mt-6 border-t border-border py-4"><summary className="flex min-h-11 cursor-pointer items-center gap-2"><FileText size={20}/>数え方とデータについて</summary><div className="mt-3 space-y-3 leading-7">
        <p>同じ交差点・道路に割り当てられた事故を1件ずつ数えています。場所を決められない事故は順位に含めません。地図を動かしても順位は変わりません。</p>
        {response?.metadata ? <><p>集計方法：{response.metadata.method}<br/>更新日：{response.metadata.updatedAt}<br/>集計の版：{response.metadata.version}</p><p>選んだ地域・期間・事故条件の全地点：集計済み {response.quality.assigned.toLocaleString()}件／場所が未確定 {response.quality.uncertain.toLocaleString()}件／集計対象外 {response.quality.excluded.toLocaleString()}件</p>{response.metadata.sources.map(s=><p key={s.url}><a className="underline" href={s.url} rel="noreferrer">{s.name}</a>（{s.license}、取得日 {s.retrievedAt}）</p>)}</> : <p>検証済みの集計データはまだ登録されていません。架空の事故件数は表示しません。</p>}
      </div></details>
    </div>
  </main>
}
