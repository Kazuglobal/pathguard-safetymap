"use client"

import { Button } from "@/components/ui/button"
import { MapPin, Car, Shield, AlertTriangle, HelpCircle, Trophy, PlusCircle, Navigation } from "lucide-react"

// Import the MapStyleSelector component
import MapStyleSelector from "./map-style-selector"
import Map3DToggle from "./map-3d-toggle"
import HelpDialog from "./help-dialog"

// Gamification hooks
import { useGamification } from "@/hooks/use-gamification"

// Update the interface to include 3D toggle props and isSelectingLocation
interface MapHeaderProps {
  onAddReport: () => void
  isReportFormOpen: boolean
  mapStyle: string
  setMapStyle: (style: string) => void
  is3DEnabled: boolean
  toggle3DMode: () => void
  isSelectingLocation?: boolean
  onToggleAR?: () => void
  isARMode?: boolean
}

// Update the function signature to use the new props
export default function MapHeader({
  onAddReport,
  isReportFormOpen,
  mapStyle,
  setMapStyle,
  is3DEnabled,
  toggle3DMode,
  isSelectingLocation,
  onToggleAR,
  isARMode = false,
}: MapHeaderProps) {
  const { points, level } = useGamification()

  return (
    <header className="bg-white border-b z-20 relative">
      {/* モバイルレイアウト（768px未満） */}
      <div className="md:hidden">
        {/* メインタイトル行 */}
        <div className="px-4 py-2 flex items-center justify-between">
          <h1 className="text-base font-bold text-gray-900 flex-shrink-0">通学路安全マップ</h1>
          {/* ポイント表示と使い方ボタンを横並びに */}
          <div className="flex items-center space-x-3 flex-shrink-0 mobile-header-buttons">
            <div className="flex items-center space-x-1">
              <Trophy className="h-3 w-3 text-yellow-500" />
              <span className="text-xs font-medium text-gray-700">{points}pt</span>
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600">L{level}</span>
              </div>
            </div>
            <HelpDialog>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-1 text-xs whitespace-nowrap"
                aria-label="アプリの使い方を表示"
              >
                <HelpCircle className="h-3 w-3" />
              </Button>
            </HelpDialog>
          </div>
        </div>

        {/* 危険種別レジェンド（モバイルでは2x2グリッド） */}
        <div className="px-4 pb-2">
          <div className="grid grid-cols-4 gap-2">
            <div className="flex flex-col items-center space-y-1 text-xs">
              <Car className="h-3 w-3 text-blue-600" />
              <span className="text-xs">交通</span>
            </div>
            <div className="flex flex-col items-center space-y-1 text-xs">
              <Shield className="h-3 w-3 text-red-600" />
              <span className="text-xs">犯罪</span>
            </div>
            <div className="flex flex-col items-center space-y-1 text-xs">
              <AlertTriangle className="h-3 w-3 text-orange-500" />
              <span className="text-xs">災害</span>
            </div>
            <div className="flex flex-col items-center space-y-1 text-xs">
              <HelpCircle className="h-3 w-3 text-gray-600" />
              <span className="text-xs">その他</span>
            </div>
          </div>
        </div>

        {/* 操作ボタン行 */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
            {/* 地図スタイルと3Dボタンを横並びに */}
            <MapStyleSelector currentStyle={mapStyle} onChange={setMapStyle} />
            <Map3DToggle
              is3DEnabled={is3DEnabled}
              onToggle={toggle3DMode}
              size="sm"
              className="flex-shrink-0"
            />
            {/* ARビューボタン */}
            {onToggleAR && (
              <Button
                onClick={onToggleAR}
                variant={isARMode ? "default" : "outline"}
                size="sm"
                className="flex-shrink-0"
                aria-label="ARビューを開く"
              >
                <Navigation className="h-3 w-3 mr-1" />
                AR
              </Button>
            )}

            {/* 報告ボタン */}
            <Button
              onClick={onAddReport}
              variant={isReportFormOpen || isSelectingLocation ? "secondary" : "default"}
              size="sm"
              className="flex-1 min-w-0"
              aria-label="危険箇所を報告する"
              aria-describedby="report-description"
            >
              {isSelectingLocation ? (
                <>
                  <MapPin className="mr-1 h-3 w-3 animate-pulse" />
                  選択中
                </>
              ) : isReportFormOpen ? (
                "入力中"
              ) : (
                <>
                  <PlusCircle className="mr-1 h-3 w-3" />
                  報告
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* デスクトップレイアウト（768px以上） */}
      <div className="hidden md:block desktop-header">
        <div className="px-6 py-3 flex items-center justify-between">
          {/* 左側：タイトルとフィルター */}
          <div className="flex items-center space-x-6">
            <h1 className="text-lg font-bold text-gray-900">通学路安全マップ</h1>
            
            {/* 危険種別フィルター（横並び） */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1 text-sm desktop-filter-item">
                <Car className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">交通</span>
              </div>
              <div className="flex items-center space-x-1 text-sm desktop-filter-item">
                <Shield className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">犯罪</span>
              </div>
              <div className="flex items-center space-x-1 text-sm desktop-filter-item">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">災害</span>
              </div>
              <div className="flex items-center space-x-1 text-sm desktop-filter-item">
                <HelpCircle className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium">その他</span>
              </div>
            </div>
          </div>

          {/* 右側：操作ボタンとユーザー情報 */}
          <div className="flex items-center space-x-4">
            {/* 地図操作ボタン */}
            <div className="flex items-center space-x-2">
              <MapStyleSelector currentStyle={mapStyle} onChange={setMapStyle} />
              <Map3DToggle
                is3DEnabled={is3DEnabled}
                onToggle={toggle3DMode}
                size="sm"
                className="flex-shrink-0"
              />
              {/* ARビューボタン */}
              {onToggleAR && (
                <Button
                  onClick={onToggleAR}
                  variant={isARMode ? "default" : "outline"}
                  size="sm"
                  className="flex-shrink-0"
                  aria-label="ARビューを開く"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  ARビュー
                </Button>
              )}
            </div>

            {/* 報告ボタン */}
            <Button
              onClick={onAddReport}
              variant={isReportFormOpen || isSelectingLocation ? "secondary" : "default"}
              size="sm"
              className={`px-4 desktop-button ${
                !isReportFormOpen && !isSelectingLocation ? "desktop-report-button" : ""
              }`}
              aria-label="危険箇所を報告する"
              aria-describedby="report-description"
            >
              {isSelectingLocation ? (
                <>
                  <MapPin className="mr-2 h-4 w-4 animate-pulse" />
                  選択中
                </>
              ) : isReportFormOpen ? (
                "入力中"
              ) : (
                <>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  報告
                </>
              )}
            </Button>

            {/* ユーザー情報とヘルプ */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 desktop-user-info">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium text-gray-700">{points}pt</span>
                <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">L{level}</span>
                </div>
              </div>
              <HelpDialog>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 desktop-button"
                  aria-label="アプリの使い方を表示"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </HelpDialog>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
