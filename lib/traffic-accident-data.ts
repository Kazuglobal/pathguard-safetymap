"use client"

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import { isValidCoordinates } from '@/lib/coordinates'

/** Default RPC parameters */
const DEFAULT_RADIUS_METERS = 500
const DEFAULT_YEARS = 3

/** Risk level type */
export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high'

/** Risk level with UI metadata */
export interface RiskLevelInfo {
  level: RiskLevel
  label: string
  emoji: string
  color: string      // Hex color for text
  bgColor: string    // Hex color for background
  description: string // Japanese description
}

/** AccidentStats interface - matches RPC return type */
export interface AccidentStats {
  // Location info
  latitude: number
  longitude: number
  radius_meters: number
  years_analyzed: number

  // Overall statistics
  total_accidents: number
  risk_score: number // 0-100

  // Severity breakdown
  fatal_accidents: number
  serious_accidents: number
  minor_accidents: number

  // Victim breakdown
  pedestrian_accidents: number
  bicycle_accidents: number
  motorcycle_accidents: number
  car_accidents: number
  child_involved: number
  elderly_involved: number

  // Time distribution (24-hour)
  accidents_by_hour: {
    hour: number
    count: number
    is_school_time: boolean
  }[]
  // Optional bucketed distribution (used by RPC v2 that does not provide hourly granularity)
  time_buckets?: {
    label: string
    count: number
    is_school_time: boolean
  }[]

  // Accident types
  accident_types: {
    type: string
    count: number
    is_pedestrian_related: boolean
  }[]

  // Weather conditions
  weather_conditions: {
    condition: string
    count: number
  }[]

  // Year-by-year trend
  accidents_by_year: {
    year: number
    count: number
  }[]

  // Nearest accidents (top 5)
  nearest_accidents: {
    id?: number
    latitude?: number
    longitude?: number
    distance_meters: number
    accident_date: string
    severity: 'fatal' | 'serious' | 'minor'
    type: string
    has_child: boolean
    has_pedestrian: boolean
  }[]
}

/** Parameters for fetching accident statistics */
export interface AccidentStatsParams {
  latitude: number
  longitude: number
  radius_meters?: number
  years?: number
}

/**
 * RPC v2 response (observed in production DB).
 */
interface RpcAccidentStatsV2 {
  total_accidents: number
  risk_score: number
  fatal_accidents: number
  child_involved: number
  pedestrian_involved: number
  by_year: Record<string, number>
  by_weather: Record<string, number>
  by_time_of_day: Record<string, number>
  by_accident_type: Record<string, number>
  nearest_accidents: Array<{
    id?: number | null
    latitude?: number | null
    longitude?: number | null
    distance_m?: number | null
    severity?: string | null
    type?: string | null
    involved_child?: boolean | null
    involved_pedestrian?: boolean | null
    year?: number | null
  }>
  search_params?: {
    latitude?: number
    longitude?: number
    radius_meters?: number
    years?: number
  } | null
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toNumericRecord(value: unknown): Record<string, number> {
  if (!isObjectRecord(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, val]) => [key, toFiniteNumber(val, Number.NaN)])
      .filter(([, val]) => Number.isFinite(val))
  )
}

function buildEmptyHourlyDistribution(): AccidentStats['accidents_by_hour'] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
    is_school_time: (hour >= 7 && hour <= 8) || (hour >= 14 && hour <= 16),
  }))
}

function buildTimeBucketLabel(bucket: string): string {
  if (bucket.toLowerCase() === 'other') return 'その他'

  const rangeMatch = bucket.match(/(\d{1,2})-(\d{1,2})/)
  if (!rangeMatch) return bucket

  const start = Number(rangeMatch[1])
  const end = Number(rangeMatch[2])
  const range = `${start}-${end}時`

  if (bucket.includes('morning_commute')) return `${range} (登校時間帯)`
  if (bucket.includes('after_school')) return `${range} (下校時間帯)`
  if (bucket.includes('evening')) return `${range} (夕方)`
  return range
}

function isSchoolTimeBucket(bucket: string): boolean {
  const rangeMatch = bucket.match(/(\d{1,2})-(\d{1,2})/)
  if (!rangeMatch) return false
  const start = Number(rangeMatch[1])
  const end = Number(rangeMatch[2])
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false

  // School commute windows: 07-09 and 14-17
  const overlapsMorning = start < 9 && end > 7
  const overlapsAfternoon = start < 17 && end > 14
  return overlapsMorning || overlapsAfternoon
}

function buildTimeBuckets(byTimeOfDay: Record<string, number>): NonNullable<AccidentStats['time_buckets']> {
  return Object.entries(byTimeOfDay)
    .map(([bucket, count]) => ({
      label: buildTimeBucketLabel(bucket),
      count,
      is_school_time: isSchoolTimeBucket(bucket),
    }))
    .sort((a, b) => b.count - a.count)
}

function mapSeverity(rawSeverity: unknown): 'fatal' | 'serious' | 'minor' {
  const severity = String(rawSeverity ?? '').toLowerCase()
  if (severity.includes('fatal')) return 'fatal'
  if (severity.includes('serious')) return 'serious'
  return 'minor'
}

function sanitizeCoordinatePair(
  latitude: unknown,
  longitude: unknown
): { latitude: number | undefined; longitude: number | undefined } {
  const lat = typeof latitude === 'number' && Number.isFinite(latitude) ? latitude : undefined
  const lng = typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : undefined

  if (lat == null || lng == null) {
    return { latitude: undefined, longitude: undefined }
  }

  if (!isValidCoordinates(lat, lng)) {
    return { latitude: undefined, longitude: undefined }
  }

  return { latitude: lat, longitude: lng }
}

function sanitizeNearestAccidents(
  accidents: AccidentStats['nearest_accidents']
): AccidentStats['nearest_accidents'] {
  return accidents.map((accident) => {
    const { latitude, longitude } = sanitizeCoordinatePair(accident.latitude, accident.longitude)
    return {
      ...accident,
      latitude,
      longitude,
    }
  })
}

function sanitizeAccidentStats(
  value: AccidentStats,
  fallbackParams: Required<AccidentStatsParams>
): AccidentStats {
  const rootCoordinates = sanitizeCoordinatePair(value.latitude, value.longitude)
  const fallbackCoordinates = sanitizeCoordinatePair(
    fallbackParams.latitude,
    fallbackParams.longitude
  )

  const latitude = rootCoordinates.latitude ?? fallbackCoordinates.latitude ?? fallbackParams.latitude
  const longitude = rootCoordinates.longitude ?? fallbackCoordinates.longitude ?? fallbackParams.longitude

  return {
    ...value,
    latitude,
    longitude,
    radius_meters: Math.max(1, Math.round(toFiniteNumber(value.radius_meters, fallbackParams.radius_meters))),
    years_analyzed: Math.max(1, Math.round(toFiniteNumber(value.years_analyzed, fallbackParams.years))),
    nearest_accidents: sanitizeNearestAccidents(value.nearest_accidents),
  }
}

function isAccidentStats(value: unknown): value is AccidentStats {
  if (!value || typeof value !== 'object') return false

  const stats = value as Partial<AccidentStats>

  return (
    typeof stats.latitude === 'number' &&
    typeof stats.longitude === 'number' &&
    typeof stats.radius_meters === 'number' &&
    typeof stats.years_analyzed === 'number' &&
    typeof stats.total_accidents === 'number' &&
    typeof stats.risk_score === 'number' &&
    typeof stats.fatal_accidents === 'number' &&
    typeof stats.serious_accidents === 'number' &&
    typeof stats.minor_accidents === 'number' &&
    typeof stats.pedestrian_accidents === 'number' &&
    typeof stats.child_involved === 'number' &&
    Array.isArray(stats.accidents_by_hour) &&
    Array.isArray(stats.accident_types) &&
    Array.isArray(stats.weather_conditions) &&
    Array.isArray(stats.accidents_by_year) &&
    Array.isArray(stats.nearest_accidents)
  )
}

function isRpcAccidentStatsV2(value: unknown): value is RpcAccidentStatsV2 {
  if (!isObjectRecord(value)) return false

  return (
    typeof value.total_accidents === 'number' &&
    typeof value.risk_score === 'number' &&
    typeof value.fatal_accidents === 'number' &&
    isObjectRecord(value.by_year) &&
    isObjectRecord(value.by_weather) &&
    isObjectRecord(value.by_time_of_day) &&
    isObjectRecord(value.by_accident_type) &&
    Array.isArray(value.nearest_accidents)
  )
}

function normalizeRpcV2ToAccidentStats(
  value: RpcAccidentStatsV2,
  fallbackParams: Required<AccidentStatsParams>
): AccidentStats {
  const byYear = toNumericRecord(value.by_year)
  const byWeather = toNumericRecord(value.by_weather)
  const byTimeOfDay = toNumericRecord(value.by_time_of_day)
  const byAccidentType = toNumericRecord(value.by_accident_type)

  const searchLatitude = toFiniteNumber(value.search_params?.latitude, fallbackParams.latitude)
  const searchLongitude = toFiniteNumber(value.search_params?.longitude, fallbackParams.longitude)
  const searchRadius = toFiniteNumber(value.search_params?.radius_meters, fallbackParams.radius_meters)
  const searchYears = toFiniteNumber(value.search_params?.years, fallbackParams.years)

  const totalAccidents = toFiniteNumber(value.total_accidents)
  const fatalAccidents = toFiniteNumber(value.fatal_accidents)
  const childInvolved = toFiniteNumber(value.child_involved)
  const pedestrianInvolved = toFiniteNumber(value.pedestrian_involved)

  const accidentTypes = Object.entries(byAccidentType)
    .map(([type, count]) => ({
      type,
      count,
      is_pedestrian_related: /人対車両|歩行者|pedestrian/i.test(type),
    }))
    .sort((a, b) => b.count - a.count)

  const weatherConditions = Object.entries(byWeather)
    .map(([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count)

  const accidentsByYear = Object.entries(byYear)
    .map(([year, count]) => ({ year: Number(year), count }))
    .filter((entry) => Number.isFinite(entry.year))
    .sort((a, b) => a.year - b.year)

  const nearestAccidents = value.nearest_accidents
    .filter((accident) => isObjectRecord(accident))
    .map((accident) => {
      const year = toFiniteNumber(accident.year, new Date().getFullYear())
      const normalizedCoordinates = sanitizeCoordinatePair(accident.latitude, accident.longitude)
      return {
        id: typeof accident.id === 'number' ? accident.id : undefined,
        latitude: normalizedCoordinates.latitude,
        longitude: normalizedCoordinates.longitude,
        distance_meters: Math.max(0, Math.round(toFiniteNumber(accident.distance_m))),
        // RPC v2 has year-level precision only; avoid fabricating month/day.
        accident_date: `${year}`,
        severity: mapSeverity(accident.severity),
        type: String(accident.type ?? '不明'),
        has_child: Boolean(accident.involved_child),
        has_pedestrian: Boolean(accident.involved_pedestrian),
      }
    })
    .sort((a, b) => a.distance_meters - b.distance_meters)

  const normalizedStats: AccidentStats = {
    latitude: searchLatitude,
    longitude: searchLongitude,
    radius_meters: Math.max(1, Math.round(searchRadius)),
    years_analyzed: Math.max(1, Math.round(searchYears)),
    total_accidents: totalAccidents,
    risk_score: toFiniteNumber(value.risk_score),
    fatal_accidents: fatalAccidents,
    serious_accidents: 0,
    minor_accidents: Math.max(totalAccidents - fatalAccidents, 0),
    pedestrian_accidents: pedestrianInvolved,
    bicycle_accidents: 0,
    motorcycle_accidents: 0,
    car_accidents: 0,
    child_involved: childInvolved,
    elderly_involved: 0,
    accidents_by_hour: buildEmptyHourlyDistribution(),
    time_buckets: buildTimeBuckets(byTimeOfDay),
    accident_types: accidentTypes,
    weather_conditions: weatherConditions,
    accidents_by_year: accidentsByYear,
    nearest_accidents: nearestAccidents,
  }

  return sanitizeAccidentStats(normalizedStats, fallbackParams)
}

function normalizeAccidentStatsResponse(
  value: unknown,
  fallbackParams: Required<AccidentStatsParams>
): AccidentStats | null {
  if (isAccidentStats(value)) return sanitizeAccidentStats(value, fallbackParams)
  if (isRpcAccidentStatsV2(value)) return normalizeRpcV2ToAccidentStats(value, fallbackParams)
  return null
}

/**
 * Fetch nearby accident statistics using Supabase RPC
 *
 * @param supabase - Supabase client instance
 * @param params - Location and query parameters
 * @returns AccidentStats object with all statistics
 * @throws Error if RPC call fails
 */
export async function getAccidentStatsRPC(
  supabase: SupabaseClient<Database>,
  params: AccidentStatsParams
): Promise<AccidentStats> {
  const { latitude, longitude, radius_meters = DEFAULT_RADIUS_METERS, years = DEFAULT_YEARS } = params

  const { data, error } = await supabase.rpc('get_nearby_accident_stats', {
    p_latitude: latitude,
    p_longitude: longitude,
    p_radius_meters: radius_meters,
    p_years: years,
  })

  if (error) {
    throw new Error(error.message)
  }

  // RPC may return array or single object - handle both cases
  const result = Array.isArray(data) ? data[0] : data

  const normalized = normalizeAccidentStatsResponse(result, {
    latitude,
    longitude,
    radius_meters,
    years,
  })

  if (!normalized) {
    throw new Error('Invalid accident statistics response')
  }

  return normalized
}

/**
 * Calculate risk level from risk score (0-100) with full UI metadata
 *
 * @param score - Risk score (0-100)
 * @returns Risk level with emoji, colors, and Japanese description
 */
export function getAccidentRiskLevel(score: number): RiskLevelInfo {
  if (score < 0) score = 0
  if (score > 100) score = 100

  if (score <= 29) {
    return {
      level: 'low',
      label: '低リスク',
      emoji: '🟢',
      color: '#16A34A',
      bgColor: '#DCFCE7',
      description: '近隣での事故記録は少ないです。基本的な交通ルールの確認を。',
    }
  }

  if (score <= 59) {
    return {
      level: 'medium',
      label: '中リスク',
      emoji: '🟡',
      color: '#CA8A04',
      bgColor: '#FEF9C3',
      description: '一定の事故リスクがあります。子どもへの注意喚起が効果的です。',
    }
  }

  if (score <= 79) {
    return {
      level: 'high',
      label: '高リスク',
      emoji: '🟠',
      color: '#EA580C',
      bgColor: '#FFEDD5',
      description: '事故が複数回発生しています。通学時は見守りを推奨します。',
    }
  }

  return {
    level: 'very_high',
    label: '最高リスク',
    emoji: '🔴',
    color: '#DC2626',
    bgColor: '#FEE2E2',
    description: '過去に多数の事故が発生。最大限の注意が必要です。',
  }
}

/**
 * Enrich a danger report with accident statistics
 *
 * Fetches report location, calls RPC for accident data,
 * and updates the report with accident_stats and accident_risk_score
 *
 * @param supabase - Supabase client instance
 * @param reportId - Danger report ID
 * @returns Updated report with accident data
 * @throws Error if report not found or update fails
 */
export async function enrichReportWithAccidents(
  supabase: SupabaseClient<Database>,
  reportId: string
): Promise<{
  id: string
  latitude: number
  longitude: number
  accident_stats: AccidentStats
  accident_risk_score: number
}> {
  // 1. Fetch report location
  const { data: report, error: fetchError } = await supabase
    .from('danger_reports')
    .select('id, latitude, longitude')
    .eq('id', reportId)
    .single()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  if (!report) {
    throw new Error('Report not found')
  }

  // 2. Fetch accident statistics for this location
  const stats = await getAccidentStatsRPC(supabase, {
    latitude: report.latitude,
    longitude: report.longitude,
  })

  // 3. Update report with accident data (immutable - create new object)
  const { data: updatedReport, error: updateError } = await supabase
    .from('danger_reports')
    .update({
      accident_stats: stats as unknown as Database['public']['Tables']['danger_reports']['Update']['accident_stats'],
      accident_risk_score: stats.risk_score,
    })
    .eq('id', reportId)
    .select()
    .single()

  if (updateError) {
    throw new Error(updateError.message)
  }

  // Return enriched report with new data
  return {
    id: updatedReport.id,
    latitude: updatedReport.latitude,
    longitude: updatedReport.longitude,
    accident_stats: stats,
    accident_risk_score: stats.risk_score,
  }
}
