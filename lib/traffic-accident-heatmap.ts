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

/** Properties for a single accident GeoJSON feature */
export interface AccidentFeatureProperties {
  id: number
  severity: number | null
  fatalities: number
  injuries: number
  year: number
  type: string | null
  hasChild: boolean | null
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

/** Debounce delay for map move events (ms) */
export const FETCH_DEBOUNCE_MS = 300

// ---------------------------------------------------------------------------
// Data Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch accident GeoJSON for the given viewport bounds and filters.
 * Uses Supabase RPC `get_accidents_in_bbox`.
 */
export async function fetchAccidentsInBounds(
  supabase: SupabaseClient<Database>,
  bounds: ViewportBounds,
  filters: AccidentHeatmapFilters,
): Promise<AccidentGeoJSON> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC not yet in generated types
  const { data, error } = await (supabase.rpc as any)('get_accidents_in_bbox', {
    p_min_lng: bounds.minLng,
    p_min_lat: bounds.minLat,
    p_max_lng: bounds.maxLng,
    p_max_lat: bounds.maxLat,
    p_min_year: filters.minYear,
    p_max_year: filters.maxYear,
    p_severity_filter: filters.severityFilter,
    p_child_filter: filters.childFilter,
    p_pedestrian_filter: filters.pedestrianFilter,
    p_limit: MAX_RECORDS_PER_FETCH,
  })

  if (error) {
    throw new Error(`事故データの取得に失敗しました: ${error.message}`)
  }

  // Validate shape
  const result = data as unknown as AccidentGeoJSON | null
  if (!result || result.type !== 'FeatureCollection' || !Array.isArray(result.features)) {
    return { type: 'FeatureCollection', features: [] }
  }

  return result
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
