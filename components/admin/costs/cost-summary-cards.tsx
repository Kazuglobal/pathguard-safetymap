"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProviderCost } from "@/components/admin/costs/cost-dashboard"

interface CostSummaryCardsProps {
  readonly providers: readonly ProviderCost[]
}

const PROVIDER_CONFIG = {
  gemini: {
    label: "Gemini",
    color: "#3b82f6",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    iconBg: "bg-blue-100",
  },
  openai: {
    label: "OpenAI",
    color: "#22c55e",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    textColor: "text-green-700",
    iconBg: "bg-green-100",
  },
  mapbox: {
    label: "Mapbox",
    color: "#f97316",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    textColor: "text-orange-700",
    iconBg: "bg-orange-100",
  },
} as const

function getProgressColor(percentage: number): string {
  if (percentage >= 100) return "bg-red-500"
  if (percentage >= 80) return "bg-orange-500"
  if (percentage >= 50) return "bg-yellow-500"
  return "bg-green-500"
}

function getAlertBanner(
  percentage: number,
  threshold: number
): { message: string; className: string } | null {
  if (percentage >= 100) {
    return {
      message: "予算超過: コストが予算の100%を超えました",
      className: "bg-red-100 border-red-300 text-red-800",
    }
  }
  if (percentage >= threshold) {
    return {
      message: `警告: コストが予算の${Math.round(percentage)}%に達しました`,
      className: "bg-yellow-100 border-yellow-300 text-yellow-800",
    }
  }
  return null
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`
}

function formatRequestCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`
  }
  return count.toLocaleString()
}

export default function CostSummaryCards({ providers }: CostSummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {providers.map((provider) => {
        const config = PROVIDER_CONFIG[provider.provider]
        const budgetPercentage =
          provider.budget_usd > 0
            ? (provider.total_cost_usd / provider.budget_usd) * 100
            : 0
        const alert = getAlertBanner(budgetPercentage, provider.alert_threshold_percent)
        const progressColor = getProgressColor(budgetPercentage)

        return (
          <Card key={provider.provider}>
            <CardHeader className="pb-3">
              {alert && (
                <div
                  className={`-mx-6 -mt-6 mb-3 rounded-t-2xl border-b px-4 py-2 text-xs font-medium ${alert.className}`}
                >
                  {alert.message}
                </div>
              )}
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  {config.label}
                </CardTitle>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.iconBg} ${config.textColor}`}
                >
                  API
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Cost display */}
              <div>
                <p className="text-3xl font-bold tabular-nums">
                  {formatCurrency(provider.total_cost_usd)}
                </p>
                <p className="text-sm text-muted-foreground">
                  リクエスト数: {formatRequestCount(provider.request_count)}
                </p>
              </div>

              {/* Budget progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">予算進捗</span>
                  <span className="font-medium tabular-nums">
                    {formatCurrency(provider.total_cost_usd)} / {formatCurrency(provider.budget_usd)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                    style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                  />
                </div>
                <p className="text-right text-xs text-muted-foreground tabular-nums">
                  {Math.round(budgetPercentage)}%
                </p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
