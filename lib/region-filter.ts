// 地域フィルタの純ロジック
//
// ヒヤリハット報告の「県別 → 市町村別 → 学校周辺」絞り込みで使う
// 計算・整形関数を一元化する。UI や Supabase への依存を持たない。

/** 学校周辺表示の半径(km)。通学路の徒歩圏を想定 */
export const SCHOOL_RADIUS_KM = 2

// 匿名閲覧用ビュー danger_reports_public_preview は緯度経度を約1.1km四方へ
// 丸めている(半グリッド対角 ≒ 0.72km)。学校周辺の判定はこの誤差ぶんを
// 許容幅として加算しないと、圏内の報告が取りこぼされる。
export const PREVIEW_COORD_SLACK_KM = 0.8

export interface SchoolSelection {
  id: string
  name: string
  latitude: number
  longitude: number
}

export interface LatLngBounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

/**
 * 報告データの city 列から市町村フィルタの選択肢を作る。
 * 空値を除き、報告件数の多い順(同数は五十音順)で返す。
 */
export function buildMunicipalityOptions(
  cities: ReadonlyArray<string | null | undefined>,
): string[] {
  const counts = new Map<string, number>()
  for (const raw of cities) {
    const city = raw?.trim()
    if (!city) continue
    counts.set(city, (counts.get(city) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .map(([city]) => city)
}

const KM_PER_DEGREE_LAT = 111.32

/** 中心点から半径 radiusKm を含む矩形範囲(PostgRESTのgte/lte用) */
export function latLngBoundsForRadius(
  latitude: number,
  longitude: number,
  radiusKm: number,
): LatLngBounds {
  const latDelta = radiusKm / KM_PER_DEGREE_LAT
  const cosLat = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01)
  const lngDelta = radiusKm / (KM_PER_DEGREE_LAT * cosLat)
  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLng: longitude - lngDelta,
    maxLng: longitude + lngDelta,
  }
}

/** 2点間の距離(km)。ハバースイン公式 */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** 報告が学校の周辺圏内(半径+座標丸め許容幅)にあるか */
export function isWithinSchoolRadius(
  report: { latitude: number | null; longitude: number | null },
  school: SchoolSelection,
  radiusKm: number = SCHOOL_RADIUS_KM,
  slackKm: number = PREVIEW_COORD_SLACK_KM,
): boolean {
  if (report.latitude == null || report.longitude == null) return false
  return (
    distanceKm(report.latitude, report.longitude, school.latitude, school.longitude) <=
    radiusKm + slackKm
  )
}
