/**
 * TDD Unit Tests: Traffic Accident Data Library
 *
 * Phase: Traffic Accident Statistics & Risk Score Feature
 * Target: lib/traffic-accident-data.ts
 *
 * Test Coverage:
 * - getAccidentStatsRPC: Success, error handling, edge cases
 * - getAccidentRiskLevel: All risk level thresholds
 * - enrichReportWithAccidents: Success, error handling, immutability
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'
import {
  mockHighRiskStats,
  mockMediumRiskStats,
  mockLowRiskStats,
  mockEmptyAccidentStats,
  mockDatabaseError,
  mockTimeoutError,
  createMockAccidentStats,
  TEST_COORDINATES,
  DEFAULT_RPC_PARAMS,
} from '@/tests/fixtures/accidents'

// Import functions to test (will fail initially - RED phase)
import {
  getAccidentStatsRPC,
  getAccidentRiskLevel,
  enrichReportWithAccidents,
} from '@/lib/traffic-accident-data'

describe('getAccidentStatsRPC', () => {
  let mockSupabase: SupabaseClient<Database>

  beforeEach(() => {
    // Create mock Supabase client
    mockSupabase = {
      rpc: vi.fn(),
    } as unknown as SupabaseClient<Database>
  })

  it('should successfully fetch high-risk accident statistics', async () => {
    // Arrange
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: mockHighRiskStats,
      error: null,
    } as any)

    // Act
    const result = await getAccidentStatsRPC(mockSupabase, {
      latitude: TEST_COORDINATES.SHIBUYA_CROSSING.lat,
      longitude: TEST_COORDINATES.SHIBUYA_CROSSING.lng,
      radius_meters: DEFAULT_RPC_PARAMS.radius_meters,
      years: DEFAULT_RPC_PARAMS.years,
    })

    // Assert
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_nearby_accident_stats', {
      p_latitude: TEST_COORDINATES.SHIBUYA_CROSSING.lat,
      p_longitude: TEST_COORDINATES.SHIBUYA_CROSSING.lng,
      p_radius_meters: DEFAULT_RPC_PARAMS.radius_meters,
      p_years: DEFAULT_RPC_PARAMS.years,
    })
    expect(result).toEqual(mockHighRiskStats)
    expect(result.risk_score).toBe(85)
    expect(result.total_accidents).toBe(127)
  })

  it('should successfully fetch medium-risk accident statistics', async () => {
    // Arrange
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: mockMediumRiskStats,
      error: null,
    } as any)

    // Act
    const result = await getAccidentStatsRPC(mockSupabase, {
      latitude: TEST_COORDINATES.TOKYO_STATION.lat,
      longitude: TEST_COORDINATES.TOKYO_STATION.lng,
      radius_meters: 500,
      years: 3,
    })

    // Assert
    expect(result.risk_score).toBe(48)
    expect(result.total_accidents).toBe(42)
  })

  it('should handle RPC returning array format (take first element)', async () => {
    // Arrange - Some RPC functions return arrays
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: [mockLowRiskStats], // Array format
      error: null,
    } as any)

    // Act
    const result = await getAccidentStatsRPC(mockSupabase, {
      latitude: 35.7090,
      longitude: 139.7319,
      radius_meters: 500,
      years: 3,
    })

    // Assert
    expect(result).toEqual(mockLowRiskStats)
  })

  it('should handle empty results (zero accidents)', async () => {
    // Arrange
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: mockEmptyAccidentStats,
      error: null,
    } as any)

    // Act
    const result = await getAccidentStatsRPC(mockSupabase, {
      latitude: TEST_COORDINATES.SAFE_SUBURB.lat,
      longitude: TEST_COORDINATES.SAFE_SUBURB.lng,
      radius_meters: 500,
      years: 3,
    })

    // Assert
    expect(result.total_accidents).toBe(0)
    expect(result.risk_score).toBe(0)
    expect(result.nearest_accidents).toHaveLength(0)
  })

  it('should throw error when RPC fails', async () => {
    // Arrange
    vi.mocked(mockSupabase.rpc).mockResolvedValue(mockDatabaseError as any)

    // Act & Assert
    await expect(
      getAccidentStatsRPC(mockSupabase, {
        latitude: 35.6595,
        longitude: 139.7004,
        radius_meters: 500,
        years: 3,
      })
    ).rejects.toThrow('Failed to fetch accident statistics')
  })

  it('should throw error on network timeout', async () => {
    // Arrange
    vi.mocked(mockSupabase.rpc).mockResolvedValue(mockTimeoutError as any)

    // Act & Assert
    await expect(
      getAccidentStatsRPC(mockSupabase, {
        latitude: 35.6595,
        longitude: 139.7004,
        radius_meters: 500,
        years: 3,
      })
    ).rejects.toThrow('Network request timeout')
  })

  it('should use default parameters when not provided', async () => {
    // Arrange
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: mockLowRiskStats,
      error: null,
    } as any)

    // Act
    await getAccidentStatsRPC(mockSupabase, {
      latitude: 35.7090,
      longitude: 139.7319,
      // radius_meters and years should use defaults
    })

    // Assert
    expect(mockSupabase.rpc).toHaveBeenCalledWith('get_nearby_accident_stats', {
      p_latitude: 35.7090,
      p_longitude: 139.7319,
      p_radius_meters: 500, // Default
      p_years: 3, // Default
    })
  })
})

describe('getAccidentRiskLevel', () => {
  it('should return "low" for risk score 0-29', () => {
    expect(getAccidentRiskLevel(0).level).toBe('low')
    expect(getAccidentRiskLevel(15).level).toBe('low')
    expect(getAccidentRiskLevel(29).level).toBe('low')
    // Verify full object structure for one case
    const result = getAccidentRiskLevel(0)
    expect(result.label).toBe('低リスク')
    expect(result.emoji).toBe('🟢')
    expect(result.color).toBe('#16A34A')
    expect(result.bgColor).toBe('#DCFCE7')
    expect(result.description).toContain('近隣での事故記録は少ない')
  })

  it('should return "medium" for risk score 30-59', () => {
    expect(getAccidentRiskLevel(30).level).toBe('medium')
    expect(getAccidentRiskLevel(48).level).toBe('medium')
    expect(getAccidentRiskLevel(59).level).toBe('medium')
    // Verify UI metadata
    const result = getAccidentRiskLevel(48)
    expect(result.emoji).toBe('🟡')
    expect(result.label).toBe('中リスク')
  })

  it('should return "high" for risk score 60-79', () => {
    expect(getAccidentRiskLevel(60).level).toBe('high')
    expect(getAccidentRiskLevel(70).level).toBe('high')
    expect(getAccidentRiskLevel(79).level).toBe('high')
    // Verify UI metadata
    const result = getAccidentRiskLevel(70)
    expect(result.emoji).toBe('🟠')
    expect(result.label).toBe('高リスク')
  })

  it('should return "very_high" for risk score 80-100', () => {
    expect(getAccidentRiskLevel(80).level).toBe('very_high')
    expect(getAccidentRiskLevel(90).level).toBe('very_high')
    expect(getAccidentRiskLevel(100).level).toBe('very_high')
    // Verify UI metadata
    const result = getAccidentRiskLevel(90)
    expect(result.emoji).toBe('🔴')
    expect(result.label).toBe('最高リスク')
  })

  it('should handle edge case: negative scores as low risk', () => {
    expect(getAccidentRiskLevel(-10).level).toBe('low')
  })

  it('should handle edge case: scores above 100 as very high risk', () => {
    expect(getAccidentRiskLevel(150).level).toBe('very_high')
  })
})

describe('enrichReportWithAccidents', () => {
  let mockSupabase: SupabaseClient<Database>

  beforeEach(() => {
    mockSupabase = {
      rpc: vi.fn(),
      from: vi.fn(),
    } as unknown as SupabaseClient<Database>
  })

  it('should enrich report with accident statistics', async () => {
    // Arrange - Mock report fetch
    const mockReport = {
      id: 'report-123',
      latitude: TEST_COORDINATES.SHIBUYA_CROSSING.lat,
      longitude: TEST_COORDINATES.SHIBUYA_CROSSING.lng,
      accident_stats: null,
      accident_risk_score: null,
    }

    const updatedReport = {
      ...mockReport,
      accident_stats: mockHighRiskStats,
      accident_risk_score: mockHighRiskStats.risk_score,
    }

    // First from() call - fetch report
    const mockFetchChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockReport,
        error: null,
      }),
    }

    // Second from() call - update report
    const mockUpdateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: updatedReport,
        error: null,
      }),
    }

    // Mock from() to return different chains on each call
    vi.mocked(mockSupabase.from)
      .mockReturnValueOnce(mockFetchChain as any)
      .mockReturnValueOnce(mockUpdateChain as any)

    // Mock RPC call
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: mockHighRiskStats,
      error: null,
    } as any)

    // Act
    const result = await enrichReportWithAccidents(mockSupabase, 'report-123')

    // Assert
    expect(result).toBeDefined()
    expect(result.accident_stats).toEqual(mockHighRiskStats)
    expect(result.accident_risk_score).toBe(85)
  })

  it('should throw error if report not found', async () => {
    // Arrange
    const mockFrom = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Report not found', code: 'PGRST116' },
      }),
    }

    vi.mocked(mockSupabase.from).mockReturnValue(mockFrom as any)

    // Act & Assert
    await expect(enrichReportWithAccidents(mockSupabase, 'invalid-id')).rejects.toThrow()
  })

  it('should maintain immutability (not mutate original data)', async () => {
    // Arrange
    const mockReport = {
      id: 'report-456',
      latitude: 35.6812,
      longitude: 139.7671,
      accident_stats: null,
      accident_risk_score: null,
      title: 'Original Title',
    }

    const updatedReport = {
      ...mockReport,
      accident_stats: mockMediumRiskStats,
      accident_risk_score: mockMediumRiskStats.risk_score,
    }

    // First from() call - fetch report
    const mockFetchChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: mockReport,
        error: null,
      }),
    }

    // Second from() call - update report
    const mockUpdateChain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: updatedReport,
        error: null,
      }),
    }

    vi.mocked(mockSupabase.from)
      .mockReturnValueOnce(mockFetchChain as any)
      .mockReturnValueOnce(mockUpdateChain as any)

    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: mockMediumRiskStats,
      error: null,
    } as any)

    // Act
    const originalReportCopy = { ...mockReport }
    await enrichReportWithAccidents(mockSupabase, 'report-456')

    // Assert - Original should not be mutated
    expect(mockReport.accident_stats).toBeNull()
    expect(mockReport.accident_risk_score).toBeNull()
    expect(mockReport).toEqual(originalReportCopy)
  })
})
