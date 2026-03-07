import type { HazardType, UserRoute } from "@/lib/types"

type RouteHazardVisibility = Record<HazardType, boolean>

type RouteHazardRouteLike = Pick<UserRoute, "route_geometry"> | null

export function getRouteHazardRequestState(
  route: RouteHazardRouteLike,
  visibility: RouteHazardVisibility,
) {
  const hasRouteGeometry = Boolean(route?.route_geometry?.coordinates?.length)
  const hasVisibleLayer = visibility.flood || visibility.tsunami
  const shouldFetch = hasRouteGeometry && hasVisibleLayer

  return {
    shouldFetch,
    isLoading: shouldFetch,
  }
}
