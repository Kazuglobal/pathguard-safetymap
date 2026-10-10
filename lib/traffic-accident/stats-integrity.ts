import type { AccidentStats } from '@/lib/traffic-accident-data'
import { accidentYearWindow } from '@/lib/accident-stats-year-window'

const countKeys = ['total_accidents', 'fatal_accidents', 'total_fatalities', 'total_injuries', 'child_involved', 'pedestrian_involved'] as const
const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** 不完全・矛盾した結果をゼロ件として表示しない。保存済み統計にも適用する。 */
export function accidentStatsIntegrityError(value: unknown): string | null {
  const invalid = '事故データの整合性を確認できません。再取得してください。'
  if (!isObject(value) || countKeys.some((key) => !isCount(value[key]))) return invalid
  const stats = value as unknown as AccidentStats
  if (!Number.isFinite(stats.risk_score) || stats.risk_score < 0 || stats.risk_score > 100) return invalid
  if (stats.fatal_accidents > stats.total_accidents || stats.child_involved > stats.total_accidents || stats.pedestrian_involved > stats.total_accidents) return invalid
  if ((stats.fatal_accidents === 0) !== (stats.total_fatalities === 0) || stats.fatal_accidents > stats.total_fatalities) return invalid
  if (stats.total_accidents === 0 && stats.total_injuries !== 0) return invalid
  const scope = stats.search_params
  if (!isObject(scope) || !Number.isFinite(scope.latitude) || Math.abs(scope.latitude) > 90 || !Number.isFinite(scope.longitude) || Math.abs(scope.longitude) > 180 || !isCount(scope.radius_meters) || scope.radius_meters < 1 || !isCount(scope.years) || scope.years < 1) return invalid
  if (!Array.isArray(stats.nearest_accidents) || (stats.accident_records !== undefined && !Array.isArray(stats.accident_records))) return invalid
  const records = stats.accident_records ?? stats.nearest_accidents
  if (records.length > stats.total_accidents) return invalid
  for (const record of [...stats.nearest_accidents, ...(stats.accident_records ?? [])]) {
    if (!isObject(record) || !Number.isFinite(record.distance_m) || record.distance_m < 0 || record.distance_m > scope.radius_meters + 0.1 || !isCount(record.fatalities) || !isCount(record.injuries)) return invalid
    if (record.severity !== 'fatal' && record.severity !== 'injury') return invalid
    if (record.fatalities > 0 && record.severity !== 'fatal') return invalid
    if (!Number.isFinite(record.latitude) || Math.abs(record.latitude) > 90 || !Number.isFinite(record.longitude) || Math.abs(record.longitude) > 180 || !isCount(record.year)) return invalid
    if (scope.min_year !== undefined && record.year < scope.min_year) return invalid
    if (scope.max_year !== undefined && record.year > scope.max_year) return invalid
  }
  const fatalRecords = records.filter((record) => record.severity === 'fatal').length
  const listedFatalities = records.reduce((sum, record) => sum + record.fatalities, 0)
  const listedInjuries = records.reduce((sum, record) => sum + record.injuries, 0)
  if (fatalRecords > stats.fatal_accidents || listedFatalities > stats.total_fatalities || listedInjuries > stats.total_injuries) return invalid
  if (stats.nearest_accidents.length > stats.total_accidents || stats.nearest_accidents.filter((record) => record.severity === 'fatal').length > stats.fatal_accidents || stats.nearest_accidents.reduce((sum, record) => sum + record.fatalities, 0) > stats.total_fatalities || stats.nearest_accidents.reduce((sum, record) => sum + record.injuries, 0) > stats.total_injuries) return invalid
  if (stats.accident_records !== undefined) {
    if (typeof stats.records_truncated !== 'boolean') return invalid
    if (!stats.records_truncated && (records.length !== stats.total_accidents || fatalRecords !== stats.fatal_accidents || listedFatalities !== stats.total_fatalities || listedInjuries !== stats.total_injuries)) return invalid
  }
  return null
}

export function assertAccidentStatsResponse(value: unknown, expected: { latitude: number; longitude: number; radiusMeters: number; years: number }): asserts value is AccidentStats {
  const error = accidentStatsIntegrityError(value)
  if (error) throw new Error(error)
  const scope = (value as AccidentStats).search_params
  const window = accidentYearWindow(expected.years)
  if (Math.abs(scope.latitude - expected.latitude) > 1e-8 || Math.abs(scope.longitude - expected.longitude) > 1e-8 || scope.radius_meters !== expected.radiusMeters || scope.years !== window.maxYear - window.minYear + 1 || (scope.min_year !== undefined && scope.min_year !== window.minYear) || (scope.max_year !== undefined && scope.max_year !== window.maxYear)) {
    throw new Error('事故データの集計範囲が要求した地点と一致しません。再取得してください。')
  }
}
