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
 * - Prevent concurrent requests (useRef pattern)
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

  // Refs - prevent re-creates and concurrent requests
  const supabaseRef = useRef(supabase)
  const isLoadingRef = useRef(false)

  // Update ref when supabase changes
  useEffect(() => {
    supabaseRef.current = supabase
  }, [supabase])

  /**
   * Fetch accident statistics for a location
   */
  const fetchStats = useCallback(async (params: AccidentStatsParams): Promise<AccidentStats | null> => {
    // Prevent concurrent requests
    if (isLoadingRef.current) {
      return null
    }

    try {
      isLoadingRef.current = true
      setStatus('loading')
      setError(null)

      const result = await getAccidentStatsRPC(supabaseRef.current, params)

      setStats(result)
      setStatus('loaded')
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch accident statistics'
      setError(errorMessage)
      setStatus('error')
      setStats(null)
      return null
    } finally {
      isLoadingRef.current = false
    }
  }, []) // Empty deps - uses refs only

  /**
   * Enrich a danger report with accident statistics
   */
  const enrichReport = useCallback(async (reportId: string): Promise<AccidentStats | null> => {
    // Prevent concurrent requests
    if (isLoadingRef.current) {
      return null
    }

    try {
      isLoadingRef.current = true
      setStatus('loading')
      setError(null)

      const result = await enrichReportWithAccidents(supabaseRef.current, reportId)

      setStats(result.accident_stats)
      setStatus('loaded')
      return result.accident_stats
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enrich report with accident data'
      setError(errorMessage)
      setStatus('error')
      setStats(null)
      return null
    } finally {
      isLoadingRef.current = false
    }
  }, []) // Empty deps - uses refs only

  /**
   * Reset to initial state
   */
  const reset = useCallback(() => {
    setStats(null)
    setStatus('idle')
    setError(null)
    isLoadingRef.current = false
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
