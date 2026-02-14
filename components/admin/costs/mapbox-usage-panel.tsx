"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const MAPBOX_DASHBOARD_URL = "https://account.mapbox.com/"

interface UsageResponse {
  readonly unavailable?: boolean
  readonly message?: string
  readonly dashboardUrl?: string
  readonly error?: string
}

export default function MapboxUsagePanel() {
  const [loading, setLoading] = useState(true)
  const [info, setInfo] = useState<UsageResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchUsage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/costs/mapbox-usage")
      const data: UsageResponse = await response.json()
      if (!response.ok) {
        throw new Error(data?.error ?? `APIエラー: ${response.status}`)
      }
      setInfo(data)
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

  const dashboardUrl = info?.dashboardUrl ?? MAPBOX_DASHBOARD_URL

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Mapbox 使用量</CardTitle>
            <CardDescription>Mapbox APIの使用量と無料枠の消費状況</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={dashboardUrl} target="_blank" rel="noopener noreferrer">
              Mapbox ダッシュボード
            </a>
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
            {[1, 2].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )}

        {!loading && !error && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <p className="font-medium">
              {info?.message ?? "Mapbox は使用量統計の公開 API を提供していません。"}
            </p>
            <p className="mt-1 text-blue-600">
              使用量の確認は{" "}
              <a
                href={dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline hover:text-blue-800"
              >
                Mapbox ダッシュボード &rarr; Statistics
              </a>
              {" "}で行えます。
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
