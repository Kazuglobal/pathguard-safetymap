"use client"

import { useMemo } from "react"
import { ChildRouteDashboardState, type ChildRouteQuickCheck } from "@/components/landing/child-route-dashboard"
import { useRouteDangers } from "@/hooks/use-route-dangers"
import { useUserRoutes } from "@/hooks/use-user-routes"
import type { UserRoute } from "@/lib/types"

interface ChildRouteDashboardResult {
  state: ChildRouteDashboardState
  childName?: string
  quickChecks: ChildRouteQuickCheck[]
  selectedRoute: UserRoute | null
}

const formatMinutes = (minutes: number | null) => {
  if (typeof minutes !== "number" || Number.isNaN(minutes)) {
    return "未設定"
  }

  return `${minutes}分`
}

const formatRelativeTime = (value: string | null) => {
  if (!value) {
    return "更新済み"
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return "更新済み"
  }

  const diff = Date.now() - parsed.getTime()
  const minutes = Math.max(0, Math.floor(diff / 60000))

  if (minutes < 60) {
    return `${minutes}分前`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}時間前`
  }

  return `${Math.floor(hours / 24)}日前`
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

  const { dangers, isLoading: dangersLoading } = useRouteDangers(
    routeIdForDangerLookup,
    100
  )

  const state: ChildRouteDashboardState = routesLoading
    ? "loading"
    : routes.length === 0
      ? "empty"
      : needsSetup
        ? "needs_setup"
        : "ready"

  const quickChecks = useMemo<ChildRouteQuickCheck[]>(() => {
    if (state !== "ready" || !selectedRoute) {
      return []
    }

    const dangerCount = dangers.length
    const childName = selectedRoute.child_name?.trim() || "通学路"

    return [
      {
        id: "today",
        title: "今日の注意地点",
        value: `${dangerCount}件`,
        href: "/report",
        description:
          dangerCount > 0
            ? `${childName}の通学路で確認された危険を先に見る`
            : `${childName}の通学路では新しい危険報告はまだありません`,
      },
      {
        id: "route",
        title: "通学ルート",
        value: formatMinutes(selectedRoute.estimated_time_minutes),
        href: "/routes",
        description: selectedRoute.name,
      },
      {
        id: "update",
        title: "直近の更新",
        value: formatRelativeTime(selectedRoute.updated_at),
        href: "/map",
        description: selectedRoute.description?.trim() || "通学路を再確認できます",
      },
    ]
  }, [dangers.length, selectedRoute, state])

  return {
    state: state === "ready" && dangersLoading ? "loading" : state,
    childName: selectedRoute?.child_name?.trim() || undefined,
    quickChecks,
    selectedRoute,
  }
}
