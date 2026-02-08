"use client"

import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import {
  DISTANCE_MIN,
  DISTANCE_MAX,
  DISTANCE_STEP,
  FOV_MIN,
  FOV_MAX,
  FOV_STEP,
} from "@/lib/ar-constants"

interface ARSettingsPanelProps {
  maxDistance: number
  onMaxDistanceChange: (value: number) => void
  fov: number
  onFovChange: (value: number) => void
  permissions: {
    camera: boolean
    location: boolean
    orientation: boolean
  }
}

export function ARSettingsPanel({
  maxDistance,
  onMaxDistanceChange,
  fov,
  onFovChange,
  permissions,
}: ARSettingsPanelProps) {
  return (
    <div id="ar-settings-panel" className="absolute top-16 right-4 z-30 w-72">
      <Card className="bg-white/95 backdrop-blur-sm p-4 shadow-2xl" role="region" aria-labelledby="ar-settings-heading">
        <h3 id="ar-settings-heading" className="text-sm font-semibold text-gray-900 mb-3">AR設定</h3>

        {/* 表示距離 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-600">表示距離</label>
            <span className="text-xs font-medium text-gray-900">{maxDistance}m</span>
          </div>
          <Slider
            value={[maxDistance]}
            onValueChange={(values) => onMaxDistanceChange(values[0])}
            min={DISTANCE_MIN}
            max={DISTANCE_MAX}
            step={DISTANCE_STEP}
            className="w-full"
            aria-label={`表示距離 ${maxDistance}メートル`}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{DISTANCE_MIN}m</span>
            <span>{DISTANCE_MAX}m</span>
          </div>
        </div>

        {/* 視野角 */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-600">視野角</label>
            <span className="text-xs font-medium text-gray-900">{fov}°</span>
          </div>
          <Slider
            value={[fov]}
            onValueChange={(values) => onFovChange(values[0])}
            min={FOV_MIN}
            max={FOV_MAX}
            step={FOV_STEP}
            className="w-full"
            aria-label={`視野角 ${fov}度`}
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{FOV_MIN}°</span>
            <span>{FOV_MAX}°</span>
          </div>
        </div>

        {/* パーミッション状態 */}
        <div className="pt-3 border-t border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 mb-2">パーミッション</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span>カメラ</span>
              <span
                className={permissions.camera ? "text-green-600" : "text-red-600"}
                role="status"
                aria-label={permissions.camera ? "カメラ許可済み" : "カメラ未許可"}
              >
                {permissions.camera ? "✓ 許可" : "✗ 未許可"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>位置情報</span>
              <span
                className={permissions.location ? "text-green-600" : "text-red-600"}
                role="status"
                aria-label={permissions.location ? "位置情報許可済み" : "位置情報未許可"}
              >
                {permissions.location ? "✓ 許可" : "✗ 未許可"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>方向検出</span>
              <span
                className={permissions.orientation ? "text-green-600" : "text-orange-600"}
                role="status"
                aria-label={permissions.orientation ? "方向検出許可済み" : "方向検出未使用"}
              >
                {permissions.orientation ? "✓ 許可" : "△ 未使用"}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
