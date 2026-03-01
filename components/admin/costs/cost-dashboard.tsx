"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import CostSummaryCards from "@/components/admin/costs/cost-summary-cards"
import CostTrendChart from "@/components/admin/costs/cost-trend-chart"
import CostBreakdownChart from "@/components/admin/costs/cost-breakdown-chart"
import MapboxUsagePanel from "@/components/admin/costs/mapbox-usage-panel"
import BudgetSettingsDialog from "@/components/admin/costs/budget-settings-dialog"

export interface ProviderCost {
  readonly provider: "gemini" | "openai" | "mapbox"
  readonly total_cost_usd: number
  readonly request_count: number
  readonly budget_usd: number
  readonly alert_threshold_percent: number
}

export interface DailyTrend {
  readonly date: string
  readonly gemini: number
  readonly openai: number
  readonly mapbox: number
}

export interface EndpointCost {
  readonly endpoint: string
  readonly cost_usd: number
  readonly request_count: number
}

export interface CostData {
  readonly providers: readonly ProviderCost[]
  readonly daily_trends: readonly DailyTrend[]
  readonly endpoint_breakdown: readonly EndpointCost[]
  readonly total_cost_usd: number
}

type PeriodType = "month" | "day"

function formatDateParam(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

function getMonthOptions(): readonly { readonly value: string; readonly label: string }[] {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = formatDateParam(d)
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
    options.push({ value, label })
  }
  return options
}

export default function CostDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("month")
  const [selectedDate, setSelectedDate] = useState<string>(formatDateParam(new Date()))
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<CostData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const monthOptions = getMonthOptions()

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/admin/costs?period=${selectedPeriod}&date=${selectedDate}`
      )
      if (!response.ok) {
        throw new Error(`APIエラー: ${response.status}`)
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : "データの取得に失敗しました"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [selectedPeriod, selectedDate])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const periodButtons: readonly { readonly key: PeriodType; readonly label: string }[] = [
    { key: "month", label: "月次" },
    { key: "day", label: "日次" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold">コスト管理ダッシュボード</h1>
        <BudgetSettingsDialog />
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Period selector */}
        <div className="flex gap-2">
          {periodButtons.map((btn) => (
            <Button
              key={btn.key}
              variant={selectedPeriod === btn.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPeriod(btn.key)}
            >
              {btn.label}
            </Button>
          ))}
        </div>

        {/* Date selector */}
        <select
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          aria-label="対象月を選択"
        >
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-medium">エラーが発生しました</p>
          <p className="text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={fetchData}>
            再試行
          </Button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-40 animate-pulse rounded-2xl border bg-muted"
              />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-2xl border bg-muted" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-80 animate-pulse rounded-2xl border bg-muted" />
            <div className="h-80 animate-pulse rounded-2xl border bg-muted" />
          </div>
          <div className="h-64 animate-pulse rounded-2xl border bg-muted" />
        </div>
      )}

      {/* Data display */}
      {!loading && data && (
        <div className="space-y-6">
          <CostSummaryCards providers={data.providers} />
          <CostTrendChart dailyTrends={data.daily_trends} />
          <CostBreakdownChart
            providers={data.providers}
            endpointBreakdown={data.endpoint_breakdown}
          />
          <MapboxUsagePanel />
        </div>
      )}
    </div>
  )
}
