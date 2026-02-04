"use client"

import { Button } from "@/components/ui/button"
import { MapPin, Car, Shield, AlertTriangle, HelpCircle, Trophy, PlusCircle, Navigation, List } from "lucide-react"
import MapStyleSelector from "./map-style-selector"
import Map3DToggle from "./map-3d-toggle"
import HelpDialog from "./help-dialog"
import { useGamification } from "@/hooks/use-gamification"

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
}: MapFloatingControlsProps) {
  const { points, level } = useGamification()
  const isSelecting = !!isSelectingLocation
  const showPrimaryCta = !isMobile || !isSelecting
  // 検索バーが上部にあるため、コントロールは検索バーの下に配置
  const topInsetStyle = { top: "calc(env(safe-area-inset-top, 0px) + 4rem)" }
  const topSecondaryStyle = { top: "calc(env(safe-area-inset-top, 0px) + 7.5rem)" }
  const ctaBottomStyle = {
    bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)" : "6rem",
  }
  const legendBottomStyle = {
    bottom: isMobile ? "calc(env(safe-area-inset-bottom, 0px) + 5rem)" : "1.5rem",
  }

  return (
    <>
      {/* 左上: 地図スタイル切り替えボタン群 */}
      <div
        className="absolute left-3 z-20 flex flex-col gap-2"
        style={topInsetStyle}
      >
        {/* 地図スタイルセレクター */}
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/80 overflow-hidden">
          <MapStyleSelector currentStyle={mapStyle} onChange={setMapStyle} />
        </div>

        {/* 3Dとボタン */}
        <div className="flex gap-2">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/80">
            <Map3DToggle
              is3DEnabled={is3DEnabled}
              onToggle={toggle3DMode}
              size="sm"
              className="h-10 px-4"
            />
          </div>

          {/* ARボタン */}
          {onToggleAR && (
            <Button
              onClick={onToggleAR}
              variant={isARMode ? "default" : "outline"}
              size="sm"
              aria-pressed={isARMode}
              className={`h-10 px-4 backdrop-blur-sm shadow-lg border ${
                isARMode
                  ? "bg-sky-600 text-white border-sky-600 hover:bg-sky-700"
                  : "bg-white/95 border-gray-200/80 hover:bg-gray-50"
              }`}
              aria-label="ARビューを開く"
            >
              <Navigation className="h-4 w-4 mr-1" />
              AR
            </Button>
          )}
        </div>
      </div>

      {/* 右上: ユーザー情報とヘルプ */}
      <div
        className="absolute right-3 z-20 flex items-center gap-2"
        style={topInsetStyle}
      >
        {/* ポイント・レベル表示 */}
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-full px-3 py-2 shadow-lg border border-gray-200/80">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-medium text-gray-700">{points}pt</span>
          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
            <span className="text-xs font-bold text-blue-600">L{level}</span>
          </div>
        </div>

        {/* ヘルプボタン */}
        <HelpDialog>
          <Button
            size="sm"
            variant="outline"
            className="h-10 w-10 p-0 rounded-full bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200/80 hover:bg-gray-50"
            aria-label="アプリの使い方を表示"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </HelpDialog>
      </div>

      {/* 右側: 一覧ボタン（モバイル用） */}
      {isMobile && onToggleSidebar && (
        <div className="absolute right-3 z-20" style={topSecondaryStyle}>
          <Button
            onClick={onToggleSidebar}
            variant="outline"
            size="sm"
            className="h-10 px-3 bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200/80 hover:bg-gray-50"
          >
            <List className="h-4 w-4 mr-1" />
            一覧
          </Button>
        </div>
      )}

      {/* 下部中央: 報告ボタン（メインCTA） */}
      {showPrimaryCta && (
        <div
          className="absolute left-1/2 transform -translate-x-1/2 z-20"
          style={ctaBottomStyle}
        >
          <Button
            onClick={onAddReport}
            variant={isReportFormOpen || isSelectingLocation ? "secondary" : "default"}
            size="lg"
            className={`
              h-14 px-6 rounded-full shadow-xl
              ${!isReportFormOpen && !isSelectingLocation
                ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                : "bg-white/95 backdrop-blur-sm border border-gray-200"
              }
            `}
            aria-label="危険箇所を報告する"
          >
            {isSelectingLocation ? (
              <>
                <MapPin className="mr-2 h-5 w-5 animate-pulse" />
                地点選択中...
              </>
            ) : isReportFormOpen ? (
              <>
                <MapPin className="mr-2 h-5 w-5" />
                入力中...
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-5 w-5" />
                報告
              </>
            )}
          </Button>
        </div>
      )}

      {/* 危険種別レジェンド（コンパクト版） - 画面下部 */}
      <div className="absolute left-3 z-10" style={legendBottomStyle}>
        <div className="flex gap-1 bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-md border border-gray-200/60">
          <div className="flex items-center gap-1 px-1.5" title="交通危険">
            <Car className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-xs text-gray-600 hidden sm:inline">交通</span>
          </div>
          <div className="flex items-center gap-1 px-1.5" title="犯罪危険">
            <Shield className="h-3.5 w-3.5 text-red-600" />
            <span className="text-xs text-gray-600 hidden sm:inline">犯罪</span>
          </div>
          <div className="flex items-center gap-1 px-1.5" title="災害危険">
            <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-xs text-gray-600 hidden sm:inline">災害</span>
          </div>
          <div className="flex items-center gap-1 px-1.5" title="その他">
            <HelpCircle className="h-3.5 w-3.5 text-gray-500" />
            <span className="text-xs text-gray-600 hidden sm:inline">他</span>
          </div>
        </div>
      </div>
    </>
  )
}
