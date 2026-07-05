"use client"

import { AlertTriangle, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"

interface MapStatusOverlaysProps {
  showMobileMapHint: boolean
  onDismissHint: () => void
  isReportFormOpen: boolean
  selectedLocation: [number, number] | null
  mapError: string | null
  isLoading: boolean
}

/**
 * 地図上の各種ステータス表示（モバイルの地図エリアヒント・地点選択案内ピル・マップエラー・読み込み中）。
 * map-container.tsx から表示条件・見た目を変えずに抽出した純粋な表示コンポーネント。
 */
export function MapStatusOverlays({
  showMobileMapHint,
  onDismissHint,
  isReportFormOpen,
  selectedLocation,
  mapError,
  isLoading,
}: MapStatusOverlaysProps) {
  return (
    <>
      {/* モバイルマップヒント */}
      {showMobileMapHint && (
        <div
          className="absolute left-1/2 z-10 sm:hidden pointer-events-none -translate-x-1/2 top-[calc(env(safe-area-inset-top,0px)+6.75rem)]"
        >
          <div className="inline-flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-blue-100/80 text-blue-700 text-xs font-medium pointer-events-auto">
            <MapPin className="h-4 w-4 text-blue-500" />
            <span>ここが地図エリアです</span>
            <button
              type="button"
              onClick={onDismissHint}
              className="ml-1 text-blue-500 hover:text-blue-700 focus:outline-none"
              aria-label="地図エリアのヒントを閉じる"
            >
              ×
            </button>
          </div>
        </div>
      )}
      {/* Map Overlays: Selection Info, Error, Loading */}
      {isReportFormOpen && (
        <div className="absolute top-20 left-0 right-0 z-10 px-4 py-2 flex justify-center pointer-events-none">
          <div
            className="pointer-events-auto rounded-full border px-4 py-2"
            style={{
              background: "rgba(255,253,247,.95)",
              borderColor: "rgba(67,57,43,.12)",
              boxShadow: "0 1px 0 rgba(67,57,43,.05), 0 10px 26px -14px rgba(67,57,43,.45)",
              fontFamily: 'var(--font-app, "Zen Maru Gothic"), sans-serif',
            }}
          >
            <p className="text-sm font-black" style={{ color: "#0C7A55" }}>
              {selectedLocation ? "ばしょは えらんだよ。ちずを クリックすると かえられるよ" : "ちずを クリックして ばしょを えらんでね"}
            </p>
          </div>
        </div>
      )}
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-30">
          <div className="max-w-md p-4 bg-white rounded-lg shadow-lg text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">マップエラー</h3>
            <p>{mapError}</p>
            <Button className="mt-4" variant="outline" onClick={() => window.location.reload()}>再読み込み</Button>
          </div>
        </div>
      )}
      {isLoading && !mapError && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-30">
          <div className="p-4 bg-white rounded-lg shadow-lg text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p>読み込み中...</p>
          </div>
        </div>
      )}
    </>
  )
}

export default MapStatusOverlays
