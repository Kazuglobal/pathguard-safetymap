"use client"

import { Car } from "lucide-react"
import AccidentStatsPanel, { AccidentStatsLoading } from "@/components/danger-report/accident-stats-panel"
import type { AccidentStatsStatus } from "@/hooks/use-accident-stats"
import type { AccidentStats } from "@/lib/traffic-accident-data"
import type { DangerReport } from "@/lib/types"
import { isValidCoordinates } from "@/lib/coordinates"
import { useToast } from "@/components/ui/use-toast"
import { toCoordinateNumber } from "./report-detail-utils"

interface ReportAccidentSectionProps {
  stats: AccidentStats | null
  status: AccidentStatsStatus
  error: string | null
  report: DangerReport
  onAccidentNavigate?: (coords: [number, number]) => void
}

/**
 * Accident statistics section with visual treatment.
 * Wraps the existing AccidentStatsPanel with section header and loading/error states.
 */
export function ReportAccidentSection({
  stats,
  status,
  error,
  report,
  onAccidentNavigate,
}: ReportAccidentSectionProps) {
  const { toast } = useToast()

  if (status === "idle") return null

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white">
      {/* Section header */}
      <div className="px-4 md:px-6 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-800">周辺の交通事故統計</h3>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 md:px-6 pb-4">
        {status === "loading" && <AccidentStatsLoading />}

        {status === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-800">事故統計の取得に失敗しました</p>
            {error && (
              <p className="text-xs text-red-600 mt-1">{error}</p>
            )}
          </div>
        )}

        {status === "loaded" && stats && (
          <AccidentStatsPanel
            stats={stats}
            mode="full"
          />
        )}

      </div>
    </div>
  )
}
