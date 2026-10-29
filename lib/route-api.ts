import { childErrorMessage } from '@/lib/children-api'
import { MAX_CHILDREN_PER_USER } from '@/lib/children-limits'
import type { RouteWriteInput, UserRouteWithChild } from '@/lib/db/repos/routes.repo'

/**
 * 通学路の保存の入力の誤りを、画面に出せる日本語にする(英語の内部メッセージは出さない)。
 * 呼び名から子どもを登録するときの誤り(上限・長さなど)も含む
 */
export function routeErrorMessage(error: RangeError | SyntaxError): string {
  if (error instanceof SyntaxError) return '送った内容を読み取れませんでした。もう一度お試しください'
  switch (error.message) {
    case 'Invalid route body':
    case 'Missing required route fields': return '通学路の名前・出発地・到着地を入れてください'
    case 'Invalid route name': return '通学路の名前は1〜100文字で入れてください'
    case 'Invalid route coordinates': return '出発地・到着地の場所を選び直してください'
    case 'Route description is too long': return 'メモは2000文字までにしてください'
    case 'Route not found': return '通学路が見つかりませんでした'
    case 'Too many children': return `お子さまは${MAX_CHILDREN_PER_USER}人まで登録できます。設定でお子さまを整理してから、もう一度保存してください`
    default: return childErrorMessage(error)
  }
}

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
    // 入力欄の「お子さまの呼び名」。サーバーで children の行に置き換え、通学路には書かない
    childNickname: optionalNullableString(body, 'child_name'),
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

export function toUserRouteJson(route: UserRouteWithChild) {
  return {
    id: route.id,
    user_id: route.userId,
    name: route.name,
    description: route.description,
    child_id: route.childId,
    // 呼び名は children 表から。移行前の行だけ、残っている名前を本人に返す
    child_name: route.childNickname ?? route.childName ?? null,
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
