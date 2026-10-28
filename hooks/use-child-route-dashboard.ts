"use client"

import { useMemo } from "react"
import { ChildRouteDashboardState, type ChildRouteQuickCheck } from "@/components/landing/child-route-dashboard"
import { useRouteDangers } from "@/hooks/use-route-dangers"
import { useUserRoutes } from "@/hooks/use-user-routes"
import type { DangerReport, UserRoute } from "@/lib/types"

interface ChildRouteDashboardResult {
  state: ChildRouteDashboardState
  childName?: string
  errorMessage?: string
  quickChecks: ChildRouteQuickCheck[]
  retryHref: string
  selectedRoute: UserRoute | null
}

/** 「この30日の注意地点」で数える期間(日)。表示ラベルもこの値から作り、数え方とずれないようにする。 */
const RECENT_DANGER_WINDOW_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 通学路から100m以内の公開報告(useRouteDangers が絞り込み済み)のうち、
 * 投稿日(created_at)が直近 RECENT_DANGER_WINDOW_DAYS 日以内のものだけを数える。
 * useRouteDangers は期間で絞らないので、ここで絞らないと何年も前の報告まで数えてしまう。
 * 投稿日が無い・読めない報告は、いつのものか分からないので数えない。
 */
const countRecentDangers = (dangers: DangerReport[], nowMs: number) => {
  const cutoffMs = nowMs - RECENT_DANGER_WINDOW_DAYS * DAY_MS

  return dangers.filter((danger) => {
    const createdMs = danger.created_at ? Date.parse(danger.created_at) : Number.NaN
    return Number.isFinite(createdMs) && createdMs >= cutoffMs
  }).length
}

/** 所要時間が分かるときだけ「徒歩約N分」を返す(0分以下や数値でない値は出さない)。 */
const formatWalkingTime = (minutes: number | null) => {
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
    return undefined
  }

  return `徒歩約${Math.max(1, Math.round(minutes))}分`
}

export function useChildRouteDashboard(): ChildRouteDashboardResult {
  const {
    routes,
    primaryRoute,
    isLoading: routesLoading,
  } = useUserRoutes()

  const selectedRoute =
    primaryRoute ?? routes.find((route) => route.is_favorite) ?? routes[0] ?? null
  const hasRouteGeometry = Boolean(selectedRoute?.route_geometry)
  const needsSetup = Boolean(selectedRoute && !hasRouteGeometry)
  const routeIdForDangerLookup = hasRouteGeometry && selectedRoute?.id ? selectedRoute.id : ""

  const { dangers, isLoading: dangersLoading, error: dangersError } = useRouteDangers(
    routeIdForDangerLookup,
    100
  )

  const retryHref = selectedRoute?.id
    ? `/map?routeId=${encodeURIComponent(selectedRoute.id)}`
    : "/map"

  const state: ChildRouteDashboardState = routesLoading
    ? "loading"
    : routes.length === 0
      ? "empty"
      : needsSetup
        ? "needs_setup"
        : dangersError
          ? "error"
        : "ready"

  const quickChecks = useMemo<ChildRouteQuickCheck[]>(() => {
    if (state !== "ready" || !selectedRoute) {
      return []
    }

    const recentDangerCount = countRecentDangers(dangers, Date.now())
    const childName = selectedRoute.child_name?.trim()
    const routeLabel = childName ? `${childName}さんの通学路` : "登録した通学路"

    return [
      {
        id: "recent",
        title: `この${RECENT_DANGER_WINDOW_DAYS}日の注意地点`,
        value: `${recentDangerCount}件`,
        href: retryHref,
        description:
          recentDangerCount > 0
            ? `${routeLabel}の近くで、この${RECENT_DANGER_WINDOW_DAYS}日に公開された危険をマップで確認`
            : `${routeLabel}の近くでは、この${RECENT_DANGER_WINDOW_DAYS}日に公開された危険報告はありません`,
      },
      {
        // 通学路は登録済み。所要時間が分かるときだけ「徒歩約N分」を添える(未設定とは出さない)
        id: "route",
        title: "通学路",
        value: "登録済み",
        detail: formatWalkingTime(selectedRoute.estimated_time_minutes),
        href: "/routes",
        description: selectedRoute.name,
      },
    ]
  }, [dangers, retryHref, selectedRoute, state])

  return {
    state: state === "ready" && dangersLoading ? "loading" : state,
    childName: selectedRoute?.child_name?.trim() || undefined,
    errorMessage: dangersError
      ? "時間をおいて再試行するか、マップで通学路を確認してください。"
      : undefined,
    quickChecks,
    retryHref,
    selectedRoute,
  }
}
