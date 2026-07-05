"use client"

import { createPortal } from "react-dom"
import { MapPin } from "lucide-react"

interface MobileLocationSheetProps {
  isMobile: boolean
  awaitingLocationSelection: boolean
  selectedLocation: [number, number] | null
  /** 地点が選択済みのときの「やめる」（地点選択解除＋ピン/選択のクリア） */
  onCancelWithLocation: () => void
  /** 「ここで おしらせを かく」（フォームを開く） */
  onConfirm: () => void
  /** 地点未選択のときの「やめる」（地点選択モードの解除のみ） */
  onCancelWaiting: () => void
}

/**
 * モバイル用の地点選択ボトムシート（Portal で body に直接描画）。
 * 地点選択待ちの案内・確認バーを表示する。map-container.tsx から見た目・挙動を変えずに抽出。
 */
export function MobileLocationSheet({
  isMobile,
  awaitingLocationSelection,
  selectedLocation,
  onCancelWithLocation,
  onConfirm,
  onCancelWaiting,
}: MobileLocationSheetProps) {
  if (!isMobile || !awaitingLocationSelection) return null

  return createPortal(
    <div style={{ fontFamily: 'var(--font-app, "Zen Maru Gothic"), sans-serif' }}>
      {/* 案内は下部の確認バーに一本化(上部ピルとの二重案内を避ける) */}
      {/* 下部の確認バー - ナビゲーションバーの上に固定表示 */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] mobile-bottom-bar">
        <div
          className="rounded-t-[26px] border-t paper-surface"
          style={{ borderColor: "rgba(67,57,43,.12)", boxShadow: "0 -2px 0 rgba(67,57,43,.05), 0 -18px 40px -20px rgba(67,57,43,.5)" }}
        >
          {selectedLocation ? (
            <div className="px-4 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full border-2 bg-white"
                  style={{ borderColor: "rgba(21,158,114,.4)" }}
                >
                  <MapPin className="h-5 w-5" style={{ color: "#159E72" }} strokeWidth={2.6} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15.5px] font-black" style={{ color: "#43392B" }}>ここに ピンを たてたよ！</p>
                  <p className="text-[12px] font-bold" style={{ color: "#847661" }}>
                    この ばしょで よければ すすんでね
                  </p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={onCancelWithLocation}
                  className="chunky-press h-[52px] flex-1 rounded-full border-2 bg-white text-[14px] font-black"
                  style={{ borderColor: "rgba(67,57,43,.14)", color: "#847661", boxShadow: "0 3px 0 rgba(67,57,43,.16)" }}
                >
                  やめる
                </button>
                <button
                  type="button"
                  data-testid="confirm-location-button"
                  onClick={onConfirm}
                  className="chunky-press h-[52px] flex-[2] rounded-full border-2 text-[15px] font-black text-white"
                  style={{ background: "#159E72", borderColor: "rgba(67,57,43,.18)", boxShadow: "0 4px 0 #0C7A55" }}
                >
                  ここで おしらせを かく
                </button>
              </div>
            </div>
          ) : (
            <div className="px-4 pt-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "#F4801F" }}></span>
                  <p className="text-[13px] font-bold" style={{ color: "#847661" }}>ちずを タップして ばしょを えらんでね</p>
                </div>
                <button
                  type="button"
                  onClick={onCancelWaiting}
                  className="h-10 rounded-full px-4 text-[13px] font-black"
                  style={{ color: "#847661" }}
                >
                  やめる
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default MobileLocationSheet
