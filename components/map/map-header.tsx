"use client"

import { Button } from "@/components/ui/button"
import { MapPin, Car, Shield, AlertTriangle, HelpCircle, Trophy, PlusCircle } from "lucide-react"

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
}: MapHeaderProps) {
  const { points, level } = useGamification()

  return (
    <header className="bg-white border-b z-20 relative">
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
        <div className="grid grid-cols-4 gap-2 sm:flex sm:items-center sm:space-x-4 sm:gap-0">
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
    </header>
  )
}
