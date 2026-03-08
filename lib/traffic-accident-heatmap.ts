"use client"

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Accident heatmap filter parameters */
export interface AccidentHeatmapFilters {
  minYear: number
  maxYear: number
  severityFilter: 'all' | 'fatal'
  childFilter: boolean | null
  pedestrianFilter: boolean | null
}

/** Viewport bounds for bbox-based fetching */
export interface ViewportBounds {
  minLng: number
  minLat: number
  maxLng: number
  maxLat: number
}

export interface FetchAccidentsOptions {
  signal?: AbortSignal
}

/** Properties for a single accident GeoJSON feature */
export interface AccidentFeatureProperties {
  id: number
  severity: number | null
  fatalities: number
  injuries: number
  year: number
  type: string | null
  hasChild: boolean | null
  hasYoung: boolean | null
  hasPedestrian: boolean | null
  date: string | null
  weather: string | null
  roadShape: string | null
  dayNight: number | null
}

/** GeoJSON Feature for a single traffic accident */
export interface AccidentFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number] // [lng, lat]
  }
  properties: AccidentFeatureProperties
}

/** GeoJSON FeatureCollection of accidents */
export interface AccidentGeoJSON {
  type: 'FeatureCollection'
  features: AccidentFeature[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DEFAULT_HEATMAP_FILTERS: AccidentHeatmapFilters = {
  minYear: 2018,
  maxYear: 2023,
  severityFilter: 'all',
  childFilter: null,
  pedestrianFilter: null,
}

/** Zoom threshold: below = heatmap, at or above = circles */
export const HEATMAP_MAX_ZOOM = 13
export const CIRCLE_MIN_ZOOM = 13

/** Maximum records per viewport fetch */
export const MAX_RECORDS_PER_FETCH = 10000
const CHILD_FILTER_MAX_RECORDS_PER_FETCH = 5000
const RETRY_LIMIT_FALLBACKS = [5000, 2500, 1000] as const

/** Debounce delay for map move events (ms) */
export const FETCH_DEBOUNCE_MS = 300

// ---------------------------------------------------------------------------
// Data Fetching
// ---------------------------------------------------------------------------

function createEmptyFeatureCollection(): AccidentGeoJSON {
  return { type: 'FeatureCollection', features: [] }
}

function normalizeBounds(bounds: ViewportBounds): ViewportBounds | null {
  const values = [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat]
  if (values.some((v) => !Number.isFinite(v))) return null

  const minLng = Math.min(bounds.minLng, bounds.maxLng)
  const maxLng = Math.max(bounds.minLng, bounds.maxLng)
  const minLat = Math.min(bounds.minLat, bounds.maxLat)
  const maxLat = Math.max(bounds.minLat, bounds.maxLat)

  if (minLng < -180 || maxLng > 180 || minLat < -90 || maxLat > 90) return null

  return { minLng, minLat, maxLng, maxLat }
}

function normalizeFilters(filters: AccidentHeatmapFilters): AccidentHeatmapFilters {
  const minYear = Number.isFinite(filters.minYear) ? Math.floor(filters.minYear) : DEFAULT_HEATMAP_FILTERS.minYear
  const maxYear = Number.isFinite(filters.maxYear) ? Math.floor(filters.maxYear) : DEFAULT_HEATMAP_FILTERS.maxYear

  return {
    minYear: Math.min(minYear, maxYear),
    maxYear: Math.max(minYear, maxYear),
    severityFilter: filters.severityFilter === 'fatal' ? 'fatal' : 'all',
    childFilter: filters.childFilter === true ? true : null,
    pedestrianFilter: filters.pedestrianFilter === true ? true : null,
  }
}

function isAbortLikeMessage(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('aborterror') ||
    lower.includes('operation was aborted') ||
    lower.includes('the operation was aborted')
  )
}

function isRetriableStatementCancel(message: string): boolean {
  const lower = message.toLowerCase()
  if (!lower.includes('canceling statement') && !lower.includes('statement timeout')) {
    return false
  }
  return !isAbortLikeMessage(lower)
}

function buildLimitCandidates(initialLimit: number): number[] {
  const candidates = [initialLimit, ...RETRY_LIMIT_FALLBACKS]
  return [...new Set(candidates.filter((limit) => limit >= 1 && limit <= initialLimit))]
}

/**
 * Fetch accident GeoJSON for the given viewport bounds and filters.
 * Uses Supabase RPC `get_accidents_in_bbox`.
 */
export async function fetchAccidentsInBounds(
  supabase: SupabaseClient<Database>,
  bounds: ViewportBounds,
  filters: AccidentHeatmapFilters,
  options: FetchAccidentsOptions = {},
): Promise<AccidentGeoJSON> {
  const normalizedBounds = normalizeBounds(bounds)
  if (!normalizedBounds) {
    return createEmptyFeatureCollection()
  }

  const normalizedFilters = normalizeFilters(filters)
  const initialLimit = normalizedFilters.childFilter
    ? Math.min(MAX_RECORDS_PER_FETCH, CHILD_FILTER_MAX_RECORDS_PER_FETCH)
    : MAX_RECORDS_PER_FETCH
  const limitCandidates = buildLimitCandidates(initialLimit)
  let lastErrorMessage = '不明なエラー'

  for (const limit of limitCandidates) {
    if (options.signal?.aborted) {
      throw new Error('AbortError')
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not yet in generated types
    let request = (supabase.rpc as any)('get_accidents_in_bbox', {
      p_min_lng: normalizedBounds.minLng,
      p_min_lat: normalizedBounds.minLat,
      p_max_lng: normalizedBounds.maxLng,
      p_max_lat: normalizedBounds.maxLat,
      p_min_year: normalizedFilters.minYear,
      p_max_year: normalizedFilters.maxYear,
      p_severity_filter: normalizedFilters.severityFilter,
      p_child_filter: normalizedFilters.childFilter,
      p_pedestrian_filter: normalizedFilters.pedestrianFilter,
      p_limit: limit,
    })
    if (options.signal && typeof request?.abortSignal === 'function') {
      request = request.abortSignal(options.signal)
    }

    const { data, error } = await request

    if (error) {
      const message = String(error.message ?? '')
      if (options.signal?.aborted || isAbortLikeMessage(message)) {
        throw new Error('AbortError')
      }

      lastErrorMessage = message || lastErrorMessage
      if (isRetriableStatementCancel(message) && limit !== limitCandidates[limitCandidates.length - 1]) {
        continue
      }
      throw new Error(`事故データの取得に失敗しました: ${lastErrorMessage}`)
    }

    // Validate shape
    const result = data as unknown as AccidentGeoJSON | null
    if (!result || result.type !== 'FeatureCollection' || !Array.isArray(result.features)) {
      return createEmptyFeatureCollection()
    }

    return result
  }

  throw new Error(`事故データの取得に失敗しました: ${lastErrorMessage}`)
}

// ---------------------------------------------------------------------------
// Severity Helpers
// ---------------------------------------------------------------------------

/** Get Japanese label for severity code */
export function getSeverityLabel(code: number | null): string {
  if (code === 1) return '死亡事故'
  if (code === 2) return '負傷事故'
  return '不明'
}

/** Get color for severity code */
export function getSeverityColor(code: number | null): string {
  if (code === 1) return '#DC2626' // red
  if (code === 2) return '#F59E0B' // amber
  return '#9CA3AF' // gray
}
