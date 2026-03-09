"use client"

import { useState } from 'react'
import { Flame, Loader2, AlertCircle, Baby, Footprints, Users, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
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
  isMobile?: boolean
}

// ---------------------------------------------------------------------------
// Year options
// ---------------------------------------------------------------------------

const YEAR_OPTIONS = [2018, 2019, 2020, 2021, 2022, 2023]

function countActiveFilters(filters: AccidentHeatmapFilters) {
  let count = 0

  if (filters.minYear !== YEAR_OPTIONS[0] || filters.maxYear !== YEAR_OPTIONS[YEAR_OPTIONS.length - 1]) {
    count += 1
  }
  if (filters.severityFilter !== 'all') {
    count += 1
  }
  if (filters.childFilter) {
    count += 1
  }
  if (filters.youngFilter) {
    count += 1
  }
  if (filters.pedestrianFilter) {
    count += 1
  }

  return count
}

function HeatmapFilterBody({
  filters,
  onFiltersChange,
  isMobile,
  isVisible,
  isLoading,
  featureCount,
  error,
}: Pick<
  AccidentHeatmapControlsProps,
  'filters' | 'onFiltersChange' | 'isMobile' | 'isVisible' | 'isLoading' | 'featureCount' | 'error'
>) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-gray-500">
        {!isVisible ? (
          <span>ヒートマップは非表示です</span>
        ) : isLoading ? (
          <div className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>読み込み中...</span>
          </div>
        ) : (
          <span>{featureCount.toLocaleString()}件表示中</span>
        )}
      </div>

      {isVisible && error && (
        <div className="flex items-start gap-1.5 rounded-md bg-red-50 p-2 text-xs text-red-600">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">対象期間</Label>
        <div className="flex items-center gap-1.5">
          <Select
            value={String(filters.minYear)}
            onValueChange={(v) => onFiltersChange({ minYear: Number(v) })}
          >
            <SelectTrigger className="h-8 flex-1 text-xs">
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
            <SelectTrigger className="h-8 flex-1 text-xs">
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

      <div className="space-y-1.5">
        <Label className="text-xs text-gray-500">重大度</Label>
        {isMobile ? (
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="重大度">
            <Button
              type="button"
              variant={filters.severityFilter === 'all' ? 'default' : 'outline'}
              className="h-9 text-xs"
              aria-pressed={filters.severityFilter === 'all'}
              onClick={() => onFiltersChange({ severityFilter: 'all' })}
            >
              すべての事故
            </Button>
            <Button
              type="button"
              variant={filters.severityFilter === 'fatal' ? 'default' : 'outline'}
              className="h-9 text-xs"
              aria-pressed={filters.severityFilter === 'fatal'}
              onClick={() => onFiltersChange({ severityFilter: 'fatal' })}
            >
              死亡事故のみ
            </Button>
          </div>
        ) : (
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
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Baby className="h-3.5 w-3.5 text-pink-500" />
          <Label htmlFor="child-filter" className="cursor-pointer text-xs text-gray-600">
            子ども関与（補充票確認分）のみ
          </Label>
        </div>
        <Switch
          id="child-filter"
          checked={filters.childFilter === true}
          onCheckedChange={(checked) => onFiltersChange({ childFilter: checked ? true : null })}
          className="scale-90"
        />
      </div>
      <p className="text-[10px] leading-tight text-gray-400 -mt-2">
        ※ 子ども関与は補充票確認分で判定
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-orange-500" />
          <Label htmlFor="young-filter" className="cursor-pointer text-xs text-gray-600">
            若年者関与（24歳以下コード）のみ
          </Label>
        </div>
        <Switch
          id="young-filter"
          checked={filters.youngFilter === true}
          onCheckedChange={(checked) => onFiltersChange({ youngFilter: checked ? true : null })}
          className="scale-90"
        />
      </div>
      <p className="text-[10px] leading-tight text-gray-400 -mt-2">
        ※ 若年者関与は警察庁オープンデータの年齢区分コードで判定
      </p>

      <p className="text-[10px] leading-tight text-gray-400 -mt-2">
        ※ 同時選択時は両方の条件に一致する事故のみ表示
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Footprints className="h-3.5 w-3.5 text-blue-500" />
          <Label htmlFor="pedestrian-filter" className="cursor-pointer text-xs text-gray-600">
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

      <div className="border-t border-gray-100 pt-1">
        <p className="text-[10px] leading-tight text-gray-400">
          ズームアウト: ヒートマップ / ズームイン: 個別マーカー
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Floating control panel for the accident heatmap.
 * Shows toggle, filters (year range, severity, child/young/pedestrian), and status.
 */
export function AccidentHeatmapControls({
  filters,
  onFiltersChange,
  isVisible,
  onToggleVisibility,
  isLoading,
  featureCount,
  error,
  isMobile = false,
}: AccidentHeatmapControlsProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const activeFilterCount = countActiveFilters(filters)

  if (isMobile) {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          onClick={() => setIsDrawerOpen(true)}
          className={`h-11 rounded-full border px-3 shadow-lg backdrop-blur-sm ${
            isVisible
              ? 'border-red-200 bg-red-50/95 text-red-700 hover:bg-red-100'
              : 'border-gray-200/80 bg-white/95 text-slate-700 hover:bg-white'
          }`}
          aria-label="事故ヒートマップ設定を開く"
        >
          <Flame className={`mr-1 h-4 w-4 ${isVisible ? 'text-red-500' : 'text-slate-500'}`} />
          <span>事故</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2 min-w-5 justify-center bg-white text-slate-700">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
          <DrawerContent className="max-h-[64svh] rounded-t-3xl px-0 pb-6">
            <DrawerHeader className="px-4 text-left">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <DrawerTitle>事故ヒートマップ</DrawerTitle>
                  <DrawerDescription>
                    表示切替と絞り込み条件を設定します
                  </DrawerDescription>
                </div>
                <DrawerClose asChild>
                  <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="事故ヒートマップ設定を閉じる">
                    <X className="h-4 w-4" />
                  </Button>
                </DrawerClose>
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-slate-50/80 px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-slate-900">表示</p>
                  <p className="text-xs text-slate-500">地図上の事故分布を切り替えます</p>
                </div>
                <Switch
                  checked={isVisible}
                  onCheckedChange={(checked) => {
                    if (checked !== isVisible) onToggleVisibility()
                  }}
                  aria-label="事故ヒートマップ表示切替"
                />
              </div>
            </DrawerHeader>

            <div className="overflow-y-auto px-4 pb-2">
              <HeatmapFilterBody
                filters={filters}
                onFiltersChange={onFiltersChange}
                isMobile={isMobile}
                isVisible={isVisible}
                isLoading={isLoading}
                featureCount={featureCount}
                error={error}
              />
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

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
        <div className="min-h-0 overflow-y-auto overscroll-y-contain border-t border-gray-100 px-3 pb-3 pt-2">
          <HeatmapFilterBody
            filters={filters}
            onFiltersChange={onFiltersChange}
            isMobile={isMobile}
            isVisible={isVisible}
            isLoading={isLoading}
            featureCount={featureCount}
            error={error}
          />
        </div>
      )}
    </div>
  )
}
