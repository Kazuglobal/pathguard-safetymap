"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, ArrowRight, BookmarkPlus, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDistance, formatBearing, type ARHazardData } from "@/lib/ar-utils"
import { getReportImageEntries } from "@/lib/ar-image-utils"
import {
  translateDangerType,
  getDangerLevelLabel,
  getDangerLevelColor,
} from "@/lib/ar-display-utils"
import type { ARLearningContent } from "@/lib/ar-learning-tour"
import type { KidsHazardCue } from "@/lib/ar-learning-tour-kids"
import { ARImageGallery } from "./ar-image-gallery"

/** 正面からこの角度より外れたら、右・左のどちらにあるかを出す */
const DIRECTION_HINT_MIN_ANGLE = 15

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
  /** つぎに回る地点。シートの下に1行で出す */
  nextHazard?: ARHazardData
}

/**
 * ARの「みんなの報告」のシート。カメラの景色を主役にするため画面の下に置き、最初は要点
 * (題名・あぶなさ・方向と距離・確認のボタン)だけを出す。写真と学習ポイントは「くわしく見る」でひらく。
 * 上に大きなカードを置くと、上の切りかえと重なり、景色もほとんど見えなくなる。
 */
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
  nextHazard,
}: ARPrimaryHazardCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const reportId = hazard.report.id
  // 別の報告に切りかわったら、たたんだ状態に戻す(ひらいたままだと、また景色を覆う)
  useEffect(() => {
    setIsExpanded(false)
  }, [reportId])

  const images = getReportImageEntries(hazard.report)
  const readableDistance = distanceLabel ?? `${formatDistance(hazard.distance)}先`
  const readableTime = estimatedTimeLabel ?? `徒歩 約${estimatedTimeMinutes}分`
  const hasDetails = images.length > 0 || Boolean(learningContent)
  const isOffToTheRight = hazard.relativeAngle > 0
  const showDirection = Math.abs(hazard.relativeAngle) > DIRECTION_HINT_MIN_ANGLE
  const DirectionIcon = isOffToTheRight ? ArrowRight : ArrowLeft

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
      role="article"
      aria-label={`危険個所: ${hazard.report.title}、${readableDistance}`}
    >
      <Card
        data-guide="ar-report-sheet"
        className="pointer-events-auto max-h-[60dvh] overflow-x-hidden overflow-y-auto rounded-3xl bg-white shadow-2xl"
      >
        <div className="p-4">
          {progressLabel && (
            <div className="mb-2 flex items-center justify-between">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                学習ツアー
              </Badge>
              <span className="text-xs font-semibold text-slate-600">{progressLabel}</span>
            </div>
          )}

          <h3 className={`mb-2 text-base font-bold leading-snug text-gray-900 ${isExpanded ? "" : "line-clamp-2"}`}>
            {hazard.report.title}
          </h3>

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge
              className="text-xs text-white"
              style={{ backgroundColor: getDangerLevelColor(hazard.report.danger_level) }}
            >
              {getDangerLevelLabel(hazard.report.danger_level)}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {translateDangerType(hazard.report.danger_type)}
            </Badge>
          </div>

          <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700">
            {showDirection && (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs font-bold text-white"
                role="status"
                aria-label={`危険個所は${isOffToTheRight ? "右" : "左"}方向です`}
              >
                <DirectionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{isOffToTheRight ? "右方向" : "左方向"}</span>
              </span>
            )}
            <span className="font-bold">{readableDistance}</span>
            <span aria-hidden="true">·</span>
            <span>{readableTime}</span>
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
                <span className={`text-xs font-semibold ${isApproaching ? "text-amber-100" : "text-slate-600"}`}>
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
            <div className="grid grid-cols-2 gap-2">
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

          {hasDetails && (
            <button
              type="button"
              className="mt-2 flex min-h-11 w-full items-center justify-center gap-1 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100"
              aria-expanded={isExpanded}
              aria-controls="ar-report-sheet-details"
              onClick={() => setIsExpanded((current) => !current)}
            >
              {isExpanded ? (
                <>
                  とじる
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                </>
              ) : (
                <>
                  くわしく見る{images.length > 0 ? `(写真${images.length}枚)` : ""}
                  <ChevronUp className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </button>
          )}

          {hasDetails && isExpanded && (
            <div id="ar-report-sheet-details" className="mt-2 space-y-3">
              {/* 写真が無い報告では箱を出さない(灰色の箱が景色を隠すだけになる) */}
              {images.length > 0 && (
                <div className="overflow-hidden rounded-2xl">
                  <ARImageGallery
                    images={images.map((image) => image.url)}
                    kinds={images.map((image) => image.kind)}
                    alt={hazard.report.title}
                  />
                </div>
              )}

              {learningContent && (
                <div className="space-y-3 rounded-2xl bg-slate-50 p-3">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-slate-600">学習ポイント</p>
                    <p className="mt-1 text-sm leading-6 text-slate-700">{learningContent.summary}</p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-slate-600">確認すること</p>
                    <ul className="space-y-1.5">
                      {learningContent.checkpoints.map((checkpoint) => (
                        <li key={checkpoint} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
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
          )}

          {nextHazard && (
            <p
              className="mt-2 flex items-center gap-2 border-t border-slate-200 pt-2 text-xs text-slate-600"
              role="complementary"
              aria-label="次の危険個所"
            >
              <span className="shrink-0 font-bold">つぎ</span>
              <span className="min-w-0 flex-1 truncate">{nextHazard.report.title}</span>
              <span className="shrink-0 font-medium">
                {formatDistance(nextHazard.distance)} · {formatBearing(nextHazard.bearing)}
              </span>
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
