import { ALL_PREFECTURES } from '@/lib/user-region'

/**
 * 通学路の位置を、自宅・学校が特定できない粗さにしてから保存する(UIUX改装 項目59)。
 *
 * - 道すじ(LineString)は両端をそれぞれ 200m 削る(自宅と学校の前の道を残さない)。
 *   300m 以内の危険の判定は、残った道すじで続ける
 * - 起点・終点の座標は小数2桁(約1km)に丸める
 * - 住所は「都道府県+市区町村」だけにする(番地・郵便番号・座標の文字列は残さない)
 *
 * 作成した端末には元の線を残し、その端末の画面でだけ全体を表示する(lib/route-local-geometry.ts)。
 */

export const ROUTE_END_TRIM_METERS = 200
/** 両端を削ったあとに残す最短の長さ。これより短くなる線は保存しない */
export const ROUTE_MIN_REMAINING_METERS = 50
/** 小数2桁 = 緯度で約1.1km、東京付近の経度で約0.9km */
export const ROUTE_ENDPOINT_DECIMALS = 2
/** 1本の道すじの点の上限(これより多い線は保存しない) */
export const ROUTE_MAX_POINTS = 5_000

/** 「粗く保存」の起点・終点の丸め(小数1桁 = 約10km)。道すじは保存しない */
export const ROUTE_COARSE_ENDPOINT_DECIMALS = 1

/** 位置の保存のしかた(profiles.location_precision) */
export type LocationPrecision = 'standard' | 'coarse'
export const LOCATION_PRECISIONS: readonly LocationPrecision[] = ['standard', 'coarse']

export function isLocationPrecision(value: unknown): value is LocationPrecision {
  return typeof value === 'string' && (LOCATION_PRECISIONS as readonly string[]).includes(value)
}

export const ROUTE_START_FALLBACK_LABEL = '出発地'
export const ROUTE_END_FALLBACK_LABEL = '到着地'

type Position = [number, number]

export function roundCoordinate(value: number, decimals: number = ROUTE_ENDPOINT_DECIMALS): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const EARTH_RADIUS_METERS = 6_371_008.8

function toRadians(value: number): number {
  return (value * Math.PI) / 180
}

/** 2点間の距離(m)。点は [経度, 緯度] */
export function distanceMeters(a: Position, b: Position): number {
  const dLat = toRadians(b[1] - a[1])
  const dLng = toRadians(b[0] - a[0])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)))
}

function lineLength(coordinates: readonly Position[]): number {
  let total = 0
  for (let index = 1; index < coordinates.length; index += 1) total += distanceMeters(coordinates[index - 1]!, coordinates[index]!)
  return total
}

/** 始点から meters だけ進んだところで切り、そこから先の線を返す */
function cutFromStart(coordinates: readonly Position[], meters: number): Position[] {
  let walked = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    const from = coordinates[index - 1]!
    const to = coordinates[index]!
    const segment = distanceMeters(from, to)
    if (walked + segment >= meters) {
      const fraction = segment === 0 ? 0 : (meters - walked) / segment
      const cut: Position = [from[0] + (to[0] - from[0]) * fraction, from[1] + (to[1] - from[1]) * fraction]
      return [cut, ...coordinates.slice(index)]
    }
    walked += segment
  }
  return []
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2
    && typeof value[0] === 'number' && typeof value[1] === 'number'
    && Number.isFinite(value[0]) && Number.isFinite(value[1])
    && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90
}

/**
 * 線の両端をそれぞれ meters だけ削る。削ったあとに ROUTE_MIN_REMAINING_METERS より短くなる線は null
 * (保存しない。300m の判定は丸めた起点・終点で行う)
 */
export function trimLineEnds(coordinates: readonly Position[], meters: number = ROUTE_END_TRIM_METERS): Position[] | null {
  if (coordinates.length < 2 || lineLength(coordinates) < meters * 2 + ROUTE_MIN_REMAINING_METERS) return null
  const fromStart = cutFromStart(coordinates, meters)
  const trimmed = cutFromStart([...fromStart].reverse(), meters).reverse()
  return trimmed.length >= 2 ? trimmed : null
}

/**
 * 保存する道すじ。LineString 以外・点が多すぎる・座標がおかしい線は保存しない(null)。
 * 返す線には削った長さを書き添える(GeoJSON の追加の項目。画面の説明に使える)
 */
export function sanitizeRouteGeometry(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value || value.type !== 'LineString' || !Array.isArray(value.coordinates)) return null
  const coordinates = value.coordinates as unknown[]
  if (coordinates.length > ROUTE_MAX_POINTS || !coordinates.every(isPosition)) return null
  const trimmed = trimLineEnds(coordinates.map((position) => [position[0], position[1]] as Position))
  if (!trimmed) return null
  return { type: 'LineString', coordinates: trimmed, trimmedEndsMeters: ROUTE_END_TRIM_METERS }
}

const MUNICIPALITY_PATTERN = /^([^\s\d,、]+?郡\s*[^\s\d,、]+?[町村]|[^\s\d,、]+?市(?:\s*[^\s\d,、]+?区)?|[^\s\d,、]+?[区町村])/u

/**
 * 住所を「都道府県+市区町村」だけにする。読み取れなければ null(番地や座標の文字列は残さない)。
 * 例: 「〒160-0023 東京都新宿区西新宿2丁目8-1」→「東京都新宿区」、「神奈川県 横浜市 中区 …」→「神奈川県横浜市中区」
 */
export function coarsenAddress(address: string | null | undefined): string | null {
  if (!address) return null
  // 先頭の「日本、」と郵便番号を落とす(「日本橋」などの地名は残す)
  const normalized = address.normalize('NFKC').replace(/^\s*日本[、,\s]*/u, '').replace(/〒?\s*\d{3}-?\d{4}/gu, ' ')
  // いちばん前に出てくる都道府県を使う
  const found = ALL_PREFECTURES
    .map((prefecture) => ({ prefecture, index: normalized.indexOf(prefecture) }))
    .filter((candidate) => candidate.index >= 0)
    .sort((left, right) => left.index - right.index)[0]
  if (!found) return null
  const rest = normalized.slice(found.index + found.prefecture.length).replace(/^[\s,、]+/u, '')
  const municipality = rest.match(MUNICIPALITY_PATTERN)?.[1]
  return municipality ? `${found.prefecture}${municipality.replace(/\s+/gu, '')}` : found.prefecture
}

export interface RouteLocationInput {
  startLat?: number
  startLng?: number
  endLat?: number
  endLng?: number
  startAddress?: string
  endAddress?: string
  routeGeometry?: Record<string, unknown> | null
}

/**
 * 保存の直前に通す。渡された項目だけを粗くする(undefined はそのまま=変えない)。
 * 「粗く保存」では道すじを保存せず、起点・終点は約10kmに丸める(300m の判定は端末の中だけで行う)
 */
export function coarsenRouteLocation<T extends RouteLocationInput>(input: T, precision: LocationPrecision = 'standard'): T {
  if (precision === 'coarse') {
    const standard = coarsenRouteLocation(input)
    const round = (value: number | undefined) => (value === undefined ? undefined : roundCoordinate(value, ROUTE_COARSE_ENDPOINT_DECIMALS))
    return {
      ...standard,
      ...(input.startLat !== undefined ? { startLat: round(input.startLat) } : {}),
      ...(input.startLng !== undefined ? { startLng: round(input.startLng) } : {}),
      ...(input.endLat !== undefined ? { endLat: round(input.endLat) } : {}),
      ...(input.endLng !== undefined ? { endLng: round(input.endLng) } : {}),
      ...(input.routeGeometry !== undefined ? { routeGeometry: null } : {}),
    }
  }
  return {
    ...input,
    ...(input.startLat !== undefined ? { startLat: roundCoordinate(input.startLat) } : {}),
    ...(input.startLng !== undefined ? { startLng: roundCoordinate(input.startLng) } : {}),
    ...(input.endLat !== undefined ? { endLat: roundCoordinate(input.endLat) } : {}),
    ...(input.endLng !== undefined ? { endLng: roundCoordinate(input.endLng) } : {}),
    ...(input.startAddress !== undefined ? { startAddress: coarsenAddress(input.startAddress) ?? ROUTE_START_FALLBACK_LABEL } : {}),
    ...(input.endAddress !== undefined ? { endAddress: coarsenAddress(input.endAddress) ?? ROUTE_END_FALLBACK_LABEL } : {}),
    ...(input.routeGeometry !== undefined ? { routeGeometry: sanitizeRouteGeometry(input.routeGeometry) } : {}),
  }
}
