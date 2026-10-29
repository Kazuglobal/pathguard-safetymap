import { ALL_PREFECTURES } from '@/lib/user-region'

/**
 * 通学路の位置を、自宅・学校が特定できない粗さにしてから保存する(UIUX改装 項目59)。
 *
 * - 道すじ(LineString)は両端をそれぞれ 200m 以上削る(自宅と学校の前の道を残さない)。
 *   削る長さは毎回 0〜150m の乱数を足す(まっすぐな道でも、残った線の端から自宅・学校の位置を逆算できないように)。
 *   300m 以内の危険の判定は、残った道すじで続ける。短くて残らない通学路は、お子さまの学区で知らせる
 * - 起点・終点の座標は小数2桁(約1km)に丸める
 * - 住所は「都道府県+市区町村」だけにする(番地・郵便番号・座標の文字列は残さない)
 *
 * 作成した端末には元の線を残し、その端末の画面でだけ全体を表示する(lib/route-local-geometry.ts)。
 */

/** 端ごとに削る最短の長さ */
export const ROUTE_END_TRIM_METERS = 200
/** 端ごとに削る長さに足す乱数の上限(短い線では、50m 以上残るように減らす) */
export const ROUTE_END_TRIM_JITTER_METERS = 150
/** 両端を削ったあとに残す最短の長さ。これより短くなる線(450m 未満)は保存しない */
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

/** 始点側・終点側で削る長さ(m) */
export interface EndTrim {
  readonly start: number
  readonly end: number
}

function secureRandom(): number {
  const [value] = crypto.getRandomValues(new Uint32Array(1))
  return (value ?? 0) / 2 ** 32
}

/**
 * 端ごとに削る長さ。200m に 0〜150m の乱数を端ごとに足す(削った長さが毎回ちがうので、
 * まっすぐな道でも残った線の端から逆算できない)。短い線では、50m 以上残るように足す長さを減らす
 */
export function randomEndTrim(totalMeters: number, random: () => number = secureRandom): EndTrim {
  const room = Math.max(0, totalMeters - ROUTE_END_TRIM_METERS * 2 - ROUTE_MIN_REMAINING_METERS)
  const jitter = Math.min(ROUTE_END_TRIM_JITTER_METERS, room / 2)
  return { start: ROUTE_END_TRIM_METERS + random() * jitter, end: ROUTE_END_TRIM_METERS + random() * jitter }
}

/**
 * 線の両端を削る(既定は randomEndTrim の長さ)。450m 未満の線や、削ったあとに
 * ROUTE_MIN_REMAINING_METERS より短くなる線は null(保存しない。通知はお子さまの学区で行う)
 */
export function trimLineEnds(coordinates: readonly Position[], trim?: EndTrim): Position[] | null {
  if (coordinates.length < 2) return null
  const total = lineLength(coordinates)
  if (total < ROUTE_END_TRIM_METERS * 2 + ROUTE_MIN_REMAINING_METERS) return null
  const { start, end } = trim ?? randomEndTrim(total)
  if (total < start + end + ROUTE_MIN_REMAINING_METERS) return null
  const fromStart = cutFromStart(coordinates, start)
  const trimmed = cutFromStart([...fromStart].reverse(), end).reverse()
  return trimmed.length >= 2 ? trimmed : null
}

/**
 * 保存する道すじ。LineString 以外・点が多すぎる・座標がおかしい線は保存しない(null)。
 * 返す線には「両端を削った」印を書き添える(GeoJSON の追加の項目。値は削った最短の長さで、実際に削った長さは残さない)。
 * 印は保存し直しの判定(scripts/ops/coarsen-existing-routes.ts)に使う。送られてきた線の印は信じない(必ず削る)
 */
export function sanitizeRouteGeometry(value: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!value || value.type !== 'LineString' || !Array.isArray(value.coordinates)) return null
  const coordinates = value.coordinates as unknown[]
  if (coordinates.length > ROUTE_MAX_POINTS || !coordinates.every(isPosition)) return null
  const trimmed = trimLineEnds(coordinates.map((position) => [position[0], position[1]] as Position))
  if (!trimmed) return null
  return { type: 'LineString', coordinates: trimmed, trimmedEndsMeters: ROUTE_END_TRIM_METERS }
}

/*
 * 市区町村の読み取り。「市・郡・町・村・区」の字を区切りとして読むが、名前の途中にその字を含む市町村は先に名前で拾う
 * (例: 四日市市・大和郡山市・町田市。区切りとして読むと「四日市」で切れたり、町名まではみ出したりする)。
 * 読み取れないときは、細かくなる側にはみ出さないよう、都道府県だけにする。
 */
/** 東京23区(東京都のときだけ) */
const TOKYO_WARD_PATTERN = /^(?:千代田|中央|港|新宿|文京|台東|墨田|江東|品川|目黒|大田|世田谷|渋谷|中野|杉並|豊島|北|荒川|板橋|練馬|足立|葛飾|江戸川)区/u
/** 政令指定都市(区まで残す) */
const DESIGNATED_CITY_PATTERN = /^(?:札幌|仙台|さいたま|千葉|横浜|川崎|相模原|新潟|静岡|浜松|名古屋|京都|大阪|堺|神戸|岡山|広島|北九州|福岡|熊本)市(?:\s*[^\s\d,、]{1,5}?区)?/u
/** 名前の途中に「市・郡・町・村」を含む市 */
const CITY_WITH_MARKER_PATTERN = /^(?:大和郡山|武蔵村山|四日市|廿日市|野々市|十日町|東村山|市川|市原|郡山|小郡|蒲郡|郡上|町田|大町|村山|村上|羽村|田村|大村)市/u
/** 名前に「市」を含む町(郡を書かない住所のため) */
const TOWN_WITH_CITY_CHAR_PATTERN = /^(?:市川三郷|上市|市貝|余市)町/u
/** 郡+町村(郡の名前は「市・区」を含まない。余市郡・高市郡だけは別に拾う) */
const DISTRICT_TOWN_PATTERN = /^(?:余市|高市|[^\s\d,、市区]{1,6}?)郡\s*[^\s\d,、区]{1,8}?[町村]/u
/** ふつうの市(名前に「町・村・区・郡」を含まない) */
const CITY_PATTERN = /^[^\s\d,、町村区郡]{1,8}?市/u
/** 郡を書かない町村 */
const TOWN_PATTERN = /^[^\s\d,、市区郡]{1,8}?[町村]/u

function readMunicipality(rest: string, prefecture: string): string | null {
  const patterns = [
    ...(prefecture === '東京都' ? [TOKYO_WARD_PATTERN] : []),
    DESIGNATED_CITY_PATTERN, CITY_WITH_MARKER_PATTERN, TOWN_WITH_CITY_CHAR_PATTERN, DISTRICT_TOWN_PATTERN, CITY_PATTERN, TOWN_PATTERN,
  ]
  for (const pattern of patterns) {
    const matched = rest.match(pattern)?.[0]
    if (matched) return matched.replace(/\s+/gu, '')
  }
  return null
}

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
  const municipality = readMunicipality(rest, found.prefecture)
  return municipality ? `${found.prefecture}${municipality}` : found.prefecture
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
