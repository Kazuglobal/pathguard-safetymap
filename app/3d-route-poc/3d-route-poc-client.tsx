"use client"
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
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

const StreetViewPanel = dynamic(
  () => import('@/components/3d-route/street-view-panel'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400 text-sm">
        Street View を読み込み中...
      </div>
    ),
  }
)

type ViewMode = '3d' | 'street' | 'split'

const VIEW_MODE_LABELS: Record<ViewMode, string> = {
  '3d': '3D',
  split: '分割',
  street: 'Street',
}

export default function ThreeDRoutePocClient() {
  const [hourOfDay, setHourOfDay] = useState(9)
  const [location, setLocation] = useState<{ lon: number; lat: number } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('3d')
  const [streetViewInitialized, setStreetViewInitialized] = useState(false)

  const handleSelect = (result: GeoResult) => {
    setLocation({ lon: result.lon, lat: result.lat })
  }

  const show3d = viewMode === '3d' || viewMode === 'split'
  const showStreet = viewMode === 'street' || viewMode === 'split'
  const showStreetComponent = showStreet || streetViewInitialized

  useEffect(() => {
    if (showStreet) {
      setStreetViewInitialized(true)
    }
  }, [showStreet])

  const threeDPaneClass =
    viewMode === 'split'
      ? 'w-1/2 h-full'
      : viewMode === '3d'
        ? 'w-full h-full'
        : 'w-0 h-full overflow-hidden pointer-events-none'

  const streetPaneClass =
    viewMode === 'split'
      ? 'w-1/2 h-full border-l border-white/10'
      : viewMode === 'street'
        ? 'w-full h-full'
        : 'w-0 h-full overflow-hidden pointer-events-none'

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* メインビューポート */}
      <div className="absolute inset-0 flex">
        <div className={threeDPaneClass} aria-hidden={!show3d}>
          <CesiumViewer hourOfDay={hourOfDay} location={location} />
        </div>
        {showStreetComponent && (
          <div className={streetPaneClass} aria-hidden={!showStreet}>
            <StreetViewPanel location={location} active={showStreet} />
          </div>
        )}
      </div>

      {/* 左上: タイトル + モード切り替え + 住所検索 */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 w-72">
        <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/10">
          <h1 className="text-white text-base font-bold leading-tight">
            3D通学路 PoC
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            子ども目線（110cm）で通学路を体験
          </p>

          {/* ビューモード切り替えトグル */}
          <div className="flex gap-1 mt-3">
            {(['3d', 'split', 'street'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-white text-slate-900'
                    : 'bg-white/10 text-slate-400 hover:bg-white/20 hover:text-white'
                }`}
              >
                {VIEW_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
        <AddressSearch onSelect={handleSelect} />
      </div>

      {/* 下部: 時間帯スライダー (3Dビューがある場合のみ表示) */}
      {show3d && (
        <div
          className={`absolute bottom-8 z-10 w-80 ${
            viewMode === 'split'
              ? 'left-1/4 -translate-x-1/2'
              : 'left-1/2 -translate-x-1/2'
          }`}
        >
          <TimeOfDaySlider value={hourOfDay} onChange={setHourOfDay} />
        </div>
      )}
    </div>
  )
}
