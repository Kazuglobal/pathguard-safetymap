"use client"

import { useState } from 'react'
import type { NearbyAccident } from '@/lib/traffic-accident-data'

function recordDate(record: NearbyAccident): string {
  if (!record.occurred_at) return `${record.year}年（日時不明）`
  if (!record.occurred_at.includes('T')) return record.occurred_at
  const date = new Date(record.occurred_at)
  if (!Number.isFinite(date.valueOf())) return `${record.year}年（日時不明）`
  return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

export function AccidentRecordList({ records, total, radius, truncated, onNavigate }: {
  records: NearbyAccident[]
  total: number
  radius: number
  truncated: boolean
  onNavigate?: (coordinates: [number, number]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const sorted = records.slice().sort((a, b) => Number(b.severity === 'fatal') - Number(a.severity === 'fatal') || a.distance_m - b.distance_m)
  const visible = expanded ? sorted : sorted.slice(0, 3)
  return (
    <section aria-label="集計範囲内の事故一覧" className="mt-3 space-y-2">
      <h3 className="text-sm font-bold text-slate-900">半径{radius}m内の事故一覧</h3>
      <p className="text-xs text-slate-600">全{total}件中{records.length}件の明細・死亡事故を先に、距離順で表示</p>
      {truncated && <p className="text-xs text-amber-800">明細は表示上限までです。上の件数は範囲内の全事故を集計しています。</p>}
      <ol className="space-y-2">
        {visible.map((record, index) => (
          <li key={record.id ?? `${record.latitude},${record.longitude},${index}`} className={`rounded-xl border p-3 text-sm ${record.severity === 'fatal' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start justify-between gap-2">
              <strong className={record.severity === 'fatal' ? 'text-red-800' : 'text-slate-900'}>{record.severity === 'fatal' ? '死亡事故' : '負傷事故'}<span className="ml-2 font-normal text-slate-700">中心から{Math.round(record.distance_m)}m</span></strong>
              {onNavigate && <button type="button" className="shrink-0 rounded-lg border bg-white px-2 py-1 text-xs font-medium" aria-label={`${record.year}年の${record.severity === 'fatal' ? '死亡' : '負傷'}事故を地図で見る`} onClick={() => onNavigate([record.longitude, record.latitude])}>地図で見る</button>}
            </div>
            <p className="mt-1 text-xs text-slate-700">{recordDate(record)}・{record.type ?? '事故類型不明'}</p>
            <p className="mt-1 text-xs text-slate-700">死者 {record.fatalities}人 / 負傷者 {record.injuries}人{record.involved_pedestrian ? '・歩行者が関与' : ''}</p>
          </li>
        ))}
      </ol>
      {records.length > 3 && <button type="button" className="w-full rounded-xl border border-slate-300 bg-white py-2 text-sm font-medium text-slate-800" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? '事故一覧を3件に戻す' : `事故の明細${records.length}件を開く`}</button>}
    </section>
  )
}
