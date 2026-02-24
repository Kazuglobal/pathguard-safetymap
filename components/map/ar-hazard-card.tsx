"use client"

import { MapPin, TreePine } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistance, formatBearing, type ARHazardData } from "@/lib/ar-utils"
import { getReportImages } from "@/lib/ar-image-utils"
import {
  translateDangerType,
  getDangerLevelLabel,
  getDangerLevelColor,
} from "@/lib/ar-display-utils"
import { ARImageGallery } from "./ar-image-gallery"

interface ARPrimaryHazardCardProps {
  hazard: ARHazardData
  estimatedTimeMinutes: number
}

export function ARPrimaryHazardCard({
  hazard,
  estimatedTimeMinutes,
}: ARPrimaryHazardCardProps) {
  return (
    <div
      className="absolute top-20 left-4 right-4 z-20 pointer-events-none"
      role="article"
      aria-label={`危険個所: ${hazard.report.title}、${formatDistance(hazard.distance)}先`}
    >
      <div
        className="relative"
        style={{
          transform: "perspective(1000px) rotateX(5deg) rotateY(-5deg)",
          transformStyle: "preserve-3d",
        }}
      >
        <Card className="bg-white rounded-3xl shadow-2xl overflow-hidden pointer-events-auto">
          <ARImageGallery
            images={getReportImages(hazard.report)}
            alt={hazard.report.title}
          />

          <div className="p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {hazard.report.title}
            </h3>

            <div className="flex items-center gap-3 mb-2">
              <Badge
                className="text-xs text-white"
                style={{ backgroundColor: getDangerLevelColor(hazard.report.danger_level) }}
              >
                {getDangerLevelLabel(hazard.report.danger_level)}
              </Badge>
              <span className="text-xs text-gray-500">·</span>
              <Badge variant="secondary" className="text-xs">
                {translateDangerType(hazard.report.danger_type)}
              </Badge>
            </div>

            <p className="text-sm text-gray-600 mb-3">
              {formatDistance(hazard.distance)}先
            </p>
          </div>
        </Card>

        {/* 方向指示（This way バブル） */}
        {Math.abs(hazard.relativeAngle) > 15 && (
          <div
            className="absolute top-4 flex items-center gap-2 pointer-events-auto"
            style={{
              left: hazard.relativeAngle > 0 ? "auto" : "16px",
              right: hazard.relativeAngle > 0 ? "16px" : "auto",
            }}
            role="status"
            aria-label={`危険個所は${hazard.relativeAngle > 0 ? "右" : "左"}方向です`}
          >
            <MapPin className="h-4 w-4 text-red-500" aria-hidden="true" />
            <div className="bg-gray-800/95 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg">
              {hazard.relativeAngle > 0 ? "右方向" : "左方向"}
            </div>
          </div>
        )}
      </div>

      {/* 距離と時間のマーカー */}
      <div className="relative mt-4 pointer-events-auto">
        <div
          className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-white/70"
          style={{
            top: "-8px",
            height: "40px",
          }}
        />

        <div className="flex items-center justify-center gap-2 pt-8" aria-label={`徒歩で約${estimatedTimeMinutes}分`}>
          <div className="bg-white rounded-full p-2 shadow-lg border-2 border-green-500">
            <TreePine className="h-5 w-5 text-green-600" aria-hidden="true" />
          </div>
          <div className="bg-black/90 text-white px-3 py-1.5 rounded-full text-sm font-semibold shadow-lg">
            {estimatedTimeMinutes}分
          </div>
        </div>
      </div>
    </div>
  )
}

interface ARSecondaryHazardCardProps {
  hazard: ARHazardData
}

export function ARSecondaryHazardCard({ hazard }: ARSecondaryHazardCardProps) {
  return (
    <div className="absolute bottom-4 left-4 right-4 z-20 pointer-events-none" role="complementary" aria-label="次の危険個所">
      <Card className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg pointer-events-auto">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-gray-900 truncate">
              {hazard.report.title}
            </h4>
          </div>
          <div className="flex items-center gap-3 ml-3 text-xs text-gray-500">
            <span className="font-medium">{formatDistance(hazard.distance)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatBearing(hazard.bearing)}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
