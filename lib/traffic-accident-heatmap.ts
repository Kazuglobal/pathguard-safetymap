"use client"

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  ACCIDENT_DATA_MAX_YEAR,
  ACCIDENT_DATA_MIN_YEAR,
} from '@/lib/accident-stats-year-window'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Accident heatmap filter parameters */
export interface AccidentHeatmapFilters {
  minYear: number
  maxYear: number
  severityFilter: 'all' | 'fatal'
  childFilter: boolean | null
  youngFilter: boolean | null
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
  minYear: ACCIDENT_DATA_MIN_YEAR,
  maxYear: ACCIDENT_DATA_MAX_YEAR,
  severityFilter: 'all',
  childFilter: null,
  youngFilter: null,
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
    youngFilter: filters.youngFilter === true ? true : null,
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
 * Uses the authenticated D1 Route Handler while preserving the existing hook contract.
 */
export async function fetchAccidentsInBounds(
  _supabase: SupabaseClient<Database>,
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

    const query = new URLSearchParams({
      minLng: String(normalizedBounds.minLng),
      minLat: String(normalizedBounds.minLat),
      maxLng: String(normalizedBounds.maxLng),
      maxLat: String(normalizedBounds.maxLat),
      minYear: String(normalizedFilters.minYear),
      maxYear: String(normalizedFilters.maxYear),
      severity: normalizedFilters.severityFilter,
      limit: String(limit),
    })
    if (normalizedFilters.childFilter) query.set('child', 'true')
    if (normalizedFilters.youngFilter) query.set('young', 'true')
    if (normalizedFilters.pedestrianFilter) query.set('pedestrian', 'true')

    let response: Response
    try {
      response = await fetch(`/api/traffic-accidents/bbox?${query.toString()}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal: options.signal,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (options.signal?.aborted || isAbortLikeMessage(message)) {
        throw new Error('AbortError')
      }
      lastErrorMessage = message || lastErrorMessage
      throw new Error(`事故データの取得に失敗しました: ${lastErrorMessage}`)
    }

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null
      const message = body?.error ?? `HTTP ${response.status}`
      lastErrorMessage = message
      if ((response.status === 503 || response.status === 504 || isRetriableStatementCancel(message))
        && limit !== limitCandidates[limitCandidates.length - 1]) {
        continue
      }
      throw new Error(`事故データの取得に失敗しました: ${lastErrorMessage}`)
    }

    const data = await response.json()

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
