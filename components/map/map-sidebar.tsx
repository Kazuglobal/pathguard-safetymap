"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChevronLeft, ChevronRight, AlertTriangle, MapPin, Trash2 } from "lucide-react"
import type { DangerReport } from "@/lib/types"
import { formatDate } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"

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
}: MapSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

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

  const getDangerLevelClass = (level: number) => {
    switch (level) {
      case 1:
        return "bg-green-100 text-green-800 border-green-200"
      case 2:
        return "bg-lime-100 text-lime-800 border-lime-200"
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

  return (
    <div
      className={`relative bg-white border-r border-gray-200 transition-all duration-300 ${
        isCollapsed ? "w-12" : "w-80"
      } flex flex-col h-full`}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-4 top-2 z-10 h-8 w-8 rounded-full border border-gray-200 bg-white shadow-sm"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {!isCollapsed && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-bold text-lg mb-2">危険箇所一覧</h2>
            <Tabs defaultValue="list">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="list">リスト</TabsTrigger>
                <TabsTrigger value="filter">フィルター</TabsTrigger>
              </TabsList>
              <TabsContent value="list" className="mt-2">
                <p className="text-sm text-gray-500 mb-2">
                  {dangerReports.length > 0
                    ? `${dangerReports.length}件の危険箇所が報告されています`
                    : "報告された危険箇所はありません"}
                </p>
              </TabsContent>
              <TabsContent value="filter" className="mt-2 space-y-3">
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
                        className={`relative mb-2 cursor-pointer hover:shadow-md transition-shadow border-blue-200 bg-blue-50 ${
                          selectedReport?.id === report.id ? "ring-2 ring-blue-500" : ""
                        }`}
                        onClick={() => onReportSelect(report)}
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
                            <Badge variant="secondary" className="text-xs">
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
                        className={`relative mb-2 cursor-pointer hover:shadow-md transition-shadow ${
                          selectedReport?.id === report.id ? "ring-2 ring-blue-500" : ""
                        }`}
                        onClick={() => onReportSelect(report)}
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
                            <Badge variant="secondary" className="text-xs">
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
