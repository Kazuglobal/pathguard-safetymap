"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { UserRoute } from "@/lib/types"

interface RouteComparisonTableProps {
  routes: UserRoute[]
}

function formatDistance(meters: number | null) {
  if (meters === null) return "-"
  if (meters < 1000) return `${meters}m`
  return `${(meters / 1000).toFixed(1)}km`
}

function formatTime(minutes: number | null) {
  if (minutes === null) return "-"
  return `${minutes}分`
}

function getRecommendedRoute(routes: UserRoute[]) {
  return [...routes].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) {
      return a.is_favorite ? -1 : 1
    }

    const aTime = a.estimated_time_minutes ?? Number.POSITIVE_INFINITY
    const bTime = b.estimated_time_minutes ?? Number.POSITIVE_INFINITY
    if (aTime !== bTime) {
      return aTime - bTime
    }

    const aDistance = a.distance_meters ?? Number.POSITIVE_INFINITY
    const bDistance = b.distance_meters ?? Number.POSITIVE_INFINITY
    return aDistance - bDistance
  })[0]
}

export function RouteComparisonTable({ routes }: RouteComparisonTableProps) {
  const recommendedRoute = getRecommendedRoute(routes)

  return (
    <Card data-testid="route-comparison-table" className="border-sky-100 bg-sky-50/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">通学路を比較する</CardTitle>
        <p className="text-sm text-muted-foreground">
          距離と所要時間、今の優先ルートを並べて確認できます。
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {routes.map((route) => (
          <div
            key={route.id}
            data-testid="route-comparison-card"
            className="rounded-2xl border border-white bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{route.name}</p>
                <p className="text-sm text-muted-foreground">
                  {route.is_favorite ? "親が優先しているルート" : "安全性は要確認"}
                </p>
              </div>
              {recommendedRoute?.id === route.id && (
                <Badge className="bg-sky-600 text-white hover:bg-sky-600">おすすめ</Badge>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-muted-foreground">安全性</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {route.is_favorite ? "優先" : "要確認"}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-muted-foreground">距離</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {formatDistance(route.distance_meters)}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <dt className="text-xs text-muted-foreground">所要時間</dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {formatTime(route.estimated_time_minutes)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
