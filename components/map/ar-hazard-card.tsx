"use client"

import { CheckCircle2, BookmarkPlus, MapPin, TreePine } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDistance, formatBearing, type ARHazardData } from "@/lib/ar-utils"
import { getReportImages } from "@/lib/ar-image-utils"
import {
  translateDangerType,
  getDangerLevelLabel,
  getDangerLevelColor,
} from "@/lib/ar-display-utils"
import type { ARLearningContent } from "@/lib/ar-learning-tour"
import type { KidsHazardCue } from "@/lib/ar-learning-tour-kids"
import { ARImageGallery } from "./ar-image-gallery"

interface ARPrimaryHazardCardProps {
  hazard: ARHazardData
  estimatedTimeMinutes: number
  distanceLabel?: string
  estimatedTimeLabel?: string
  learningContent?: ARLearningContent
  childCue?: KidsHazardCue
  isApproaching?: boolean
  progressLabel?: string
  markReviewedLabel?: string
  onMarkReviewed?: () => void
  onSaveForLater?: () => void
}

export function ARPrimaryHazardCard({
  hazard,
  estimatedTimeMinutes,
  distanceLabel,
  estimatedTimeLabel,
  learningContent,
  childCue,
  isApproaching = false,
  progressLabel,
  markReviewedLabel = "確認した",
  onMarkReviewed,
  onSaveForLater,
}: ARPrimaryHazardCardProps) {
  const readableDistance = distanceLabel ?? `${formatDistance(hazard.distance)}先`
  const readableTime = estimatedTimeLabel ?? `${estimatedTimeMinutes}分`

  return (
    <div
      className="absolute top-20 left-4 right-4 z-20 pointer-events-none"
      role="article"
      aria-label={`危険個所: ${hazard.report.title}、${readableDistance}`}
    >
      <div
        className="relative"
      >
        <Card className="max-h-[calc(100vh-8rem)] overflow-x-hidden overflow-y-auto rounded-3xl bg-white shadow-2xl pointer-events-auto">
          <ARImageGallery
            images={getReportImages(hazard.report)}
            alt={hazard.report.title}
          />

          <div className="p-4">
            {progressLabel && (
              <div className="mb-3 flex items-center justify-between">
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                  学習ツアー
                </Badge>
                <span className="text-xs font-semibold text-slate-500">{progressLabel}</span>
              </div>
            )}

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
              {readableDistance}
            </p>

            {childCue && (
              <div
                className={`mb-3 rounded-2xl border p-4 ${
                  isApproaching
                    ? "border-amber-300 bg-slate-950 text-white shadow-lg"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
                role={isApproaching ? "alert" : "note"}
                aria-live={isApproaching ? "assertive" : "polite"}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge
                    variant={isApproaching ? "secondary" : "outline"}
                    className={isApproaching ? "bg-amber-300 text-slate-950" : ""}
                  >
                    {isApproaching ? "いま確認するポイント" : "親子で確認"}
                  </Badge>
                  <span className={`text-xs font-semibold ${isApproaching ? "text-amber-100" : "text-slate-500"}`}>
                    {childCue.dangerKind}
                  </span>
                </div>
                <p className="text-lg font-bold leading-relaxed">{childCue.shortMessage}</p>
                <p className={`mt-2 text-sm leading-6 ${isApproaching ? "text-slate-100" : "text-slate-700"}`}>
                  {childCue.action}
                </p>
              </div>
            )}

            {(onMarkReviewed || onSaveForLater) && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="min-h-11 rounded-xl"
                  onClick={onMarkReviewed}
                  disabled={!onMarkReviewed}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {markReviewedLabel}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 rounded-xl"
                  onClick={onSaveForLater}
                  disabled={!onSaveForLater}
                >
                  <BookmarkPlus className="mr-2 h-4 w-4" />
                  あとで見返す
                </Button>
              </div>
            )}

            {learningContent && (
              <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-500">学習ポイント</p>
                  <p className="mt-1 text-sm leading-6 text-slate-700">{learningContent.summary}</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500">確認すること</p>
                  <ul className="space-y-1.5">
                    {learningContent.checkpoints.map((checkpoint) => (
                      <li key={checkpoint} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="mt-0.5 h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                        <span>{checkpoint}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2">
                  {learningContent.attentionTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="rounded-full bg-slate-200/80 text-slate-700">
                      {tag}
                    </Badge>
                  ))}
                </div>

              </div>
            )}
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
            {readableTime}
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
