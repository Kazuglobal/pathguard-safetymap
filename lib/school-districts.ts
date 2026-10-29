import * as turf from '@turf/turf'
import type { Feature, LineString, Point, Polygon, MultiPolygon, Position } from 'geojson'

// The repository's ambient Turf declaration omits these exports. Keep its
// existing consumers untouched and describe the spatial operations here.
const { booleanPointInPolygon, lineString, point, pointToLineDistance } = turf as unknown as {
  point(coordinates: Position): Feature<Point>
  lineString(coordinates: Position[]): Feature<LineString>
  booleanPointInPolygon(point: Feature<Point>, polygon: Polygon | MultiPolygon, options: { ignoreBoundary: boolean }): boolean
  pointToLineDistance(point: Feature<Point>, line: Feature<LineString>, options: { units: 'meters' }): number
}

export interface SchoolDistrictOption {
  id: string; municipalityCode: string; schoolCode: string
  prefecture: string; city: string; name: string; dataYear: number; sourceUrl: string
}

export interface SchoolDistrictOptions {
  cities: string[]
  districts: SchoolDistrictOption[]
}

// MLIT reports 25m spatial deviation. Allow another 25m for address positioning.
export const DISTRICT_BOUNDARY_MARGIN_METERS = 50

/**
 * 危険の報告を学区で知らせるとき用。学区の中か、境界から marginMeters 以内(外側も含む)なら true。
 * 学区の境界になる道の上の報告は、両側の学区に知らせる(isInsideSchoolDistrict は境界の近くを外す。地域アラートの振り分け用)
 */
export function isWithinOrNearSchoolDistrict(
  longitude: number,
  latitude: number,
  geometries: readonly (Polygon | MultiPolygon)[],
  marginMeters: number = DISTRICT_BOUNDARY_MARGIN_METERS,
): boolean {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return false
  const location = point([longitude, latitude])
  return geometries.some(geometry => {
    if (booleanPointInPolygon(location, geometry, { ignoreBoundary: false })) return true
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    return polygons.some(rings => rings.some(ring => pointToLineDistance(location, lineString(ring), { units: 'meters' }) <= marginMeters))
  })
}

export function isInsideSchoolDistrict(longitude: number, latitude: number, geometries: readonly (Polygon | MultiPolygon)[]): boolean {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return false
  const location = point([longitude, latitude])
  return geometries.some(geometry => {
    if (!booleanPointInPolygon(location, geometry, { ignoreBoundary: true })) return false
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    return polygons.some(rings => {
      if (!booleanPointInPolygon(location, { type: 'Polygon', coordinates: rings }, { ignoreBoundary: true })) return false
      return rings.every(ring => pointToLineDistance(location, lineString(ring), { units: 'meters' }) > DISTRICT_BOUNDARY_MARGIN_METERS)
    })
  })
}
