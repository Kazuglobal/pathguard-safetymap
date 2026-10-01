// =============================================
// 事故多発地点の計算（純粋関数）
//
// 警察庁「事故多発地点解析ツール」の距離グループ集計と同じ手順:
//   1. 事故の座標ごとに、半径 R 以内にある事故の件数を数える
//   2. 件数の多い中心から採用し、採用済みの中心から R 以内の候補は捨てる（円の密集を防ぐ）
//   3. 件数が minCount 未満になったら止める
// 全点同士の比較を避けるため、R 以上の幅のグリッドに振り分けて隣接9セルだけを見る。
// =============================================

export interface HotspotPoint {
  lat: number
  lng: number
  year: number
  fatal: boolean
  pedestrian: boolean
  young: boolean
  accidentClass: string | null
  hour: number | null
  prefectureCode: number
  municipalityCode: string | null
}

export interface HotspotOptions {
  radiusMeters: number
  minCount: number
}

export interface AccidentHotspot {
  lat: number
  lng: number
  accidentCount: number
  fatalCount: number
  pedestrianCount: number
  youngCount: number
  byYear: Record<string, number>
  byClass: Record<string, number>
  peakHour: number | null
  prefectureCode: number
  municipalityCode: string | null
  /** 件数が多い順の全国順位（同数は同順位）。 */
  nationalRank: number
}

const METERS_PER_DEGREE_LAT = 110_574
const METERS_PER_DEGREE_LNG_AT_EQUATOR = 111_320
/** 日本の北端付近（北緯46度）でも経度方向のセル幅が R 以上になるようにする。 */
const MAX_LATITUDE = 46

/** 短い距離（数十m）用の正距円筒近似。 */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180)
  const dy = (a.lat - b.lat) * METERS_PER_DEGREE_LAT
  const dx = (a.lng - b.lng) * METERS_PER_DEGREE_LNG_AT_EQUATOR * Math.cos(meanLat)
  return Math.hypot(dx, dy)
}

interface Location {
  lat: number
  lng: number
  points: HotspotPoint[]
}

/** 同じ座標の事故をまとめる（交差点の代表点に多くの事故が重なるため、計算量が大きく減る）。 */
function groupByCoordinate(points: readonly HotspotPoint[]): Location[] {
  const byKey = new Map<string, HotspotPoint[]>()
  for (const point of points) {
    const key = `${point.lat},${point.lng}`
    const list = byKey.get(key)
    if (list) list.push(point)
    else byKey.set(key, [point])
  }
  return [...byKey.values()].map((list) => ({ lat: list[0].lat, lng: list[0].lng, points: list }))
}

function createGrid(locations: readonly Location[], radiusMeters: number) {
  const cellLat = radiusMeters / METERS_PER_DEGREE_LAT
  const cellLng = radiusMeters / (METERS_PER_DEGREE_LNG_AT_EQUATOR * Math.cos(MAX_LATITUDE * (Math.PI / 180)))
  const cellOf = (location: { lat: number; lng: number }) =>
    [Math.floor(location.lat / cellLat), Math.floor(location.lng / cellLng)] as const
  const cells = new Map<string, number[]>()
  locations.forEach((location, index) => {
    const [row, column] = cellOf(location)
    const key = `${row}:${column}`
    const list = cells.get(key)
    if (list) list.push(index)
    else cells.set(key, [index])
  })

  /** center から radiusMeters 以内にある location の番号。 */
  return function neighbors(center: { lat: number; lng: number }): number[] {
    const [row, column] = cellOf(center)
    const found: number[] = []
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        for (const index of cells.get(`${row + dr}:${column + dc}`) ?? []) {
          if (distanceMeters(center, locations[index]) <= radiusMeters) found.push(index)
        }
      }
    }
    return found
  }
}

function increment(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1
}

function peakHourOf(points: readonly HotspotPoint[]): number | null {
  const counts = new Map<number, number>()
  for (const point of points) {
    if (point.hour != null) counts.set(point.hour, (counts.get(point.hour) ?? 0) + 1)
  }
  let peak: number | null = null
  let best = 0
  for (const [hour, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
    if (count > best) {
      peak = hour
      best = count
    }
  }
  return peak
}

function summarize(center: Location, points: readonly HotspotPoint[]): Omit<AccidentHotspot, 'nationalRank'> {
  const byYear: Record<string, number> = {}
  const byClass: Record<string, number> = {}
  let fatalCount = 0
  let pedestrianCount = 0
  let youngCount = 0
  for (const point of points) {
    increment(byYear, String(point.year))
    if (point.accidentClass) increment(byClass, point.accidentClass)
    if (point.fatal) fatalCount += 1
    if (point.pedestrian) pedestrianCount += 1
    if (point.young) youngCount += 1
  }
  return {
    lat: center.lat,
    lng: center.lng,
    accidentCount: points.length,
    fatalCount,
    pedestrianCount,
    youngCount,
    byYear,
    byClass,
    peakHour: peakHourOf(points),
    prefectureCode: center.points[0].prefectureCode,
    municipalityCode: center.points[0].municipalityCode,
  }
}

/** 事故多発地点を件数の多い順に返す。 */
export function computeHotspots(points: readonly HotspotPoint[], options: HotspotOptions): AccidentHotspot[] {
  const { radiusMeters, minCount } = options
  if (radiusMeters <= 0 || minCount < 1) throw new Error('invalid hotspot options')
  const locations = groupByCoordinate(points)
  const neighbors = createGrid(locations, radiusMeters)

  const candidates = locations
    .map((location, index) => ({
      index,
      count: neighbors(location).reduce((sum, other) => sum + locations[other].points.length, 0),
    }))
    .filter((candidate) => candidate.count >= minCount)
    // 同数は南西の点から採用して、実行ごとに結果が変わらないようにする
    .sort((a, b) => b.count - a.count
      || locations[a.index].lat - locations[b.index].lat
      || locations[a.index].lng - locations[b.index].lng)

  const acceptedGrid = new Map<string, Location[]>()
  const cellLat = radiusMeters / METERS_PER_DEGREE_LAT
  const cellLng = radiusMeters / (METERS_PER_DEGREE_LNG_AT_EQUATOR * Math.cos(MAX_LATITUDE * (Math.PI / 180)))
  const cellKey = (row: number, column: number) => `${row}:${column}`
  const overlapsAccepted = (location: Location) => {
    const row = Math.floor(location.lat / cellLat)
    const column = Math.floor(location.lng / cellLng)
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        for (const other of acceptedGrid.get(cellKey(row + dr, column + dc)) ?? []) {
          if (distanceMeters(location, other) <= radiusMeters) return true
        }
      }
    }
    return false
  }

  const hotspots: Array<Omit<AccidentHotspot, 'nationalRank'>> = []
  for (const candidate of candidates) {
    const location = locations[candidate.index]
    if (overlapsAccepted(location)) continue
    const key = cellKey(Math.floor(location.lat / cellLat), Math.floor(location.lng / cellLng))
    acceptedGrid.set(key, [...(acceptedGrid.get(key) ?? []), location])
    hotspots.push(summarize(location, neighbors(location).flatMap((index) => locations[index].points)))
  }

  let rank = 0
  return hotspots.map((hotspot, position) => {
    if (position === 0 || hotspot.accidentCount !== hotspots[position - 1].accidentCount) rank = position + 1
    return { ...hotspot, nationalRank: rank }
  })
}
