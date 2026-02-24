"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, ChevronRight, AlertTriangle, MapPin, Trash2, Car, Shield, HelpCircle, X, RotateCcw } from "lucide-react"
import type { DangerReport } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { useMediaQuery } from "@/hooks/use-media-query"

interface MapSidebarProps {
  dangerReports: DangerReport[]
  pendingReports?: DangerReport[] // 審査中の報告を追加
  isLoading: boolean
  selectedReport: DangerReport | null
  onFilterChange: (filters: any) => void
  filterOptions: {
    dangerType: string
    dangerLevel: string
    dateRange: string
    showPending: boolean // 審査中の報告を表示するかどうかのフラグを追加
  }
  onReportSelect: (report: DangerReport) => void
  isAdmin?: boolean // 管理者フラグ（オプショナル）
  onDeleteReport?: (reportId: string) => Promise<void> // 削除関数（オプショナル）
  isMobile?: boolean // モバイル表示フラグ
  onClose?: () => void // モバイルでサイドバーを閉じる関数
}

export default function MapSidebar({
  dangerReports,
  pendingReports = [], // デフォルト値を空配列に
  isLoading,
  selectedReport,
  onFilterChange,
  filterOptions,
  onReportSelect,
  isAdmin = false,
  onDeleteReport,
  isMobile = false,
  onClose,
}: MapSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isMobileDevice = useMediaQuery("(max-width: 768px)")
  const isMobileView = isMobile || isMobileDevice

  // フィルターの状態を計算
  const getActiveFiltersCount = () => {
    let count = 0
    if (filterOptions.dangerType !== "all") count++
    if (filterOptions.dangerLevel !== "all") count++
    if (filterOptions.dateRange !== "all") count++
    if (filterOptions.showPending) count++
    return count
  }

  const hasActiveFilters = getActiveFiltersCount() > 0

  const resetFilters = () => {
    onFilterChange({
      dangerType: "all",
      dangerLevel: "all", 
      dateRange: "all",
      showPending: true
    })
  }

  const getDangerTypeLabel = (type: string) => {
    switch (type) {
      case "traffic":
        return "交通危険"
      case "crime":
        return "犯罪危険"
      case "disaster":
        return "災害危険"
      case "other":
        return "その他"
      default:
        return type
    }
  }

  const getDangerTypeIcon = (type: string) => {
    switch (type) {
      case "traffic":
        return <Car className="h-4 w-4 text-blue-600" />
      case "crime":
        return <Shield className="h-4 w-4 text-red-600" />
      case "disaster":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case "other":
        return <HelpCircle className="h-4 w-4 text-gray-600" />
      default:
        return <HelpCircle className="h-4 w-4 text-gray-600" />
    }
  }

  const getDangerLevelClass = (level: number) => {
    switch (level) {
      case 1:
        return "bg-green-100 text-green-800 border-green-200"
      case 2:
        return "bg-green-100 text-green-800 border-green-200"
      case 3:
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case 4:
        return "bg-orange-100 text-orange-800 border-orange-200"
      case 5:
        return "bg-red-100 text-red-800 border-red-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  // 危険度の色分け（マップマーカー用）
  const getDangerLevelColor = (level: number) => {
    switch (level) {
      case 1:
        return "#22c55e" // green-500
      case 2:
        return "#22c55e" // green-500
      case 3:
        return "#eab308" // yellow-500
      case 4:
        return "#f97316" // orange-500
      case 5:
        return "#ef4444" // red-500
      default:
        return "#6b7280" // gray-500
    }
  }

  // 危険度のボーダー色（カード用）
  const getDangerLevelBorderColor = (level: number) => {
    switch (level) {
      case 1:
        return "border-l-green-500"
      case 2:
        return "border-l-green-500"
      case 3:
        return "border-l-yellow-500"
      case 4:
        return "border-l-orange-500"
      case 5:
        return "border-l-red-500"
      default:
        return "border-l-gray-500"
    }
  }

  return (
    <div
      className={`relative bg-white border-r border-gray-200 transition-all duration-300 ${
        isCollapsed ? "w-12" : isMobileView ? "w-full" : "w-80"
      } flex flex-col h-full`}
    >
      {/* 折りたたみボタン（デスクトップのみ） */}
      {!isMobileView && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-4 top-2 z-10 h-8 w-8 rounded-full border border-gray-200 bg-white shadow-sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      )}
      
      {/* モバイル用閉じるボタン */}
      {isMobileView && onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full border border-gray-200 bg-white shadow-sm"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {(!isCollapsed || isMobileView) && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-bold text-lg mb-2">危険箇所一覧</h2>
            <Tabs defaultValue="list">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="list">リスト</TabsTrigger>
                <TabsTrigger value="filter" className="relative">
                  フィルター
                  {hasActiveFilters && (
                    <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs flex items-center justify-center">
                      {getActiveFiltersCount()}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="list" className="mt-2">
                <p className="text-sm text-gray-500 mb-2">
                  {dangerReports.length > 0
                    ? `${dangerReports.length}件の危険箇所が報告されています`
                    : "報告された危険箇所はありません"}
                </p>
              </TabsContent>
              <TabsContent value="filter" className="mt-2 space-y-3">
                {/* フィルターリセットボタン */}
                {hasActiveFilters && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-600">
                      {getActiveFiltersCount()}個のフィルターが適用中
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetFilters}
                      className="h-8 px-2 text-xs"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      リセット
                    </Button>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium">危険タイプ</label>
                  <Select
                    value={filterOptions.dangerType}
                    onValueChange={(value) => onFilterChange({ dangerType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="すべて" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="traffic">交通危険</SelectItem>
                      <SelectItem value="crime">犯罪危険</SelectItem>
                      <SelectItem value="disaster">災害危険</SelectItem>
                      <SelectItem value="other">その他</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="showPending"
                      checked={filterOptions.showPending}
                      onCheckedChange={(checked) => onFilterChange({ showPending: checked === true })}
                    />
                    <label htmlFor="showPending" className="text-sm font-medium cursor-pointer">
                      自分の審査中の報告を表示
                    </label>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">危険度</label>
                  <Select
                    value={filterOptions.dangerLevel}
                    onValueChange={(value) => onFilterChange({ dangerLevel: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="すべて" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="1">レベル1（軽度）</SelectItem>
                      <SelectItem value="2">レベル2</SelectItem>
                      <SelectItem value="3">レベル3（中度）</SelectItem>
                      <SelectItem value="4">レベル4</SelectItem>
                      <SelectItem value="5">レベル5（重度）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">期間</label>
                  <Select
                    value={filterOptions.dateRange}
                    onValueChange={(value) => onFilterChange({ dateRange: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="すべて" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべて</SelectItem>
                      <SelectItem value="week">1週間以内</SelectItem>
                      <SelectItem value="month">1ヶ月以内</SelectItem>
                      <SelectItem value="year">1年以内</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {isLoading ? (
              // ローディング状態
              Array.from({ length: 3 }).map((_, index) => (
                <Card key={index} className="mb-2">
                  <CardContent className="p-3">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))
            ) : dangerReports.length > 0 || (filterOptions.showPending && pendingReports.length > 0) ? (
              // 危険箇所リスト
              <>
                {/* 審査中の報告 */}
                {filterOptions.showPending && pendingReports.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-blue-600 mb-2 px-1">あなたの審査中の報告</h3>
                    {pendingReports.map((report) => (
                      <Card
                        key={report.id}
                        className={`relative mb-2 cursor-pointer hover:shadow-md transition-shadow border-blue-200 bg-blue-50 border-l-4 ${getDangerLevelBorderColor(report.danger_level)} ${
                          selectedReport?.id === report.id ? "ring-2 ring-blue-500" : ""
                        } active:scale-95 touch-manipulation`}
                        onClick={() => onReportSelect(report)}
                        role="button"
                        tabIndex={0}
                        aria-label={`${report.title} - ${getDangerTypeLabel(report.danger_type)} - 危険度レベル${report.danger_level}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onReportSelect(report);
                          }
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center">
                                <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded mr-2">
                                  審査中
                                </span>
                                <h3 className="font-medium text-sm line-clamp-1">{report.title}</h3>
                              </div>
                              <div className="flex items-center text-xs text-gray-500 mt-1">
                                <MapPin className="h-3 w-3 mr-1" />
                                <span className="line-clamp-1">
                                  {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                                </span>
                              </div>
                            </div>
                            <Badge variant="outline" className={getDangerLevelClass(report.danger_level)}>
                              {report.danger_level}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              {getDangerTypeIcon(report.danger_type)}
                              {getDangerTypeLabel(report.danger_type)}
                            </Badge>
                            <span className="text-xs text-gray-500">{formatDate(report.created_at)}</span>
                          </div>
                        </CardContent>
                        {isAdmin && onDeleteReport && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 text-red-500 hover:bg-red-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteReport(report.id);
                            }}
                            title="この報告を削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </Card>
                    ))}
                  </div>
                )}

                {/* 承認済みの報告 */}
                {dangerReports.length > 0 && (
                  <div>
                    {filterOptions.showPending && pendingReports.length > 0 && (
                      <h3 className="text-sm font-medium text-gray-600 mb-2 px-1">承認済みの報告</h3>
                    )}
                    {dangerReports.map((report) => (
                      <Card
                        key={report.id}
                        className={`relative mb-2 cursor-pointer hover:shadow-md transition-shadow border-l-4 ${getDangerLevelBorderColor(report.danger_level)} ${
                          selectedReport?.id === report.id ? "ring-2 ring-blue-500" : ""
                        } active:scale-95 touch-manipulation`}
                        onClick={() => onReportSelect(report)}
                        role="button"
                        tabIndex={0}
                        aria-label={`${report.title} - ${getDangerTypeLabel(report.danger_type)} - 危険度レベル${report.danger_level}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onReportSelect(report);
                          }
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium text-sm line-clamp-1">{report.title}</h3>
                              <div className="flex items-center text-xs text-gray-500 mt-1">
                                <MapPin className="h-3 w-3 mr-1" />
                                <span className="line-clamp-1">
                                  {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                                </span>
                              </div>
                            </div>
                            <Badge variant="outline" className={getDangerLevelClass(report.danger_level)}>
                              {report.danger_level}
                            </Badge>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              {getDangerTypeIcon(report.danger_type)}
                              {getDangerTypeLabel(report.danger_type)}
                            </Badge>
                            <span className="text-xs text-gray-500">{formatDate(report.created_at)}</span>
                          </div>
                        </CardContent>
                        {isAdmin && onDeleteReport && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 text-red-500 hover:bg-red-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteReport(report.id);
                            }}
                            title="この報告を削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </>
            ) : (
              // データがない場合
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
                <p className="text-gray-600">危険箇所の報告がありません</p>
                <p className="text-sm text-gray-500 mt-1">
                  フィルター条件を変更するか、新しい危険箇所を報告してください
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
