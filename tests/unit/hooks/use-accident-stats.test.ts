/**
 * TDD Unit Tests: useAccidentStats Hook
 *
 * Phase: Traffic Accident Statistics & Risk Score Feature
 * Target: hooks/use-accident-stats.ts
 *
 * Test Coverage:
 * - State management: idle, loading, loaded, error
 * - fetchStats: Success, error handling, loading state
 * - fetchStats: Latest-request-wins race handling
 * - enrichReport: Success, error handling
 * - reset: Clear state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import React from 'react'
import {
  mockHighRiskStats,
  mockLowRiskStats,
  mockMediumRiskStats,
  mockEmptyAccidentStats,
  mockDatabaseError,
  TEST_COORDINATES,
} from '@/tests/fixtures/accidents'

// Import hook to test
import { useAccidentStats } from '@/hooks/use-accident-stats'

// Mock the Supabase provider
vi.mock('@/components/providers/supabase-provider', () => ({
  useSupabase: vi.fn(),
}))

import { useSupabase } from '@/components/providers/supabase-provider'

describe('useAccidentStats', () => {
  let mockSupabaseRpc: ReturnType<typeof vi.fn>
  let mockSupabaseFrom: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()

    mockSupabaseRpc = vi.fn()
    mockSupabaseFrom = vi.fn()

    // Mock useSupabase hook to return mock client
    vi.mocked(useSupabase).mockReturnValue({
      supabase: {
        rpc: mockSupabaseRpc,
        from: mockSupabaseFrom,
      } as any,
    })
  })

  describe('Initial State', () => {
    it('should initialize with idle status and null data', () => {
      const { result } = renderHook(() => useAccidentStats())

      expect(result.current.stats).toBeNull()
      expect(result.current.status).toBe('idle')
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.hasData).toBe(false)
    })
  })

  describe('fetchStats', () => {
    it('should transition to loading state when fetching', async () => {
      // Arrange - Delay RPC response
      mockSupabaseRpc.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: mockHighRiskStats, error: null }), 100)
          )
      )

      const { result } = renderHook(() => useAccidentStats())

      // Act
      act(() => {
        result.current.fetchStats({
          latitude: TEST_COORDINATES.SHIBUYA_CROSSING.lat,
          longitude: TEST_COORDINATES.SHIBUYA_CROSSING.lng,
        })
      })

      // Assert - Should be loading
      expect(result.current.status).toBe('loading')
      expect(result.current.isLoading).toBe(true)

      // Wait for completion
      await waitFor(() => expect(result.current.status).toBe('loaded'))
    })

    it('should successfully fetch high-risk accident statistics', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue({
        data: mockHighRiskStats,
        error: null,
      })

      const { result } = renderHook(() => useAccidentStats())

      // Act
      await act(async () => {
        await result.current.fetchStats({
          latitude: TEST_COORDINATES.SHIBUYA_CROSSING.lat,
          longitude: TEST_COORDINATES.SHIBUYA_CROSSING.lng,
        })
      })

      // Assert
      await waitFor(() => {
        expect(result.current.status).toBe('loaded')
        expect(result.current.stats).toEqual(mockHighRiskStats)
        expect(result.current.error).toBeNull()
        expect(result.current.isLoading).toBe(false)
        expect(result.current.hasData).toBe(true)
      })
    })

    it('should handle empty results (zero accidents)', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue({
        data: mockEmptyAccidentStats,
        error: null,
      })

      const { result } = renderHook(() => useAccidentStats())

      // Act
      await act(async () => {
        await result.current.fetchStats({
          latitude: TEST_COORDINATES.SAFE_SUBURB.lat,
          longitude: TEST_COORDINATES.SAFE_SUBURB.lng,
        })
      })

      // Assert
      await waitFor(() => {
        expect(result.current.status).toBe('loaded')
        expect(result.current.stats?.total_accidents).toBe(0)
        expect(result.current.hasData).toBe(true) // Has data even if zero accidents
      })
    })

    it('should handle errors and set error state', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue(mockDatabaseError)

      const { result } = renderHook(() => useAccidentStats())

      // Act
      await act(async () => {
        await result.current.fetchStats({
          latitude: 35.6595,
          longitude: 139.7004,
        })
      })

      // Assert
      await waitFor(() => {
        expect(result.current.status).toBe('error')
        expect(result.current.error).toBeTruthy()
        expect(result.current.stats).toBeNull()
        expect(result.current.isLoading).toBe(false)
        expect(result.current.hasData).toBe(false)
      })
    })

    it('should use default radius and years if not provided', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue({
        data: mockMediumRiskStats,
        error: null,
      })

      const { result } = renderHook(() => useAccidentStats())

      // Act
      await act(async () => {
        await result.current.fetchStats({
          latitude: 35.6812,
          longitude: 139.7671,
          // No radius_meters or years provided
        })
      })

      // Assert
      expect(mockSupabaseRpc).toHaveBeenCalledWith('get_nearby_accident_stats', {
        p_latitude: 35.6812,
        p_longitude: 139.7671,
        p_radius_meters: 500, // Default
        p_years: 3, // Default
      })
    })

    it('should keep latest result when fetches resolve out of order', async () => {
      // Arrange
      mockSupabaseRpc
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve({ data: mockLowRiskStats, error: null }), 70)
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve({ data: mockHighRiskStats, error: null }), 10)
            })
        )

      const { result } = renderHook(() => useAccidentStats())

      // Act - Start two fetches rapidly; second should win.
      act(() => {
        result.current.fetchStats({
          latitude: 35.6595,
          longitude: 139.7004,
        })
        result.current.fetchStats({
          latitude: 35.6812,
          longitude: 139.7671,
        })
      })

      // Assert - Second response should become final state.
      await waitFor(() => {
        expect(result.current.status).toBe('loaded')
        expect(result.current.stats).toEqual(mockHighRiskStats)
      })

      // Ensure stale first response did not overwrite latest result.
      await new Promise((resolve) => setTimeout(resolve, 90))
      expect(result.current.stats).toEqual(mockHighRiskStats)
      expect(mockSupabaseRpc).toHaveBeenCalledTimes(2)
    })

    it('should invalidate in-flight fetch on reset', async () => {
      // Arrange
      mockSupabaseRpc.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ data: mockHighRiskStats, error: null }), 50)
          })
      )

      const { result } = renderHook(() => useAccidentStats())

      // Act
      act(() => {
        result.current.fetchStats({
          latitude: 35.6595,
          longitude: 139.7004,
        })
      })

      act(() => {
        result.current.reset()
      })

      // Assert
      await new Promise((resolve) => setTimeout(resolve, 70))
      expect(result.current.status).toBe('idle')
      expect(result.current.stats).toBeNull()
      expect(result.current.error).toBeNull()
    })

    it('should return AccidentStats on success', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue({
        data: mockHighRiskStats,
        error: null,
      })

      const { result } = renderHook(() => useAccidentStats())

      // Act
      let returnedStats
      await act(async () => {
        returnedStats = await result.current.fetchStats({
          latitude: 35.6595,
          longitude: 139.7004,
        })
      })

      // Assert
      expect(returnedStats).toEqual(mockHighRiskStats)
    })

    it('should return null on error', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue(mockDatabaseError)

      const { result } = renderHook(() => useAccidentStats())

      // Act
      let returnedStats
      await act(async () => {
        returnedStats = await result.current.fetchStats({
          latitude: 35.6595,
          longitude: 139.7004,
        })
      })

      // Assert
      expect(returnedStats).toBeNull()
    })
  })

  describe('enrichReport', () => {
    it('should enrich report with accident statistics', async () => {
      // Arrange - Mock report fetch
      const mockReport = {
        id: 'report-123',
        latitude: TEST_COORDINATES.SHIBUYA_CROSSING.lat,
        longitude: TEST_COORDINATES.SHIBUYA_CROSSING.lng,
        accident_stats: null,
        accident_risk_score: null,
      }

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockReport,
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      })

      mockSupabaseRpc.mockResolvedValue({
        data: mockHighRiskStats,
        error: null,
      })

      const { result } = renderHook(() => useAccidentStats())

      // Act
      await act(async () => {
        await result.current.enrichReport('report-123')
      })

      // Assert
      await waitFor(() => {
        expect(result.current.status).toBe('loaded')
        expect(result.current.stats).toEqual(mockHighRiskStats)
      })
    })

    it('should handle enrichment errors', async () => {
      // Arrange - Report not found
      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Report not found' },
        }),
      })

      const { result } = renderHook(() => useAccidentStats())

      // Act
      await act(async () => {
        await result.current.enrichReport('invalid-id')
      })

      // Assert
      await waitFor(() => {
        expect(result.current.status).toBe('error')
        expect(result.current.error).toBeTruthy()
      })
    })

    it('should return AccidentStats on successful enrichment', async () => {
      // Arrange
      const mockReport = {
        id: 'report-456',
        latitude: 35.6812,
        longitude: 139.7671,
      }

      mockSupabaseFrom.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockReport,
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      })

      mockSupabaseRpc.mockResolvedValue({
        data: mockMediumRiskStats,
        error: null,
      })

      const { result } = renderHook(() => useAccidentStats())

      // Act
      let returnedStats
      await act(async () => {
        returnedStats = await result.current.enrichReport('report-456')
      })

      // Assert
      expect(returnedStats).toEqual(mockMediumRiskStats)
    })
  })

  describe('reset', () => {
    it('should reset to initial state', async () => {
      // Arrange - Load some data first
      mockSupabaseRpc.mockResolvedValue({
        data: mockHighRiskStats,
        error: null,
      })

      const { result } = renderHook(() => useAccidentStats())

      await act(async () => {
        await result.current.fetchStats({
          latitude: 35.6595,
          longitude: 139.7004,
        })
      })

      // Verify data loaded
      await waitFor(() => expect(result.current.hasData).toBe(true))

      // Act - Reset
      act(() => {
        result.current.reset()
      })

      // Assert - Back to initial state
      expect(result.current.stats).toBeNull()
      expect(result.current.status).toBe('idle')
      expect(result.current.error).toBeNull()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.hasData).toBe(false)
    })

    it('should clear error state on reset', async () => {
      // Arrange - Trigger error
      mockSupabaseRpc.mockResolvedValue(mockDatabaseError)

      const { result } = renderHook(() => useAccidentStats())

      await act(async () => {
        await result.current.fetchStats({
          latitude: 35.6595,
          longitude: 139.7004,
        })
      })

      // Verify error state
      await waitFor(() => expect(result.current.status).toBe('error'))

      // Act - Reset
      act(() => {
        result.current.reset()
      })

      // Assert
      expect(result.current.error).toBeNull()
      expect(result.current.status).toBe('idle')
    })
  })

  describe('Derived State', () => {
    it('should correctly compute isLoading derived state', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue({
        data: mockHighRiskStats,
        error: null,
      })

      const { result } = renderHook(() => useAccidentStats())

      // Initial
      expect(result.current.isLoading).toBe(false)

      // During fetch
      act(() => {
        result.current.fetchStats({
          latitude: 35.6595,
          longitude: 139.7004,
        })
      })
      expect(result.current.isLoading).toBe(true)

      // After fetch
      await waitFor(() => expect(result.current.isLoading).toBe(false))
    })

    it('should correctly compute hasData derived state', async () => {
      // Arrange
      mockSupabaseRpc.mockResolvedValue({
        data: mockHighRiskStats,
        error: null,
      })

      const { result } = renderHook(() => useAccidentStats())

      // Initial
      expect(result.current.hasData).toBe(false)

      // After successful fetch
      await act(async () => {
        await result.current.fetchStats({
          latitude: 35.6595,
          longitude: 139.7004,
        })
      })

      await waitFor(() => expect(result.current.hasData).toBe(true))
    })
  })
})
