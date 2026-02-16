"use client"

import { MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { DangerReport } from "@/lib/types"
import {
  getDangerTypeLabel,
  getDangerTypeIcon,
  getDangerLevelColor,
  getDangerLevelLabel,
  getStatusLabel,
  getStatusBadgeClass,
  formatAddress,
  formatPostalCode,
  formatCoordinates,
} from "./report-detail-utils"

interface ReportHeroHeaderProps {
  report: DangerReport
}

/**
 * Hero header for the report detail modal.
 * Displays danger level color band, type/level/status badges, title, and address.
 */
export function ReportHeroHeader({ report }: ReportHeroHeaderProps) {
  const levelColor = getDangerLevelColor(report.danger_level)
  const TypeIcon = getDangerTypeIcon(report.danger_type)
  const address = formatAddress(report)
  const postalCode = formatPostalCode(report.postal_code)

  return (
    <div>
      {/* Danger level color band - full width */}
      <div className={`h-2 w-full ${levelColor.band} rounded-t-lg`} />

      {/* Content area */}
      <div className="px-4 md:px-6 pt-4 pb-2 space-y-3">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={`${levelColor.badgeClass} font-semibold`}>
            {getDangerLevelLabel(report.danger_level)}
          </Badge>
          <Badge variant="outline" className="bg-gray-100 gap-1">
            <TypeIcon className="h-3 w-3" />
            {getDangerTypeLabel(report.danger_type)}
          </Badge>
          <Badge variant="outline" className={getStatusBadgeClass(report.status)}>
            {getStatusLabel(report.status)}
          </Badge>
        </div>

        {/* Title */}
        <h2 className="text-xl md:text-2xl font-bold leading-tight">
          {report.title}
        </h2>

        {/* Address line */}
        {(address || postalCode) ? (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span>
              {address}
              {postalCode && (
                <span className="ml-1 text-gray-400">{postalCode}</span>
              )}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span>{formatCoordinates(report.latitude, report.longitude)} 付近</span>
          </div>
        )}
      </div>
    </div>
  )
}
