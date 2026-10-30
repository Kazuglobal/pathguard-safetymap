"use client"

import { useState } from "react"
import { MapPin, MapPinPlus, Trophy, PlusCircle, List, Loader2, Menu } from "lucide-react"
import { MapLegendButton, MapLegendCompact } from "./map-legend"
import { useGamification } from "@/hooks/use-gamification"
import { MOBILE_MAP_DOCK_BOTTOM } from "@/lib/map-overlay-ui"
import { MapMenuSheet } from "./map-menu-sheet"
import { tankenTokens } from "@/lib/design/tanken"
import { REPORT_ENTRY_LABEL } from "@/lib/report-entry"

const C = tankenTokens.color

/** 地図の上に浮く紙のピル(共通スタイル) */
const floatPill = {
  background: "rgba(255,253,247,.95)",
  borderColor: "rgba(67,57,43,.12)",
  boxShadow: tankenTokens.shadow.float,
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
} as const

// 右上のポイント表示と「ピンの見方」は、上の列(検索・通学路チェック・くわしい表示)のすぐ下に置き、「くわしい表示」の
// 列を開いたらその下へずらす(列と重ならないように)。md〜lg 未満は上の列が画面の幅いっぱいなので、スマホと同じく列の下に置く。
// lg 以上は上の列が中央に寄って右端と重ならないので、列を開いても動かさない
const UTILITIES_TOP_CLASS = {
  folded:
    "top-[calc(env(safe-area-inset-top,0px)+8.5rem)] md:top-[calc(env(safe-area-inset-top,0px)+12.5rem)] lg:top-[calc(env(safe-area-inset-top,0px)+7.75rem)]",
  unfolded:
    "top-[calc(env(safe-area-inset-top,0px)+12.5rem)] md:top-[calc(env(safe-area-inset-top,0px)+16.5rem)] lg:top-[calc(env(safe-area-inset-top,0px)+7.75rem)]",
} as const

interface MapFloatingControlsProps {
  onAddReport: () => void
  isReportFormOpen: boolean
  isSelectingLocation?: boolean
  onToggleSidebar?: () => void
  isMobile?: boolean
  onReportAtCurrentLocation?: () => void
  isAcquiringGPS?: boolean
  isMapReady?: boolean
  /** 上の「くわしい表示」の列が出ている */
  isTopDetailsOpen?: boolean
  /** 「この地域の報告はまだありません」の案内が出ている */
  isEmptyAreaNoticeVisible?: boolean
}

export default function MapFloatingControls({
  onAddReport,
  isReportFormOpen,
  isSelectingLocation,
  onToggleSidebar,
  isMobile = false,
  onReportAtCurrentLocation,
  isAcquiringGPS = false,
  isMapReady = true,
  isTopDetailsOpen = false,
  isEmptyAreaNoticeVisible = false,
}: MapFloatingControlsProps) {
  const { points, level } = useGamification()
  const isSelecting = !!isSelectingLocation
  const showPrimaryCta = !isMobile
  // 地図では下部タブバーを出さないので、ボタン列は画面の一番下に置く
  const mobileBottomNavClearance = MOBILE_MAP_DOCK_BOTTOM
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const ctaBottomStyle = {
    bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" : "6rem",
  }
  const legendBottomStyle = {
    bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 5rem)" : "1.5rem",
  }
  // 地点選択中はポータルの下部確認バーが案内を担うため、ここでは出さない(案内の三重化を防ぐ)
  const showMobileFocusedDock = isMobile && isReportFormOpen && !isSelecting
  const showMobileActionDock = isMobile && !showMobileFocusedDock
  const showLegend = !isMobile
  // スマホで「この地域の報告はまだありません」の案内が出ているあいだは、右上の部品を出さない。案内は地図のまんなかに
  // 出るので、画面の低いスマホや「くわしい表示」を開いたときに重なる(ピンが無いので「ピンの見方」もいらない)
  const showUtilities = !(isMobile && isEmptyAreaNoticeVisible)

  return (
    <>
      {/* 右上: ユーティリティ */}
      {showUtilities && (
        <div
          data-testid="map-utilities"
          className={`absolute right-3 z-20 flex flex-col items-end gap-1.5 sm:gap-2 ${isTopDetailsOpen ? UTILITIES_TOP_CLASS.unfolded : UTILITIES_TOP_CLASS.folded}`}
        >
          <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
            {/* ポイント・レベル表示(スタンプらしく) */}
            <div
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 sm:px-3 sm:py-2"
              style={floatPill}
            >
              <Trophy className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ color: C.sunDeep }} strokeWidth={2.4} />
              <span className="text-xs font-black sm:text-sm" style={{ color: C.ink }}>
                {points}
                <span className="hidden sm:inline">pt</span>
              </span>
              <div
                className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1 sm:h-6 sm:min-w-[1.5rem]"
                style={{ background: C.primarySoft }}
              >
                <span className="text-xs font-black leading-none" style={{ color: C.primaryStrong }}>
                  L{level}
                </span>
              </div>
            </div>

            {/* ヘルプは地図の「使い方」ボタン(map-page-client.tsx)の1つにまとめた */}
          </div>

          {/* スマホは凡例を常時出す場所がないため、ボタンから開く */}
          {isMobile && <MapLegendButton />}
        </div>
      )}

      {/* 地図の見た目と重ねる情報は、上の「くわしい表示」の中に移した(UIUX改装 項目9・10) */}

      {/* 下部: モバイル主要アクションドック */}
      {showMobileActionDock && (
        <div
          data-testid="mobile-action-dock"
          data-map-overlay="bottom"
          className="absolute inset-x-3 z-20"
          style={{ bottom: mobileBottomNavClearance }}
        >
          <div
            className="grid grid-cols-4 gap-1.5 rounded-[22px] border p-2"
            style={floatPill}
          >
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              className={`chunky-press flex h-12 items-center justify-center gap-1 rounded-full border-2 bg-white text-[12px] font-black ${tankenTokens.cls.focus}`}
              style={{ borderColor: "rgba(67,57,43,.12)", color: C.inkSoft, boxShadow: tankenTokens.shadow.pressPaper }}
              aria-label="メニューを開く"
            >
              <Menu className="h-4 w-4" strokeWidth={2.6} />
              メニュー
            </button>
            {onToggleSidebar ? (
              <button
                type="button"
                onClick={onToggleSidebar}
                className={`chunky-press flex h-12 items-center justify-center gap-1.5 rounded-full border-2 bg-white text-[13px] font-black ${tankenTokens.cls.focus}`}
                style={{ borderColor: "rgba(67,57,43,.12)", color: C.inkSoft, boxShadow: tankenTokens.shadow.pressPaper }}
                aria-label="危険地点一覧を開く"
              >
                <List className="h-4 w-4" strokeWidth={2.6} />
                一覧
              </button>
            ) : (
              <div />
            )}

            {onReportAtCurrentLocation ? (
              <button
                type="button"
                onClick={onReportAtCurrentLocation}
                disabled={isAcquiringGPS || !isMapReady}
                className={`chunky-press flex h-12 items-center justify-center gap-1.5 rounded-full border-2 bg-white text-[13px] font-black disabled:opacity-50 ${tankenTokens.cls.focus}`}
                style={{ borderColor: "rgba(21,158,114,.35)", color: C.primaryStrong, boxShadow: tankenTokens.shadow.pressPaper }}
                aria-label={isAcquiringGPS ? "位置取得中" : "現在地で報告"}
              >
                {isAcquiringGPS ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    取得中
                  </>
                ) : (
                  <>
                    <MapPinPlus className="h-4 w-4" strokeWidth={2.6} />
                    現在地
                  </>
                )}
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={onAddReport}
              disabled={!isMapReady}
              data-testid="mobile-report-button"
              className={`chunky-press flex h-12 items-center justify-center gap-1.5 rounded-full border-2 text-[13px] font-black text-white disabled:cursor-not-allowed disabled:opacity-55 ${tankenTokens.cls.focus}`}
              style={{
                background: C.accent,
                borderColor: "rgba(67,57,43,.18)",
                boxShadow: tankenTokens.shadow.pressAccent,
              }}
              aria-label={REPORT_ENTRY_LABEL}
            >
              <PlusCircle className="h-4 w-4" strokeWidth={2.6} />
              報告
            </button>
          </div>
        </div>
      )}

      {showMobileFocusedDock && (
        <div
          data-testid="mobile-focused-dock"
          className="absolute inset-x-3 z-20"
          style={{ bottom: mobileBottomNavClearance }}
        >
          <div className="rounded-[22px] border px-4 py-3" style={floatPill}>
            <p className="text-sm font-black" style={{ color: C.ink }}>
              {isSelecting ? "報告する場所を選択中" : "報告内容を入力中"}
            </p>
            <p className="mt-0.5 text-xs font-bold" style={{ color: C.inkSoft }}>
              {isSelecting
                ? "地図をタップして場所を決めてね"
                : "内容を確認して送信してね"}
            </p>
          </div>
        </div>
      )}

      {/* 下部中央: 報告ドック（デスクトップ）。主CTAと現在地報告を1列にまとめ、迷いをなくす */}
      {showPrimaryCta && (
        <div
          data-map-overlay="bottom"
          className="absolute left-1/2 z-20 flex -translate-x-1/2 transform items-center gap-2"
          style={ctaBottomStyle}
        >
          {onReportAtCurrentLocation && (
            <button
              type="button"
              onClick={onReportAtCurrentLocation}
              disabled={isReportFormOpen || !!isSelectingLocation || isAcquiringGPS || !isMapReady}
              className={`chunky-press flex h-12 items-center justify-center gap-2 rounded-full border-2 px-4 text-sm font-black disabled:opacity-50 ${tankenTokens.cls.focus}`}
              style={{
                ...floatPill,
                borderColor: "rgba(21,158,114,.35)",
                color: C.primaryStrong,
              }}
              aria-label={isAcquiringGPS ? "位置取得中" : "現在地で報告"}
            >
              {isAcquiringGPS ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  位置取得中...
                </>
              ) : (
                <>
                  <MapPinPlus className="h-4 w-4" strokeWidth={2.6} />
                  現在地で報告
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onAddReport}
            disabled={!isMapReady}
            className={`chunky-press flex h-14 items-center justify-center gap-2 rounded-full border-2 px-7 text-[15px] font-black disabled:cursor-not-allowed disabled:opacity-55 ${tankenTokens.cls.focus}`}
            style={
              !isReportFormOpen && !isSelectingLocation
                ? {
                    background: C.accent,
                    color: "#fff",
                    borderColor: "rgba(67,57,43,.18)",
                    boxShadow: `${tankenTokens.shadow.pressAccent}, 0 16px 30px -14px rgba(216,102,10,.65)`,
                  }
                : { ...floatPill, color: C.inkSoft, borderColor: "rgba(67,57,43,.14)" }
            }
            aria-label={REPORT_ENTRY_LABEL}
          >
            {isSelectingLocation ? (
              <>
                <MapPin className="h-5 w-5 animate-pulse" strokeWidth={2.6} />
                地点選択中...
              </>
            ) : isReportFormOpen ? (
              <>
                <MapPin className="h-5 w-5" strokeWidth={2.6} />
                入力中...
              </>
            ) : (
              <>
                <PlusCircle className="h-5 w-5" strokeWidth={2.6} />
                {REPORT_ENTRY_LABEL}
              </>
            )}
          </button>
        </div>
      )}

      {/* 凡例（コンパクト版） - 画面下部。絵=種類 / 色=あぶなさ */}
      {showLegend && (
        <div data-map-overlay="bottom" className="absolute left-3 z-10" style={legendBottomStyle}>
          <div className="rounded-full border px-3 py-1.5" style={floatPill}>
            <MapLegendCompact />
          </div>
        </div>
      )}
      {isMobile && <MapMenuSheet open={isMenuOpen} onOpenChange={setIsMenuOpen} />}
    </>
  )
}
