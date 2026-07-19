"use client"

import type { MapDisplayOption } from "@/lib/map-display-options"
import { MapPin, Car, Shield, AlertTriangle, HelpCircle, Trophy, PlusCircle, List, Loader2, Crosshair } from "lucide-react"
import MapStyleSelector from "./map-style-selector"
import HelpDialog from "./help-dialog"
import { useGamification } from "@/hooks/use-gamification"
import { getMapDisplayDockBottomOffset } from "@/lib/map-overlay-ui"
import { tankenTokens } from "@/lib/design/tanken"

const C = tankenTokens.color

/** 地図の上に浮く紙のピル(共通スタイル) */
const floatPill = {
  background: "rgba(255,253,247,.95)",
  borderColor: "rgba(67,57,43,.12)",
  boxShadow: tankenTokens.shadow.float,
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
} as const

interface MapFloatingControlsProps {
  onAddReport: () => void
  isReportFormOpen: boolean
  mapStyle: string
  setMapStyle: (style: string) => void
  is3DEnabled: boolean
  toggle3DMode: () => void
  isSelectingLocation?: boolean
  onToggleAR?: () => void
  isARMode?: boolean
  onToggleSidebar?: () => void
  isMobile?: boolean
  onReportAtCurrentLocation?: () => void
  isAcquiringGPS?: boolean
  onToggleHeatmap?: () => void
  isHeatmapVisible?: boolean
  displayOverlayOptions?: MapDisplayOption[]
  isMapReady?: boolean
}

export default function MapFloatingControls({
  onAddReport,
  isReportFormOpen,
  mapStyle,
  setMapStyle,
  is3DEnabled,
  toggle3DMode,
  isSelectingLocation,
  onToggleAR,
  isARMode = false,
  onToggleSidebar,
  isMobile = false,
  onReportAtCurrentLocation,
  isAcquiringGPS = false,
  onToggleHeatmap,
  isHeatmapVisible = false,
  displayOverlayOptions,
  isMapReady = true,
}: MapFloatingControlsProps) {
  const { points, level } = useGamification()
  const isSelecting = !!isSelectingLocation
  const showPrimaryCta = !isMobile
  const mobileBottomNavClearance = "calc(env(safe-area-inset-bottom, 0px) + 5rem)"
  const ctaBottomStyle = {
    bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" : "6rem",
  }
  const displayDockBottomStyle = {
    bottom: getMapDisplayDockBottomOffset(isMobile),
  }
  const legendBottomStyle = {
    bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 5rem)" : "1.5rem",
  }
  // 地点選択中はポータルの下部確認バーが案内を担うため、ここでは出さない(案内の三重化を防ぐ)
  const showMobileFocusedDock = isMobile && isReportFormOpen && !isSelecting
  const showMobileActionDock = isMobile && !showMobileFocusedDock
  const showLegend = !isMobile

  return (
    <>
      {/* 右上: ユーティリティ */}
      <div
        className="absolute right-3 z-20 flex flex-col items-end gap-1.5 sm:gap-2 top-[calc(env(safe-area-inset-top,0px)+8.5rem)] md:top-[calc(env(safe-area-inset-top,0px)+7.75rem)]"
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
              className="flex h-5 w-5 items-center justify-center rounded-full sm:h-6 sm:w-6"
              style={{ background: C.primarySoft }}
            >
              <span className="text-[10px] font-black sm:text-xs" style={{ color: C.primaryStrong }}>
                L{level}
              </span>
            </div>
          </div>

          {/* ヘルプボタン */}
          {!isMobile && (
            <HelpDialog>
              <button
                type="button"
                className={`chunky-press grid h-10 w-10 place-items-center rounded-full border ${tankenTokens.cls.focus}`}
                style={floatPill}
                aria-label="アプリの使い方を表示"
              >
                <HelpCircle className="h-4 w-4" style={{ color: C.inkSoft }} strokeWidth={2.4} />
              </button>
            </HelpDialog>
          )}
        </div>
      </div>

      {/* 右下: 地図表示ドック */}
      <div
        data-testid="map-display-dock"
        className="absolute right-3 z-20"
        style={displayDockBottomStyle}
      >
        <div className="overflow-hidden rounded-full border" style={floatPill}>
          <MapStyleSelector
            currentStyle={mapStyle}
            onChange={setMapStyle}
            buttonClassName="h-11 rounded-full border-0 px-4 shadow-none bg-transparent font-black"
            compactLabel={false}
            buttonLabel="表示"
            isMobile={isMobile}
            overlayOptions={displayOverlayOptions}
          />
        </div>
      </div>

      {/* 下部: モバイル主要アクションドック */}
      {showMobileActionDock && (
        <div
          data-testid="mobile-action-dock"
          className="absolute inset-x-3 z-20"
          style={{ bottom: mobileBottomNavClearance }}
        >
          <div
            className="grid grid-cols-3 gap-2 rounded-[22px] border p-2"
            style={floatPill}
          >
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
                    <Crosshair className="h-4 w-4" strokeWidth={2.6} />
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
              aria-label="危険箇所を報告する"
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
                  <Crosshair className="h-4 w-4" strokeWidth={2.6} />
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
            aria-label="危険箇所を報告する"
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
                危険箇所を報告
              </>
            )}
          </button>
        </div>
      )}

      {/* 危険種別レジェンド（コンパクト版） - 画面下部 */}
      {showLegend && (
        <div className="absolute left-3 z-10" style={legendBottomStyle}>
          <div className="flex gap-1 rounded-full border px-2 py-1.5" style={floatPill}>
            <div className="flex items-center gap-1 px-1.5" title="交通危険">
              <Car className="h-3.5 w-3.5" style={{ color: "#3E8FB8" }} />
              <span className="hidden text-xs font-bold sm:inline" style={{ color: C.inkSoft }}>交通</span>
            </div>
            <div className="flex items-center gap-1 px-1.5" title="犯罪危険">
              <Shield className="h-3.5 w-3.5" style={{ color: C.danger }} />
              <span className="hidden text-xs font-bold sm:inline" style={{ color: C.inkSoft }}>犯罪</span>
            </div>
            <div className="flex items-center gap-1 px-1.5" title="災害危険">
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: C.accent }} />
              <span className="hidden text-xs font-bold sm:inline" style={{ color: C.inkSoft }}>災害</span>
            </div>
            <div className="flex items-center gap-1 px-1.5" title="その他">
              <HelpCircle className="h-3.5 w-3.5" style={{ color: C.inkFaint }} />
              <span className="hidden text-xs font-bold sm:inline" style={{ color: C.inkSoft }}>他</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
