"use client"

import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import AccidentStatsPanel from "@/components/danger-report/accident-stats-panel"
import type { AccidentStats } from "@/lib/traffic-accident-data"
import type { AccidentStatsStatus } from "@/hooks/use-accident-stats"

interface AccidentStatsOverlayProps {
  status: AccidentStatsStatus
  stats: AccidentStats | null
  isMobile: boolean
  awaitingLocationSelection: boolean
  isReportFormOpen: boolean
  onReset: () => void
  isOtherPanelOpen?: boolean
  locationSource?: 'map' | 'gps'
  center?: [number, number] | null
  error?: string | null
  onCurrentLocation?: () => void
  onAccidentNavigate?: (coordinates: [number, number]) => void
}

/**
 * 地図クリック時に表示する事故統計パネル（loading / error / loaded）のオーバーレイ。
 * map-container.tsx から表示条件・見た目を変えずに抽出した純粋な表示コンポーネント。
 */
export function AccidentStatsOverlay({
  status,
  stats,
  isMobile,
  awaitingLocationSelection,
  isReportFormOpen,
  onReset,
  isOtherPanelOpen = false,
  locationSource = 'map',
  center,
  error,
  onCurrentLocation,
  onAccidentNavigate,
}: AccidentStatsOverlayProps) {
  if (status === "idle" || awaitingLocationSelection || isReportFormOpen || isOtherPanelOpen) return null

  return (
    <section aria-label="周辺事故の集計" className={`absolute z-20 rounded-2xl border border-slate-200 bg-white shadow-lg ${
      isMobile
        ? 'bottom-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] left-3 right-3 max-h-[55dvh]'
        : 'top-24 right-4 w-96 max-h-[calc(100vh-8rem)]'
    } overflow-y-auto`}>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{locationSource === 'gps' ? '現在地の周辺事故' : '選択地点の周辺事故'}</h2>
            <p className="mt-1 text-xs text-slate-600">青い破線の円内・中心から半径300m</p>
            {locationSource === 'map' && <p className="mt-1 text-xs font-medium text-slate-700">地図で選択した地点の集計です。現在地とは別です。</p>}
            {center && <p className="mt-1 text-[11px] text-slate-500">中心: {center[1].toFixed(5)}, {center[0].toFixed(5)}</p>}
          </div>
          <Button variant="ghost" size="sm" aria-label="事故集計を閉じる" onClick={onReset} className="h-8 w-8 shrink-0 p-0"><X className="h-4 w-4" /></Button>
        </div>
        {onCurrentLocation && <button type="button" onClick={onCurrentLocation} className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">現在地の事故を調べる</button>}
      </header>
      {status === 'loading' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-lg">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
            <span className="ml-3 text-gray-600">事故統計を取得中...</span>
          </div>
        </div>
      )}
      {status === 'error' && (
        <div className="bg-white rounded-xl border border-red-200 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-red-600 font-medium">事故統計の取得に失敗しました</p>
          </div>
          <p className="text-xs text-red-800">{error?.includes('Unauthorized') ? 'ログイン状態を確認してから、もう一度地点を選んでください。' : '事故件数を確認できません。ゼロ件という意味ではありません。もう一度地点を選んでください。'}</p>
          {error?.includes('現在地') && <p className="mt-2 text-xs text-red-800">{error}</p>}
        </div>
      )}
      {status === 'loaded' && stats && (
        <div className="relative bg-white rounded-xl shadow-lg border border-gray-200">
          <AccidentStatsPanel stats={stats} mode="full" onAccidentNavigate={onAccidentNavigate} />
        </div>
      )}
    </section>
  )
}

export default AccidentStatsOverlay
