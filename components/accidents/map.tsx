'use client'
import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { RankedLocation } from '@/lib/accidents/query'
export default function AccidentMap({items,selected,onSelect}: {items:RankedLocation[];selected:RankedLocation|null;onSelect:(item:RankedLocation)=>void}) {
  const container=useRef<HTMLDivElement>(null), map=useRef<mapboxgl.Map|null>(null)
  const markers=useRef<mapboxgl.Marker[]>([]), selectRef=useRef(onSelect)
  const [error,setError]=useState(false), [attempt,setAttempt]=useState(0), [ready,setReady]=useState(false)
  selectRef.current=onSelect
  useEffect(()=>{
    const token=process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
    if(!token||!container.current){setError(true);return}
    setError(false);setReady(false)
    const instance=new mapboxgl.Map({container:container.current,accessToken:token,style:'mapbox://styles/mapbox/streets-v12',center:[138,37],zoom:4})
    map.current=instance;instance.addControl(new mapboxgl.NavigationControl(),'bottom-right')
    const resize=new ResizeObserver(()=>instance.resize())
    resize.observe(container.current)
    instance.on('load',()=>setReady(true));instance.on('error',()=>setError(true))
    return()=>{resize.disconnect();markers.current.forEach(m=>m.remove());markers.current=[];instance.remove();map.current=null}
  },[attempt])
  useEffect(()=>{
    if(!map.current||!ready)return
    markers.current.forEach(m=>m.remove());markers.current=[]
    for(const item of items){
      const button=document.createElement('button');button.textContent=String(item.rank)
      button.className='flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-forest-strong text-white font-bold shadow-sm'
      button.setAttribute('aria-label',`${item.name}：${item.count}件`);button.onclick=()=>selectRef.current(item)
      markers.current.push(new mapboxgl.Marker({element:button}).setLngLat([item.longitude,item.latitude]).addTo(map.current))
    }
    if(items.length&&!selected){const bounds=new mapboxgl.LngLatBounds();items.forEach(i=>bounds.extend([i.longitude,i.latitude]));map.current.fitBounds(bounds,{padding:55,maxZoom:15,duration:0})}
  },[items,ready,selected])
  useEffect(()=>{if(selected&&map.current&&ready)map.current.flyTo({center:[selected.longitude,selected.latitude],zoom:16})},[selected,ready])
  return <div className="relative overflow-hidden rounded-xl border border-border bg-card">
    <div ref={container} className="h-[480px] w-full"/>
    {error&&<div role="alert" className="absolute inset-0 flex flex-col items-center justify-center bg-card p-6"><p>地図を読み込めませんでした</p><button className="mt-3 min-h-11 rounded-xl border px-4" onClick={()=>setAttempt(n=>n+1)}>もう一度読み込む</button></div>}
    {selected&&<p className="absolute left-3 right-3 top-3 rounded-xl bg-card p-3">{selected.name}・{selected.count.toLocaleString()}件</p>}
    <p className="px-4 py-3 text-sm">一覧と同じ順位を表示しています。<a className="underline" href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a></p>
  </div>
}
