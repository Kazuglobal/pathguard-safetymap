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
}: AccidentStatsOverlayProps) {
  if (status === "idle" || awaitingLocationSelection || isReportFormOpen) return null

  return (
    <div className={`absolute z-40 ${
      isMobile
        ? 'bottom-4 left-4 right-4 max-h-[60vh]'
        : 'top-24 right-4 w-96 max-h-[calc(100vh-8rem)]'
    } overflow-y-auto`}>
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {status === 'loaded' && stats && (
        <div className="relative bg-white rounded-xl shadow-lg border border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="absolute top-2 right-2 z-20 h-8 w-8 p-0 bg-white/90 hover:bg-white"
          >
            <X className="h-4 w-4" />
          </Button>
          <AccidentStatsPanel stats={stats} mode="full" />
        </div>
      )}
    </div>
  )
}

export default AccidentStatsOverlay
