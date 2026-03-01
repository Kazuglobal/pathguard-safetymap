"use client"

import { Calendar, ExternalLink, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { DangerReport } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { formatCoordinates } from "./report-detail-utils"

interface ReportMetadataBarProps {
  report: DangerReport
}

/**
 * Compact metadata bar displaying date, coordinates, and Google Maps link.
 * Replaces the old sidebar Card with a horizontal layout.
 */
export function ReportMetadataBar({ report }: ReportMetadataBarProps) {
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}`

  return (
    <div className="px-4 md:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-600 py-3 border-y border-gray-100">
        {/* Date */}
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-gray-400" />
          <span>{formatDate(report.created_at)}</span>
        </div>

        <Separator orientation="vertical" className="h-4 hidden sm:block" />

        {/* Coordinates */}
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-gray-400" />
          <span className="font-mono text-xs">
            {formatCoordinates(report.latitude, report.longitude)}
          </span>
        </div>

        <Separator orientation="vertical" className="h-4 hidden sm:block" />

        {/* Google Maps link */}
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-blue-600 hover:text-blue-800 font-normal"
          asChild
        >
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 mr-1" />
            Google Maps
          </a>
        </Button>
      </div>
    </div>
  )
}
