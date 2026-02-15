"use client"

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

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
  return result as AccidentStats
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
    accident_stats: stats as AccidentStats,
    accident_risk_score: stats.risk_score,
  }
}
