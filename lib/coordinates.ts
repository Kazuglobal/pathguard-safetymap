export const MIN_LATITUDE = -90
export const MAX_LATITUDE = 90
export const MIN_LONGITUDE = -180
export const MAX_LONGITUDE = 180

export function isValidLatitude(latitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= MIN_LATITUDE && latitude <= MAX_LATITUDE
}

export function isValidLongitude(longitude: number): boolean {
  return Number.isFinite(longitude) && longitude >= MIN_LONGITUDE && longitude <= MAX_LONGITUDE
}

export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return isValidLatitude(latitude) && isValidLongitude(longitude)
}

/**
 * 匿名ユーザー向けプレビュー用に座標をグリッドへスナップする（丸め込み）。
 *
 * 既定の 0.01 度は緯度方向で約1.11km、経度方向は緯度によって縮むが日本国内の
 * 中緯度帯（東京: 北緯35度付近）でも約0.9km程度のグリッド幅になる。
 * 個人宅・通学路など具体的地点を anon（未ログイン）に一切特定させないための
 * 「街区レベルより粗い」丸めとして採用する（子どもの安全上、100m未満の丸めは避ける）。
 *
 * 境界値（±90度緯度、±180度経度）でも Math.round による通常の丸めのみを行い、
 * 特別扱いはしない（丸め後に範囲外へ出ることはない: 90 / 0.01 = 9000 は整数なので
 * Math.round(9000) * 0.01 = 90.00 のまま）。
 */
export function roundToGrid(value: number, gridDegrees = 0.01): number {
  if (!Number.isFinite(value) || !Number.isFinite(gridDegrees) || gridDegrees <= 0) {
    return value
  }
  return Math.round(value / gridDegrees) * gridDegrees
}
