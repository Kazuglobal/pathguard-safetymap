"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Loader2, Download, RefreshCw, AlertCircle, FileText, Image } from "lucide-react"
import { useRouteDangers } from "@/hooks/use-route-dangers"
import {
  generatePDFReport,
  generateImageReport,
  createReportSummary,
  getDangerImageOptions,
  resolveDangerDisplayImageUrl,
} from "@/lib/report-generation/route-danger-report"
import { getDangerLevelPresentation } from "@/lib/report-generation/danger-level-presentation"
import {
  createDangerReportSignedUrl,
  useDangerReportSignedImageUrls,
} from "@/lib/danger-report-image-access"
import { useOptionalSupabase } from "@/components/providers/supabase-provider"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getMapboxToken } from "@/lib/mapbox-config"
import type { UserRoute, DangerReport, ReportExportFormat } from "@/lib/types"

interface RouteDangerReportDialogProps {
  open: boolean
  onClose: () => void
  route: UserRoute
}

function formatDangerLevelBadge(level: number): string {
  const presentation = getDangerLevelPresentation(level)
  return `${presentation.stars} ${presentation.kidLabel}`
}

interface DangerListItemProps {
  danger: DangerReport
  index: number
  selectedImageUrl?: string
  onImageSelectionChange: (dangerId: string, imageUrl: string) => void
  supabase: SupabaseClient | null
}

function DangerListItem({
  danger,
  index,
  selectedImageUrl,
  onImageSelectionChange,
  supabase,
}: DangerListItemProps) {
  const imageOptions = getDangerImageOptions(danger)
  const activeImageUrl =
    selectedImageUrl ?? resolveDangerDisplayImageUrl(danger) ?? undefined

  // danger-reports バケットは非公開のため、サムネイル表示用に保存済みの公開URLを
  // 署名URLへ差し替える(選択値=RadioGroupItem value は保存済みURLのまま維持し、
  // handleDownload 側の署名処理と対応させる)。
  const optionUrls = useMemo(() => imageOptions.map((option) => option.url), [imageOptions])
  const signedThumbnailUrls = useDangerReportSignedImageUrls(supabase, optionUrls)

  return (
    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
      <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-primary/10 text-primary text-xs font-medium rounded-full">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm truncate">{danger.title}</span>
          <Badge
            variant={getDangerLevelPresentation(danger.danger_level).badgeVariant}
            className="shrink-0"
          >
            {formatDangerLevelBadge(danger.danger_level)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{danger.danger_type}</p>
        {danger.description && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
            {danger.description}
          </p>
        )}
        {imageOptions.length > 0 && (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium text-foreground">表示写真の選択</p>
            <RadioGroup
              value={activeImageUrl}
              onValueChange={(value) => onImageSelectionChange(danger.id, value)}
              className="grid gap-2"
            >
              {imageOptions.map((option, optionIndex) => {
                const optionId = `${danger.id}-image-${optionIndex}`
                const thumbnailUrl = signedThumbnailUrls[optionIndex] ?? null
                return (
                  <label
                    key={option.url}
                    htmlFor={optionId}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <RadioGroupItem value={option.url} id={optionId} />
                    {thumbnailUrl ? (
                      <img
                        src={thumbnailUrl}
                        alt={option.label}
                        className="h-14 w-20 rounded-md object-cover"
                      />
                    ) : (
                      <div
                        className="h-14 w-20 flex-shrink-0 rounded-md bg-muted"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-xs font-medium text-foreground">{option.label}</span>
                  </label>
                )
              })}
            </RadioGroup>
          </div>
        )}
      </div>
    </div>
  )
}

export function RouteDangerReportDialog({
  open,
  onClose,
  route,
}: RouteDangerReportDialogProps) {
  const { dangers, isLoading, error, refetch } = useRouteDangers(route.id)
  const supabase = useOptionalSupabase()?.supabase ?? null
  const [exportFormat, setExportFormat] = useState<ReportExportFormat>("pdf")
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [selectedImageUrls, setSelectedImageUrls] = useState<Record<string, string>>({})
  const [includeSchoolSummary, setIncludeSchoolSummary] = useState(false)

  const summary = useMemo(() => createReportSummary(dangers), [dangers])

  useEffect(() => {
    setSelectedImageUrls((prev) => {
      const next: Record<string, string> = {}
      let hasChanges = false

      for (const [dangerId, imageUrl] of Object.entries(prev)) {
        const matchedDanger = dangers.find((danger) => danger.id === dangerId)
        if (!matchedDanger) {
          hasChanges = true
          continue
        }

        const isStillValid = getDangerImageOptions(matchedDanger).some(
          (option) => option.url === imageUrl
        )
        if (!isStillValid) {
          hasChanges = true
          continue
        }

        next[dangerId] = imageUrl
      }

      if (!hasChanges && Object.keys(next).length === Object.keys(prev).length) {
        return prev
      }

      return next
    })
  }, [dangers])

  const handleImageSelectionChange = useCallback((dangerId: string, imageUrl: string) => {
    setSelectedImageUrls((prev) => ({
      ...prev,
      [dangerId]: imageUrl,
    }))
  }, [])

  const handleDownload = useCallback(async () => {
    setIsExporting(true)
    setExportError(null)

    try {
      const mapboxToken = getMapboxToken()
      if (!mapboxToken) {
        throw new Error("Mapboxトークンが設定されていません")
      }

      // danger-reports バケットは非公開化済み。DB保存済みの公開URLはそのままでは
      // 4xx になるため、表示予定の画像を短TTLの署名URLへ差し替える。署名できない
      // ものは保存済みURLのまま渡り、生成側で読込失敗プレースホルダに落ちる。
      const signedImageUrls: Record<string, string> = {}
      if (supabase) {
        const storedUrls = new Set<string>()
        for (const danger of dangers) {
          const stored = resolveDangerDisplayImageUrl(danger, selectedImageUrls)
          if (stored) storedUrls.add(stored)
        }
        await Promise.all(
          Array.from(storedUrls).map(async (stored) => {
            const signed = await createDangerReportSignedUrl(supabase, stored)
            if (signed) signedImageUrls[stored] = signed
          })
        )
      }

      const report = {
        route,
        dangers,
        bufferMeters: 100,
        generatedAt: new Date().toISOString(),
        summary,
        selectedImageUrls,
        includeSchoolSummary,
        signedImageUrls,
      }

      let blob: Blob
      let filename: string

      if (exportFormat === "pdf") {
        blob = await generatePDFReport(report, mapboxToken)
        filename = `${route.name}_危険箇所レポート.pdf`
      } else {
        blob = await generateImageReport(report, mapboxToken, exportFormat)
        filename = `${route.name}_危険箇所レポート.${exportFormat}`
      }

      // Create download link
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "エクスポートに失敗しました")
    } finally {
      setIsExporting(false)
    }
  }, [route, dangers, summary, exportFormat, selectedImageUrls, includeSchoolSummary, supabase])

  const handleRetry = useCallback(() => {
    refetch()
  }, [refetch])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            危険箇所レポート: {route.name}
          </DialogTitle>
          <DialogDescription>
            ルート周辺100m以内の危険箇所をまとめたレポートを生成します
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loading State */}
          {isLoading && (
            <div
              data-testid="loading-spinner"
              className="flex flex-col items-center justify-center py-8"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-sm text-muted-foreground">危険箇所を検索中...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive mb-2" />
              <p className="text-sm text-destructive mb-4">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                再試行
              </Button>
            </div>
          )}

          {/* Content */}
          {!isLoading && !error && (
            <>
              {/* Summary */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="font-medium mb-2">
                  検出された危険箇所: {summary.totalDangers}件
                </p>
                {summary.totalDangers > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(summary.byLevel).map(([level, count]) => (
                      <Badge
                        key={level}
                        variant={getDangerLevelPresentation(parseInt(level, 10)).badgeVariant}
                      >
                        {formatDangerLevelBadge(parseInt(level, 10))}: {count}件
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger List */}
              {dangers.length > 0 ? (
                <ScrollArea className="h-48">
                  <div className="space-y-2 pr-4">
                    {dangers.map((danger, index) => (
                      <DangerListItem
                        key={danger.id}
                        danger={danger}
                        index={index}
                        selectedImageUrl={selectedImageUrls[danger.id]}
                        onImageSelectionChange={handleImageSelectionChange}
                        supabase={supabase}
                      />
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>このルート付近に危険箇所は見つかりませんでした</p>
                </div>
              )}

              {/* Export Format Selector */}
              {dangers.length > 0 && (
                <div data-testid="format-selector" className="space-y-2">
                  <Label className="text-sm font-medium">出力形式</Label>
                  <RadioGroup
                    value={exportFormat}
                    onValueChange={(value) => setExportFormat(value as ReportExportFormat)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pdf" id="format-pdf" />
                      <Label htmlFor="format-pdf" className="flex items-center gap-1 cursor-pointer">
                        <FileText className="h-4 w-4" />
                        PDF
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="png" id="format-png" />
                      <Label htmlFor="format-png" className="flex items-center gap-1 cursor-pointer">
                        <Image className="h-4 w-4" />
                        PNG
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="jpeg" id="format-jpeg" />
                      <Label htmlFor="format-jpeg" className="flex items-center gap-1 cursor-pointer">
                        <Image className="h-4 w-4" />
                        JPEG
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* School Summary Opt-in */}
              {dangers.length > 0 && (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="include-school-summary"
                    checked={includeSchoolSummary}
                    onCheckedChange={(checked) =>
                      setIncludeSchoolSummary(checked === true)
                    }
                  />
                  <div className="grid gap-0.5">
                    <Label
                      htmlFor="include-school-summary"
                      className="cursor-pointer text-sm font-medium"
                    >
                      学校・地域共有用サマリーページを含める
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      写真・詳細説明を除いた1ページをレポート末尾に追加します
                    </p>
                  </div>
                </div>
              )}

              {/* Export Error */}
              {exportError && (
                <p className="text-sm text-destructive">{exportError}</p>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            閉じる
          </Button>
          <Button
            onClick={handleDownload}
            disabled={isLoading || dangers.length === 0 || isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                ダウンロード
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
