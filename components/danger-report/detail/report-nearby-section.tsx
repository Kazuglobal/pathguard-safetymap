"use client"

import { MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { DangerReport } from "@/lib/types"
import type { NearbyReport } from "@/lib/nearby-reports"
import { formatNearbyDistance } from "@/lib/nearby-reports"
import { formatDangerLevelBadgeText, getDangerLevelPresentation } from "@/lib/report-generation/danger-level-presentation"
import { getDangerTypeLabel, getDangerTypeIcon } from "./report-detail-utils"

interface ReportNearbySectionProps {
  nearbyReports: NearbyReport[]
  onReportSelect?: (report: DangerReport) => void
}

/**
 * 「この近くの他の報告」セクション。
 * 事故統計セクション(ReportAccidentSection)と同じ300m円で検索した
 * 近隣の危険報告・不審者情報を近い順に表示する。
 * タップでその報告の詳細に切り替える(モーダルは開いたまま)。
 */
export function ReportNearbySection({
  nearbyReports,
  onReportSelect,
}: ReportNearbySectionProps) {
  if (nearbyReports.length === 0) return null

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white">
      {/* Section header */}
      <div className="px-4 md:px-6 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-800">
            この近くの他の報告({nearbyReports.length}件)
          </h3>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-4 space-y-2">
        {nearbyReports.map(({ report, distanceM }) => {
          const TypeIcon = getDangerTypeIcon(report.danger_type)
          const presentation = getDangerLevelPresentation(report.danger_level)
          return (
            <button
              key={report.id}
              type="button"
              onClick={() => onReportSelect?.(report)}
              disabled={!onReportSelect}
              className={`w-full flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-3 text-left ${
                onReportSelect
                  ? "cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99]"
                  : "cursor-default"
              }`}
              aria-label={`${report.title} - ${getDangerTypeLabel(report.danger_type)} - ${formatNearbyDistance(distanceM)}`}
            >
              <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100">
                <TypeIcon className="h-4 w-4 text-gray-600" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">
                    {report.title}
                  </span>
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${presentation.badgeClass}`}
                  >
                    {formatDangerLevelBadgeText(report.danger_level)}
                  </Badge>
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {getDangerTypeLabel(report.danger_type)} ・ {formatNearbyDistance(distanceM)}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
