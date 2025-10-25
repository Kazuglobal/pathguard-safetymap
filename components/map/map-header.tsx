"use client"

import { Button } from "@/components/ui/button"
import { MapPin, Car, Shield, AlertTriangle, HelpCircle, Trophy, PlusCircle } from "lucide-react"

// Import the MapStyleSelector component
import MapStyleSelector from "./map-style-selector"
import Map3DToggle from "./map-3d-toggle"

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
  const { points } = useGamification()

  return (
    <header className="bg-white border-b z-20 relative">
      {/* メインタイトル行 */}
      <div className="px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">通学路安全マップ</h1>
        {/* ポイント表示と使い方ボタンを横並びに */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-700">{points}pt</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-xs"
          >
            <HelpCircle className="h-3 w-3 mr-1" />
            使い方
          </Button>
        </div>
      </div>

      {/* 危険種別レジェンド（モバイルでは2行に分割） */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:space-x-4 sm:gap-0">
          <div className="flex items-center space-x-1 text-xs py-1">
            <Car className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span>交通危険</span>
          </div>
          <div className="flex items-center space-x-1 text-xs py-1">
            <Shield className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span>犯罪危険</span>
          </div>
          <div className="flex items-center space-x-1 text-xs py-1">
            <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
            <span>災害危険</span>
          </div>
          <div className="flex items-center space-x-1 text-xs py-1">
            <HelpCircle className="h-4 w-4 text-gray-600 flex-shrink-0" />
            <span>その他</span>
          </div>
        </div>
      </div>

      {/* 操作ボタン行 */}
      <div className="px-4 pb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 地図スタイルと3Dボタンを横並びに */}
          <div className="flex gap-2">
            <MapStyleSelector currentStyle={mapStyle} onChange={setMapStyle} />
            <Map3DToggle
              is3DEnabled={is3DEnabled}
              onToggle={toggle3DMode}
              size="sm"
              className="flex-shrink-0"
            />
          </div>

          {/* 報告ボタン */}
          <Button
            onClick={onAddReport}
            variant={isReportFormOpen || isSelectingLocation ? "secondary" : "default"}
            size="sm"
            className="flex-1 sm:flex-initial"
          >
            {isSelectingLocation ? (
              <>
                <MapPin className="mr-2 h-4 w-4 animate-pulse" />
                地点選択中...
              </>
            ) : isReportFormOpen ? (
              "報告フォーム入力中"
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                危険箇所を報告
              </>
            )}
          </Button>
        </div>
      </div>
    </header>
  )
}
