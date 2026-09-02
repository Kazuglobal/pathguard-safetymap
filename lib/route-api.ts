import type { userRoutes } from '@/lib/db/schema'
import type { RouteWriteInput } from '@/lib/db/repos/routes.repo'

type UserRouteRow = typeof userRoutes.$inferSelect

function optionalNullableString(body: Record<string, unknown>, key: string): string | null | undefined {
  const value = body[key]
  if (typeof value === 'string') return value
  if (value === null) return null
  return undefined
}

export function parseRouteWriteInput(value: unknown): RouteWriteInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RangeError('Invalid route body')
  const body = value as Record<string, unknown>
  return {
    name: typeof body.name === 'string' ? body.name : undefined,
    description: optionalNullableString(body, 'description'),
    childId: optionalNullableString(body, 'child_id'),
    childName: optionalNullableString(body, 'child_name'),
    startLat: body.start_lat == null ? undefined : Number(body.start_lat),
    startLng: body.start_lng == null ? undefined : Number(body.start_lng),
    endLat: body.end_lat == null ? undefined : Number(body.end_lat),
    endLng: body.end_lng == null ? undefined : Number(body.end_lng),
    startAddress: typeof body.start_address === 'string' ? body.start_address : undefined,
    endAddress: typeof body.end_address === 'string' ? body.end_address : undefined,
    routeGeometry: body.route_geometry && typeof body.route_geometry === 'object'
      ? body.route_geometry as Record<string, unknown>
      : body.route_geometry === null ? null : undefined,
    distanceMeters: body.distance_meters == null ? undefined : Number(body.distance_meters),
    estimatedTimeMinutes: body.estimated_time_minutes == null ? undefined : Number(body.estimated_time_minutes),
    isFavorite: typeof body.is_favorite === 'boolean' ? body.is_favorite : undefined,
  }
}

export function toUserRouteJson(route: UserRouteRow) {
  return {
    id: route.id,
    user_id: route.userId,
    name: route.name,
    description: route.description,
    child_id: route.childId,
    child_name: route.childName,
    start_lat: route.startLat,
    start_lng: route.startLng,
    end_lat: route.endLat,
    end_lng: route.endLng,
    start_address: route.startAddress,
    end_address: route.endAddress,
    route_geometry: route.routeGeometry,
    distance_meters: route.distanceMeters,
    estimated_time_minutes: route.estimatedTimeMinutes,
    is_favorite: route.isFavorite,
    created_at: route.createdAt,
    updated_at: route.updatedAt,
  }
}
