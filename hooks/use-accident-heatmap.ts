"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSupabase } from '@/components/providers/supabase-provider'
import {
  fetchAccidentsInBounds,
  DEFAULT_HEATMAP_FILTERS,
  FETCH_DEBOUNCE_MS,
  type AccidentHeatmapFilters,
  type ViewportBounds,
  type AccidentGeoJSON,
} from '@/lib/traffic-accident-heatmap'

function isAbortLikeError(error: unknown): boolean {
  if (!error) return false
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message ?? '')
        : String(error)
  const lower = message.toLowerCase()
  return (
    lower.includes('aborterror') ||
    lower.includes('operation was aborted') ||
    lower.includes('the operation was aborted') ||
    lower.includes('canceling statement due to user request')
  )
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface UseAccidentHeatmapReturn {
  /** Current GeoJSON data for the viewport */
  geoJSON: AccidentGeoJSON | null
  /** Whether a fetch is in progress */
  isLoading: boolean
  /** Error message if the last fetch failed */
  error: string | null
  /** Whether the heatmap is toggled on */
  isVisible: boolean
  /** Number of features currently loaded */
  featureCount: number
  /** Active filters */
  filters: AccidentHeatmapFilters
  /** Update one or more filters (immutable merge) */
  setFilters: (patch: Partial<AccidentHeatmapFilters>) => void
  /** Fetch accident data for a viewport (debounced internally) */
  fetchForViewport: (bounds: ViewportBounds) => void
  /** Toggle heatmap visibility */
  toggleVisibility: () => void
  /** Reset all state to initial */
  reset: () => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages accident heatmap data, filters, and visibility.
 *
 * - Viewport-based fetching with 300ms debounce
 * - Latest-request-wins pattern to discard stale responses
 * - Immutable filter updates; caller controls when viewport re-fetch runs
 * - Visibility-off cancels pending/in-flight updates to avoid stale UI writes
 */
export function useAccidentHeatmap(): UseAccidentHeatmapReturn {
  const { supabase } = useSupabase()
  const supabaseRef = useRef(supabase)

  // State
  const [geoJSON, setGeoJSON] = useState<AccidentGeoJSON | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [filters, setFiltersState] = useState<AccidentHeatmapFilters>(DEFAULT_HEATMAP_FILTERS)

  // Async safety refs
  const latestRequestIdRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isVisibleRef = useRef(isVisible)
  const inFlightAbortRef = useRef<AbortController | null>(null)

  // Keep supabase ref current
  useEffect(() => {
    supabaseRef.current = supabase
  }, [supabase])

  // Keep visibility ref current
  useEffect(() => {
    isVisibleRef.current = isVisible
  }, [isVisible])

  // ---------------------------------------------------------------------------
  // Fetch (debounced, latest-wins)
  // ---------------------------------------------------------------------------

  const cancelInFlightFetch = useCallback(() => {
    if (inFlightAbortRef.current) {
      inFlightAbortRef.current.abort()
      inFlightAbortRef.current = null
    }
  }, [])

  const cancelPendingFetch = useCallback(() => {
    latestRequestIdRef.current += 1
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    cancelInFlightFetch()
    setIsLoading(false)
  }, [cancelInFlightFetch])

  const fetchForViewport = useCallback((bounds: ViewportBounds) => {
    if (!isVisibleRef.current) return

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(async () => {
      debounceTimerRef.current = null
      if (!isVisibleRef.current) return

      const requestId = latestRequestIdRef.current + 1
      latestRequestIdRef.current = requestId

      cancelInFlightFetch()
      const abortController = new AbortController()
      inFlightAbortRef.current = abortController

      setIsLoading(true)
      setError(null)

      try {
        const data = await fetchAccidentsInBounds(
          supabaseRef.current,
          bounds,
          filters,
          { signal: abortController.signal },
        )

        // Discard stale response
        if (latestRequestIdRef.current !== requestId) return

        setGeoJSON(data)
      } catch (err) {
        if (latestRequestIdRef.current !== requestId) return
        if (abortController.signal.aborted || isAbortLikeError(err)) return

        const message = err instanceof Error ? err.message : '事故データの取得に失敗しました'
        setError(message)
        setGeoJSON(null)
      } finally {
        if (inFlightAbortRef.current === abortController) {
          inFlightAbortRef.current = null
        }
        if (latestRequestIdRef.current === requestId) {
          setIsLoading(false)
        }
      }
    }, FETCH_DEBOUNCE_MS)
  }, [cancelInFlightFetch, filters])

  // ---------------------------------------------------------------------------
  // Filter update (immutable)
  // ---------------------------------------------------------------------------

  const setFilters = useCallback((patch: Partial<AccidentHeatmapFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }))
  }, [])

  // ---------------------------------------------------------------------------
  // Visibility toggle
  // ---------------------------------------------------------------------------

  const toggleVisibility = useCallback(() => {
    const next = !isVisibleRef.current
    isVisibleRef.current = next
    setIsVisible(next)
    if (!next) {
      cancelPendingFetch()
    }
  }, [cancelPendingFetch])

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  const reset = useCallback(() => {
    cancelPendingFetch()
    setGeoJSON(null)
    setError(null)
    isVisibleRef.current = false
    setIsVisible(false)
    setFiltersState(DEFAULT_HEATMAP_FILTERS)
  }, [cancelPendingFetch])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      cancelInFlightFetch()
    }
  }, [cancelInFlightFetch])

  return {
    geoJSON,
    isLoading,
    error,
    isVisible,
    featureCount: geoJSON?.features?.length ?? 0,
    filters,
    setFilters,
    fetchForViewport,
    toggleVisibility,
    reset,
  }
}
