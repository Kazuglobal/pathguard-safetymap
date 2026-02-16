"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle } from "lucide-react"
import type { DangerReport } from "@/lib/types"
import { ImageZoomOverlay } from "@/components/ui/image-zoom-overlay"
import { useAccidentStats } from "@/hooks/use-accident-stats"
import { ReportHeroHeader } from "./detail/report-hero-header"
import { ReportImageCarousel } from "./detail/report-image-carousel"
import { ReportAdminImageUpload } from "./detail/report-admin-image-upload"
import { ReportMetadataBar } from "./detail/report-metadata-bar"
import { ReportAccidentSection } from "./detail/report-accident-section"

interface ShowImageOptions {
  reportId?: string
  reportTitle?: string | null
  type?: "original" | "processed"
  index?: number
}

interface DangerReportDetailModalProps {
  isOpen: boolean
  onClose: () => void
  report: DangerReport | null
  isAdmin?: boolean
  onShowImage?: (url: string, coords?: [number, number], options?: ShowImageOptions) => void
  onAccidentNavigate?: (coords: [number, number]) => void
}

export default function DangerReportDetailModal({
  isOpen,
  onClose,
  report,
  isAdmin = false,
  onShowImage,
  onAccidentNavigate,
}: DangerReportDetailModalProps) {
  // Zoom overlay state
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null)
  const [processedImageUrls, setProcessedImageUrls] = useState<string[]>([])

  // Accident stats
  const {
    stats,
    status: statsStatus,
    fetchStats,
    error: statsError,
    reset: resetAccidentStats,
  } = useAccidentStats()
  const processedUrlsKey = report?.processed_image_urls?.join("|") ?? ""

  useEffect(() => {
    if (!report) {
      setProcessedImageUrls([])
      return
    }

    setProcessedImageUrls(report.processed_image_urls ?? [])
  }, [report?.id, report?.updated_at, processedUrlsKey])

  // Fetch accident stats when report changes
  useEffect(() => {
    resetAccidentStats()
    if (report?.latitude == null || report?.longitude == null) return

    fetchStats({
      latitude: report.latitude,
      longitude: report.longitude,
      radius_meters: 300,
      years: 5,
    })
  }, [report?.id, report?.latitude, report?.longitude, fetchStats, resetAccidentStats])

  if (!report) return null
  const reportForDisplay: DangerReport = {
    ...report,
    processed_image_urls: processedImageUrls,
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto p-0 gap-0">
        {/* Accessible title/description (visually hidden) */}
        <DialogTitle className="sr-only">{report.title}</DialogTitle>
        <DialogDescription className="sr-only">
          危険箇所レポートの詳細情報と画像
        </DialogDescription>

        {/* 1. Hero Header */}
        <ReportHeroHeader report={report} />

        {/* 2. Image Carousel */}
        <div className="pt-2 pb-3">
          <ReportImageCarousel
            report={reportForDisplay}
            onShowImage={onShowImage}
            onZoomImage={setZoomImageUrl}
          />
        </div>

        {/* 3. Admin Image Upload (collapsed) */}
        {isAdmin && (
          <ReportAdminImageUpload
            report={reportForDisplay}
            isAdmin={isAdmin}
            onProcessedUrlsChange={setProcessedImageUrls}
          />
        )}

        {/* 4. Description */}
        {report.description && (
          <div className="px-4 md:px-6 py-3">
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
              {report.description}
            </p>
          </div>
        )}

        {/* 5. Metadata Bar */}
        <ReportMetadataBar report={report} />

        {/* 6. Accident Statistics */}
        <ReportAccidentSection
          stats={stats}
          status={statsStatus}
          error={statsError}
          report={report}
          onAccidentNavigate={onAccidentNavigate}
        />

        {/* 7. Disclaimer Footer */}
        <div className="px-4 md:px-6 py-3 border-t border-gray-100">
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-md p-2.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
            <p>
              この情報は一般ユーザーからの報告に基づいています。状況は変化している可能性があります。
            </p>
          </div>
        </div>
      </DialogContent>

      <ImageZoomOverlay
        src={zoomImageUrl ?? ""}
        alt="拡大画像"
        isOpen={!!zoomImageUrl}
        onClose={() => setZoomImageUrl(null)}
      />
    </Dialog>
  )
}
