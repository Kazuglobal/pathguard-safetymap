'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { RankedLocation, SnapshotMetadata } from '@/lib/accidents/query'
const AccidentMap=dynamic(()=>import('./map'),{ssr:false})
interface Detail { status:string; metadata?:SnapshotMetadata; item?: {id:string;name:string;kind:'road'|'intersection';latitude:number;longitude:number;scope:{radiusMeters?:number;description:string}}; counts?:Array<{year:number;hour:number;accidentClass:string;count:number}> }
export default function LocationDetail({id}: {id:string}) {
  const params=useSearchParams(), key=params.toString()
  const [result,setResult]=useState<Detail|null>(null), [error,setError]=useState(''), [attempt,setAttempt]=useState(0)
  useEffect(()=>{const abort=new AbortController();setResult(null);setError('')
    fetch(`/api/accidents/locations/${encodeURIComponent(id)}?${key}`,{signal:abort.signal}).then(async r=>{if(!r.ok)throw new Error(r.status===404?'場所が見つかりませんでした':'読み込めませんでした');return r.json()}).then(setResult).catch(e=>{if(e.name!=='AbortError')setError(e.message)})
    return()=>abort.abort()
  },[id,key,attempt])
  const counts=result?.counts??[], total=counts.reduce((n,r)=>n+r.count,0)
  const grouped=(field:'year'|'hour'|'accidentClass')=>{const values=new Map<string,number>();counts.forEach(r=>values.set(String(r[field]),(values.get(String(r[field]))??0)+r.count));return [...values.entries()]}
  const item=result?.item
  const mapped:RankedLocation|null=item?{...item,count:total,rank:1,prefecture:'',municipality:''}:null
  return <main className="min-h-screen bg-paper px-4 py-6 text-ink"><div className="mx-auto max-w-3xl">
    <Link className="inline-flex min-h-11 items-center text-forest-strong underline" href={`/accidents?${key}`}>一覧へ戻る</Link>
    {error&&<div role="alert"><p>{error}</p><button className="mt-3 min-h-11 rounded-xl border px-4" onClick={()=>setAttempt(n=>n+1)}>もう一度読み込む</button></div>}
    {!result&&!error&&<p role="status">読み込み中…</p>}
    {result&&!item&&<p className="py-6">{result.status==='unavailable'?'この集計の版は現在表示できません。':'集計準備中です。確認済みの地点から表示します。'}</p>}
    {item&&<><h1 className="mt-4 text-3xl font-bold">{item.name}</h1><p className="mt-4 text-3xl font-bold text-forest-strong">{total.toLocaleString()}件</p><p className="mt-2 leading-7">選んだ条件で数えた事故件数です。<br/>事故に遭う確率を示すものではありません。</p>
      <section className="mt-8"><h2 className="text-xl font-bold">年ごとの事故件数</h2><table className="mt-3 w-full bg-card"><caption className="sr-only">対象期間の年別事故件数</caption><thead><tr><th className="p-3 text-left">年</th><th className="p-3 text-right">件数</th></tr></thead><tbody>{result.metadata?.years.filter(y=>y>=Number(params.get('from')??0)&&y<=Number(params.get('to')??2100)).map(y=><tr key={y} className="border-t border-border"><td className="p-3">{y}年</td><td className="p-3 text-right">{grouped('year').find(([k])=>k===String(y))?.[1]??0}件</td></tr>)}</tbody></table></section>
      <section className="mt-8"><h2 className="text-xl font-bold">事故が多い時間帯</h2>{grouped('hour').sort((a,b)=>b[1]-a[1]||Number(a[0])-Number(b[0])).slice(0,3).map(([h,n])=><p className="mt-3" key={h}>{h==='-1'?'時刻不明':`${h}時台`}：{n}件</p>)}{!counts.length&&<p className="mt-3">この条件で集計できた事故は0件です。</p>}</section>
      <section className="mt-8"><h2 className="text-xl font-bold">事故の種類</h2>{grouped('accidentClass').map(([k,n])=><p key={k} className="mt-3">{k}：{n}件</p>)}</section>
      <section className="mt-8"><h2 className="mb-3 text-xl font-bold">場所と数えた範囲</h2><p className="mb-3 leading-7">{item.scope.description}{item.scope.radiusMeters&&`（交差点から${item.scope.radiusMeters}m以内）`}</p><AccidentMap items={mapped?[mapped]:[]} selected={mapped} onSelect={()=>{}}/></section>
      <details className="mt-6 border-t py-3"><summary className="min-h-11 cursor-pointer">数え方とデータについて</summary><p className="leading-7">{result.metadata?.method}<br/>更新日：{result.metadata?.updatedAt}<br/>集計の版：{result.metadata?.version}</p>{result.metadata?.sources.map(s=><p key={s.url} className="mt-3"><a className="underline" href={s.url}>{s.name}</a>（{s.license}、取得日 {s.retrievedAt}）</p>)}</details>
    </>}
  </div></main>
}
