"use client"

import { Flame, Loader2, AlertCircle, Baby, Footprints } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AccidentHeatmapFilters } from '@/lib/traffic-accident-heatmap'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AccidentHeatmapControlsProps {
  filters: AccidentHeatmapFilters
  onFiltersChange: (patch: Partial<AccidentHeatmapFilters>) => void
  isVisible: boolean
  onToggleVisibility: () => void
  isLoading: boolean
  featureCount: number
  error: string | null
}

// ---------------------------------------------------------------------------
// Year options
// ---------------------------------------------------------------------------

const YEAR_OPTIONS = [2018, 2019, 2020, 2021, 2022, 2023]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Floating control panel for the accident heatmap.
 * Shows toggle, filters (year range, severity, child/pedestrian), and status.
 */
export function AccidentHeatmapControls({
  filters,
  onFiltersChange,
  isVisible,
  onToggleVisibility,
  isLoading,
  featureCount,
  error,
}: AccidentHeatmapControlsProps) {
  return (
    <div className="w-56 max-w-[calc(100vw-1.5rem)] max-h-[calc(100svh-12rem)] sm:max-h-none bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/80 overflow-hidden flex flex-col">
      {/* Header with main toggle */}
      <div className="flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors">
        <button
          type="button"
          onClick={onToggleVisibility}
          className="flex items-center gap-2 text-left"
          aria-label="事故ヒートマップ表示切替"
        >
          <Flame className={`h-4 w-4 ${isVisible ? 'text-red-500' : 'text-gray-400'}`} />
          <span className="text-sm font-medium text-gray-700">事故ヒートマップ</span>
        </button>
        <Switch
          checked={isVisible}
          onCheckedChange={(checked) => {
            if (checked !== isVisible) onToggleVisibility()
          }}
          aria-label="事故ヒートマップ表示切替"
        />
      </div>

      {/* Expanded filters (only when visible) */}
      {isVisible && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-2 overflow-y-auto overscroll-y-contain min-h-0">
          {/* Status bar */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            {isLoading ? (
              <div className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>読み込み中...</span>
              </div>
            ) : (
              <span>{featureCount.toLocaleString()}件表示中</span>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-1.5 p-2 bg-red-50 rounded-md text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{error}</span>
            </div>
          )}

          {/* Year range */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">対象期間</Label>
            <div className="flex items-center gap-1.5">
              <Select
                value={String(filters.minYear)}
                onValueChange={(v) => onFiltersChange({ minYear: Number(v) })}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.filter((y) => y <= filters.maxYear).map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs">{y}年</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-gray-400">〜</span>
              <Select
                value={String(filters.maxYear)}
                onValueChange={(v) => onFiltersChange({ maxYear: Number(v) })}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.filter((y) => y >= filters.minYear).map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs">{y}年</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Severity filter */}
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">重大度</Label>
            <Select
              value={filters.severityFilter}
              onValueChange={(v: 'all' | 'fatal') => onFiltersChange({ severityFilter: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">すべての事故</SelectItem>
                <SelectItem value="fatal" className="text-xs">死亡事故のみ</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Child involvement */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Baby className="h-3.5 w-3.5 text-pink-500" />
              <Label htmlFor="child-filter" className="text-xs text-gray-600 cursor-pointer">
                子供関与のみ
              </Label>
            </div>
            <Switch
              id="child-filter"
              checked={filters.childFilter === true}
              onCheckedChange={(checked) => onFiltersChange({ childFilter: checked ? true : null })}
              className="scale-90"
            />
          </div>

          {/* Pedestrian involvement */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Footprints className="h-3.5 w-3.5 text-blue-500" />
              <Label htmlFor="pedestrian-filter" className="text-xs text-gray-600 cursor-pointer">
                歩行者関与のみ
              </Label>
            </div>
            <Switch
              id="pedestrian-filter"
              checked={filters.pedestrianFilter === true}
              onCheckedChange={(checked) => onFiltersChange({ pedestrianFilter: checked ? true : null })}
              className="scale-90"
            />
          </div>

          {/* Hint */}
          <div className="pt-1 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 leading-tight">
              ズームアウト: ヒートマップ / ズームイン: 個別マーカー
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
