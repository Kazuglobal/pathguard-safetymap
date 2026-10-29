import type { UserRoute } from '@/lib/types'

/**
 * 通学路の「元の線」を、作成した端末の中だけに残す(UIUX改装 項目59)。
 *
 * サーバーには両端を200m以上削った線と、約1kmに丸めた起点・終点、市区町村までの住所しか保存しない
 * (lib/route-privacy.ts)。作った端末では元の線・起点・終点・住所を手元に残し、その端末の画面でだけ
 * 通学路の全体を表示する。ほかの端末では削った線が表示される。
 *
 * - ユーザーごとに別のキーに保存する(同じ端末でアカウントを切り替えても混ざらない)
 * - ログアウトしたら消す(自分でログアウトしたときも、期限切れ・別のタブ・別の端末での退会でログアウトになったときも)。
 *   別のアカウントでログインしたら、ほかのアカウントの分を消す(家族で使う端末に自宅の位置を残さない)
 * - 保存できない環境(プライベートモードなど)では何もしない
 */

const KEY_PREFIX = 'pathguardian:route-full-geometry:v1:'

export interface LocalRouteGeometry {
  start_lat: number
  start_lng: number
  end_lat: number
  end_lng: number
  start_address: string
  end_address: string
  route_geometry: GeoJSON.LineString | null
}

type Store = Record<string, LocalRouteGeometry>

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isLineString(value: unknown): value is GeoJSON.LineString {
  if (!value || typeof value !== 'object') return false
  const line = value as { type?: unknown; coordinates?: unknown }
  return line.type === 'LineString' && Array.isArray(line.coordinates) && line.coordinates.every(
    (position) => Array.isArray(position) && isFiniteNumber(position[0]) && isFiniteNumber(position[1]),
  )
}

function isLocalRouteGeometry(value: unknown): value is LocalRouteGeometry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return isFiniteNumber(entry.start_lat) && isFiniteNumber(entry.start_lng)
    && isFiniteNumber(entry.end_lat) && isFiniteNumber(entry.end_lng)
    && typeof entry.start_address === 'string' && typeof entry.end_address === 'string'
    && (entry.route_geometry === null || isLineString(entry.route_geometry))
}

function readStore(userId: string): Store {
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.fromEntries(Object.entries(parsed).filter(([, entry]) => isLocalRouteGeometry(entry))) as Store
  } catch {
    return {}
  }
}

function writeStore(userId: string, store: Store): void {
  try {
    if (Object.keys(store).length === 0) localStorage.removeItem(keyFor(userId))
    else localStorage.setItem(keyFor(userId), JSON.stringify(store))
  } catch {
    // 保存できなくても通学路の保存そのものは止めない(削った線が表示されるだけ)
  }
}

export function saveLocalRouteGeometry(userId: string, routeId: string, value: LocalRouteGeometry): void {
  if (!isLocalRouteGeometry(value)) return
  writeStore(userId, { ...readStore(userId), [routeId]: value })
}

export function removeLocalRouteGeometry(userId: string, routeId: string): void {
  const store = readStore(userId)
  if (!(routeId in store)) return
  const { [routeId]: _removed, ...rest } = store
  writeStore(userId, rest)
}

/**
 * サーバーの通学路に、この端末に残した元の線を重ねる。ほかの端末で消された通学路の分は手元からも消す
 */
export function mergeLocalRouteGeometry<T extends UserRoute>(userId: string, routes: readonly T[]): T[] {
  const store = readStore(userId)
  const ids = new Set(routes.map((route) => route.id))
  const pruned = Object.fromEntries(Object.entries(store).filter(([routeId]) => ids.has(routeId))) as Store
  if (Object.keys(pruned).length !== Object.keys(store).length) writeStore(userId, pruned)
  return routes.map((route) => {
    const local = pruned[route.id]
    return local ? { ...route, ...local } : route
  })
}

function removeStoredGeometry(keep: (key: string) => boolean): void {
  try {
    const keys: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(KEY_PREFIX) && !keep(key)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // 消せない環境では何もしない
  }
}

/** ログアウトしたときに、この端末に残したすべての元の線を消す */
export function clearAllLocalRouteGeometry(): void {
  removeStoredGeometry(() => false)
}

/** ログインした人の分だけを残し、ほかのアカウントがこの端末に残した元の線を消す */
export function clearOtherUsersLocalRouteGeometry(userId: string): void {
  removeStoredGeometry((key) => key === keyFor(userId))
}
