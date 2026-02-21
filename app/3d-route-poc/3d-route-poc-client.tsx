"use client"
import dynamic from 'next/dynamic'
import { useState } from 'react'
import TimeOfDaySlider from '@/components/3d-route/time-of-day-slider'
import AddressSearch, { GeoResult } from '@/components/3d-route/address-search'

const CesiumViewer = dynamic(
  () => import('@/components/3d-route/cesium-viewer'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        3Dビューを読み込み中...
      </div>
    ),
  }
)

export default function ThreeDRoutePocClient() {
  const [hourOfDay, setHourOfDay] = useState(9)
  const [location, setLocation] = useState<{ lon: number; lat: number } | null>(null)

  const handleSelect = (result: GeoResult) => {
    setLocation({ lon: result.lon, lat: result.lat })
  }

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div className="absolute inset-0">
        <CesiumViewer hourOfDay={hourOfDay} location={location} />
      </div>

      {/* 左上: タイトル + 住所検索 */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 w-72">
        <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10">
          <h1 className="text-white text-base font-bold leading-tight">
            3D通学路 PoC
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            子ども目線（110cm）で通学路を体験
          </p>
        </div>
        <AddressSearch onSelect={handleSelect} />
      </div>

      {/* 下部: 時間帯スライダー */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 w-80">
        <TimeOfDaySlider value={hourOfDay} onChange={setHourOfDay} />
      </div>
    </div>
  )
}
