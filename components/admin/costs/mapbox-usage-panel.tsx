"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface MapboxApiUsage {
  readonly api_name: string
  readonly request_count: number
  readonly free_tier_limit: number
}

function getUsageColor(percentage: number): string {
  if (percentage >= 90) return "bg-red-500"
  if (percentage >= 70) return "bg-orange-500"
  if (percentage >= 50) return "bg-yellow-500"
  return "bg-green-500"
}

function getUsageBadgeClass(percentage: number): string {
  if (percentage >= 90) return "bg-red-100 text-red-800"
  if (percentage >= 70) return "bg-orange-100 text-orange-800"
  if (percentage >= 50) return "bg-yellow-100 text-yellow-800"
  return "bg-green-100 text-green-800"
}

function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`
  }
  return count.toLocaleString()
}

export default function MapboxUsagePanel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usageData, setUsageData] = useState<readonly MapboxApiUsage[]>([])

  const fetchUsage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/costs/mapbox-usage")
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? `APIエラー: ${response.status}`)
      }
      setUsageData(Array.isArray(data) ? data : [])
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mapbox使用量の取得に失敗しました"
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Mapbox 公式使用量</CardTitle>
            <CardDescription>Mapbox APIごとの使用量と無料枠の消費状況</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsage} disabled={loading}>
            {loading ? "更新中..." : "更新"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )}

        {!loading && !error && usageData.length === 0 && (
          <p className="text-sm text-muted-foreground">使用量データがありません。</p>
        )}

        {!loading && usageData.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">API名</th>
                  <th className="pb-3 pr-4 text-right font-medium">リクエスト数</th>
                  <th className="pb-3 pr-4 text-right font-medium">無料枠上限</th>
                  <th className="pb-3 pr-4 text-right font-medium">使用率</th>
                  <th className="pb-3 font-medium min-w-[140px]">進捗</th>
                </tr>
              </thead>
              <tbody>
                {usageData.map((api) => {
                  const percentage =
                    api.free_tier_limit > 0
                      ? (api.request_count / api.free_tier_limit) * 100
                      : 0
                  const usageColor = getUsageColor(percentage)
                  const badgeClass = getUsageBadgeClass(percentage)

                  return (
                    <tr key={api.api_name} className="border-b last:border-b-0">
                      <td className="py-3 pr-4 font-medium">{api.api_name}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatCount(api.request_count)}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">
                        {formatCount(api.free_tier_limit)}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
                        >
                          {Math.round(percentage)}%
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${usageColor}`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
