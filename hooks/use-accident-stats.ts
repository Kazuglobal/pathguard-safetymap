"use client"

import { useState, useCallback, useRef, useEffect } from 'react'
import { useSupabase } from '@/components/providers/supabase-provider'
import {
  getAccidentStatsRPC,
  enrichReportWithAccidents,
  type AccidentStats,
  type AccidentStatsParams,
} from '@/lib/traffic-accident-data'

/** Hook status states */
export type AccidentStatsStatus = 'idle' | 'loading' | 'loaded' | 'error'

/** Hook return interface */
export interface UseAccidentStatsReturn {
  stats: AccidentStats | null
  status: AccidentStatsStatus
  error: string | null
  isLoading: boolean
  hasData: boolean
  fetchStats: (params: AccidentStatsParams) => Promise<AccidentStats | null>
  enrichReport: (reportId: string) => Promise<AccidentStats | null>
  reset: () => void
}

/**
 * React Hook for managing accident statistics
 *
 * Features:
 * - Fetch accident stats for any location
 * - Enrich danger reports with accident data
 * - Automatic state management (loading, loaded, error)
 * - Latest request wins (prevents stale async updates)
 * - Reset functionality
 *
 * @example
 * ```tsx
 * const { stats, status, fetchStats } = useAccidentStats()
 *
 * useEffect(() => {
 *   fetchStats({ latitude: 35.6595, longitude: 139.7004 })
 * }, [])
 *
 * if (status === 'loading') return <Loading />
 * if (stats) return <AccidentStatsPanel stats={stats} />
 * ```
 */
export function useAccidentStats(): UseAccidentStatsReturn {
  // State
  const [stats, setStats] = useState<AccidentStats | null>(null)
  const [status, setStatus] = useState<AccidentStatsStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  // Get Supabase client from provider
  const { supabase } = useSupabase()

  // Refs - avoid re-creates and stale async commits
  const supabaseRef = useRef(supabase)
  const latestRequestIdRef = useRef(0)

  // Update ref when supabase changes
  useEffect(() => {
    supabaseRef.current = supabase
  }, [supabase])

  /**
   * Fetch accident statistics for a location
   */
  const fetchStats = useCallback(async (params: AccidentStatsParams): Promise<AccidentStats | null> => {
    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId

    try {
      setStatus('loading')
      setError(null)

      const result = await getAccidentStatsRPC(supabaseRef.current, params)

      // Ignore stale responses when a newer request has started.
      if (latestRequestIdRef.current !== requestId) {
        return result
      }

      setStats(result)
      setStatus('loaded')
      return result
    } catch (err) {
      // Ignore stale errors when a newer request has started.
      if (latestRequestIdRef.current !== requestId) {
        return null
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch accident statistics'
      setError(errorMessage)
      setStatus('error')
      setStats(null)
      return null
    }
  }, []) // Empty deps - uses refs only

  /**
   * Enrich a danger report with accident statistics
   */
  const enrichReport = useCallback(async (reportId: string): Promise<AccidentStats | null> => {
    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId

    try {
      setStatus('loading')
      setError(null)

      const result = await enrichReportWithAccidents(supabaseRef.current, reportId)

      // Ignore stale responses when a newer request has started.
      if (latestRequestIdRef.current !== requestId) {
        return result.accident_stats
      }

      setStats(result.accident_stats)
      setStatus('loaded')
      return result.accident_stats
    } catch (err) {
      // Ignore stale errors when a newer request has started.
      if (latestRequestIdRef.current !== requestId) {
        return null
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to enrich report with accident data'
      setError(errorMessage)
      setStatus('error')
      setStats(null)
      return null
    }
  }, []) // Empty deps - uses refs only

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    // Invalidate any in-flight requests so they cannot commit stale state.
    latestRequestIdRef.current += 1
    setStats(null)
    setStatus('idle')
    setError(null)
  }, [])

  // Derived state
  const isLoading = status === 'loading'
  const hasData = stats !== null

  return {
    stats,
    status,
    error,
    isLoading,
    hasData,
    fetchStats,
    enrichReport,
    reset,
  }
}
