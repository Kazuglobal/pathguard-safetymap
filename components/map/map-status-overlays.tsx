"use client"

import { AlertTriangle, List, LockKeyhole, MapPin, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { tankenTokens } from "@/lib/design/tanken"

interface MapStatusOverlaysProps {
  showMobileMapHint: boolean
  onDismissHint: () => void
  isReportFormOpen: boolean
  selectedLocation: [number, number] | null
  mapError: string | null
  isLoading: boolean
  loadingStage?: 1 | 2 | 3
  onShowList?: () => void
  onRetry?: () => void
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
  loadingStage = 1,
  onShowList,
  onRetry,
}: MapStatusOverlaysProps) {
  const t = tankenTokens
  const progressLabel = loadingStage === 1 ? "ベース地図を準備しています" : "危険マーカーを準備しています"

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
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#FBF5E9]/70 p-4">
          <div className="pointer-events-auto w-full max-w-md rounded-[22px] border p-5 text-center" style={{ background: t.color.card, borderColor: t.border.soft, boxShadow: t.shadow.card }} role="alert">
            <AlertTriangle className="mx-auto mb-3 h-10 w-10" style={{ color: t.color.accent }} aria-hidden="true" />
            <h3 className="text-lg font-black">地図を読み込めませんでした</h3>
            <p className="mt-2 text-sm font-bold leading-6" style={{ color: t.color.inkSoft }}>{mapError}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button className="min-h-12 rounded-full font-black" onClick={onShowList} disabled={!onShowList}>
                <List className="mr-2 h-4 w-4" aria-hidden="true" /> 一覧で見る
              </Button>
              <Button className="min-h-12 rounded-full font-black" variant="outline" onClick={onRetry ?? (() => window.location.reload())}>
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> もう一度ためす
              </Button>
            </div>
          </div>
        </div>
      )}
      {isLoading && !mapError && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#FBF5E9]/55 p-4" aria-live="polite" aria-atomic="true">
          <div className="pointer-events-auto w-full max-w-sm rounded-[22px] border p-5" style={{ background: t.color.card, borderColor: t.border.soft, boxShadow: t.shadow.card }}>
            <div className="flex items-center gap-3">
              <MapPin className="h-7 w-7 shrink-0" style={{ color: t.color.primary }} aria-hidden="true" />
              <div>
                <p className="font-black">地図を読み込み中 {loadingStage}/3</p>
                <p className="mt-1 text-sm font-bold" style={{ color: t.color.inkSoft }}>{progressLabel}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={3} aria-valuenow={loadingStage} aria-label={`地図の読み込み ${loadingStage}/3`}>
              {[1, 2, 3].map((segment) => (
                <span key={segment} className="h-2 rounded-full" style={{ background: segment <= loadingStage ? t.color.primary : t.color.paperDeep }} />
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Button className="min-h-12 rounded-full font-black" onClick={onShowList} disabled={!onShowList}>
                <List className="mr-2 h-4 w-4" aria-hidden="true" /> 一覧で見る
              </Button>
              <Button className="min-h-12 rounded-full font-black" variant="outline" onClick={onRetry ?? (() => window.location.reload())}>
                <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" /> もう一度ためす
              </Button>
            </div>
            {loadingStage < 2 && (
              <p className="mt-4 flex items-center justify-center gap-2 border-t pt-3 text-xs font-bold" style={{ borderColor: t.border.faint, color: t.color.inkSoft }}>
                <LockKeyhole className="h-4 w-4" aria-hidden="true" /> 地図の準備ができたら使えます
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default MapStatusOverlays
