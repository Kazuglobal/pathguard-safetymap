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

  it('should sanitize v1 AccidentStats coordinates and fallback to request coordinates when needed', async () => {
    // Arrange
    const invalidV1Response = {
      ...mockHighRiskStats,
      latitude: 999,
      longitude: 999,
      nearest_accidents: mockHighRiskStats.nearest_accidents.map((accident, index) =>
        index === 0
          ? { ...accident, latitude: 91, longitude: 181 }
          : accident
      ),
    }

    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: invalidV1Response,
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
    expect(result.latitude).toBe(TEST_COORDINATES.SHIBUYA_CROSSING.lat)
    expect(result.longitude).toBe(TEST_COORDINATES.SHIBUYA_CROSSING.lng)
    expect(result.nearest_accidents[0].latitude).toBeUndefined()
    expect(result.nearest_accidents[0].longitude).toBeUndefined()
    expect(result.nearest_accidents[1].latitude).toBeDefined()
    expect(result.nearest_accidents[1].longitude).toBeDefined()
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

  it('should normalize RPC v2 shape into AccidentStats', async () => {
    // Arrange - Production RPC shape
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: {
        total_accidents: 137,
        risk_score: 90,
        fatal_accidents: 1,
        child_involved: 0,
        pedestrian_involved: 2,
        by_year: { '2021': 44, '2022': 40, '2023': 53 },
        by_weather: { 晴: 103, 曇: 16, 雨: 18 },
        by_time_of_day: {
          other: 101,
          '17-19_evening': 8,
          '14-17_after_school': 12,
          '07-09_morning_commute': 16,
        },
        by_accident_type: {
          車両単独: 4,
          人対車両_その他: 23,
          人対車両_横断中: 15,
          車両相互_その他: 57,
          車両相互_正面衝突: 37,
        },
        nearest_accidents: [
          {
            type: '人対車両_その他',
            year: 2022,
            severity: 'injury',
            distance_m: 22.3,
            involved_child: false,
            involved_pedestrian: null,
          },
        ],
        search_params: {
          years: 5,
          latitude: 35.6595,
          longitude: 139.7004,
          radius_meters: 300,
        },
      },
      error: null,
    } as any)

    // Act
    const result = await getAccidentStatsRPC(mockSupabase, {
      latitude: 35.6595,
      longitude: 139.7004,
      radius_meters: 300,
      years: 5,
    })

    // Assert
    expect(result.total_accidents).toBe(137)
    expect(result.risk_score).toBe(90)
    expect(result.radius_meters).toBe(300)
    expect(result.years_analyzed).toBe(5)
    expect(result.pedestrian_accidents).toBe(2)
    expect(result.accidents_by_hour).toHaveLength(24)
    expect(result.accidents_by_hour.every((hour) => hour.count === 0)).toBe(true)
    expect(result.time_buckets).toBeDefined()
    expect(result.time_buckets?.some((bucket) => bucket.label.includes('14-17時') && bucket.count === 12)).toBe(true)
    expect(result.accident_types[0].count).toBeGreaterThanOrEqual(result.accident_types[1].count)
    expect(result.weather_conditions.some((item) => item.condition === '晴' && item.count === 103)).toBe(true)
    expect(result.accidents_by_year.map((item) => item.year)).toEqual([2021, 2022, 2023])
    expect(result.nearest_accidents[0].distance_meters).toBe(22)
    expect(result.nearest_accidents[0].accident_date).toBe('2022')
    expect(result.nearest_accidents[0].has_pedestrian).toBe(false)
    // Without coordinates in RPC response, they should be undefined
    expect(result.nearest_accidents[0].latitude).toBeUndefined()
    expect(result.nearest_accidents[0].longitude).toBeUndefined()
    expect(result.nearest_accidents[0].id).toBeUndefined()
  })

  it('should include coordinates in normalized nearest_accidents when RPC v2 provides them', async () => {
    // Arrange - RPC v2 response with coordinates
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: {
        total_accidents: 10,
        risk_score: 40,
        fatal_accidents: 0,
        child_involved: 0,
        pedestrian_involved: 1,
        by_year: { '2023': 10 },
        by_weather: { 晴: 10 },
        by_time_of_day: { other: 10 },
        by_accident_type: { 追突: 10 },
        nearest_accidents: [
          {
            id: 42,
            latitude: 35.6598,
            longitude: 139.7008,
            type: '人対車両_その他',
            year: 2023,
            severity: 'injury',
            distance_m: 22.3,
            involved_child: false,
            involved_pedestrian: true,
          },
        ],
        search_params: {
          years: 3,
          latitude: 35.6595,
          longitude: 139.7004,
          radius_meters: 500,
        },
      },
      error: null,
    } as any)

    // Act
    const result = await getAccidentStatsRPC(mockSupabase, {
      latitude: 35.6595,
      longitude: 139.7004,
    })

    // Assert
    expect(result.nearest_accidents[0].id).toBe(42)
    expect(result.nearest_accidents[0].latitude).toBe(35.6598)
    expect(result.nearest_accidents[0].longitude).toBe(139.7008)
    expect(result.nearest_accidents[0].distance_meters).toBe(22)
  })

  it('should accept numeric-string coordinates in normalized nearest_accidents', async () => {
    // Arrange - RPC v2 response with numeric strings
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: {
        total_accidents: 10,
        risk_score: 40,
        fatal_accidents: 0,
        child_involved: 0,
        pedestrian_involved: 1,
        by_year: { '2023': 10 },
        by_weather: { 晴: 10 },
        by_time_of_day: { other: 10 },
        by_accident_type: { 追突: 10 },
        nearest_accidents: [
          {
            id: 44,
            latitude: '35.6598',
            longitude: '139.7008',
            type: '人対車両_その他',
            year: 2023,
            severity: 'injury',
            distance_m: 22.3,
            involved_child: false,
            involved_pedestrian: true,
          },
        ],
        search_params: {
          years: 3,
          latitude: 35.6595,
          longitude: 139.7004,
          radius_meters: 500,
        },
      },
      error: null,
    } as any)

    // Act
    const result = await getAccidentStatsRPC(mockSupabase, {
      latitude: 35.6595,
      longitude: 139.7004,
    })

    // Assert
    expect(result.nearest_accidents[0].latitude).toBe(35.6598)
    expect(result.nearest_accidents[0].longitude).toBe(139.7008)
  })

  it('should fallback to request coordinates when RPC v2 search_params coordinates are invalid', async () => {
    // Arrange
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: {
        total_accidents: 10,
        risk_score: 40,
        fatal_accidents: 0,
        child_involved: 0,
        pedestrian_involved: 1,
        by_year: { '2023': 10 },
        by_weather: { 晴: 10 },
        by_time_of_day: { other: 10 },
        by_accident_type: { 追突: 10 },
        nearest_accidents: [],
        search_params: {
          years: 3,
          latitude: 999,
          longitude: 999,
          radius_meters: 500,
        },
      },
      error: null,
    } as any)

    // Act
    const result = await getAccidentStatsRPC(mockSupabase, {
      latitude: 35.6595,
      longitude: 139.7004,
    })

    // Assert
    expect(result.latitude).toBe(35.6595)
    expect(result.longitude).toBe(139.7004)
  })

  it('should discard out-of-range coordinates in normalized nearest_accidents', async () => {
    // Arrange - RPC v2 response with invalid coordinates
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: {
        total_accidents: 10,
        risk_score: 40,
        fatal_accidents: 0,
        child_involved: 0,
        pedestrian_involved: 1,
        by_year: { '2023': 10 },
        by_weather: { 晴: 10 },
        by_time_of_day: { other: 10 },
        by_accident_type: { 追突: 10 },
        nearest_accidents: [
          {
            id: 43,
            latitude: 95,
            longitude: 190,
            type: '人対車両_その他',
            year: 2023,
            severity: 'injury',
            distance_m: 22.3,
            involved_child: false,
            involved_pedestrian: true,
          },
        ],
        search_params: {
          years: 3,
          latitude: 35.6595,
          longitude: 139.7004,
          radius_meters: 500,
        },
      },
      error: null,
    } as any)

    // Act
    const result = await getAccidentStatsRPC(mockSupabase, {
      latitude: 35.6595,
      longitude: 139.7004,
    })

    // Assert
    expect(result.nearest_accidents[0].id).toBe(43)
    expect(result.nearest_accidents[0].latitude).toBeUndefined()
    expect(result.nearest_accidents[0].longitude).toBeUndefined()
  })

  it('should throw when RPC returns an empty array', async () => {
    // Arrange
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: [],
      error: null,
    } as any)

    // Act & Assert
    await expect(
      getAccidentStatsRPC(mockSupabase, {
        latitude: 35.7090,
        longitude: 139.7319,
        radius_meters: 500,
        years: 3,
      })
    ).rejects.toThrow('Invalid accident statistics response')
  })

  it('should throw when RPC returns null', async () => {
    // Arrange
    vi.mocked(mockSupabase.rpc).mockResolvedValue({
      data: null,
      error: null,
    } as any)

    // Act & Assert
    await expect(
      getAccidentStatsRPC(mockSupabase, {
        latitude: 35.7090,
        longitude: 139.7319,
        radius_meters: 500,
        years: 3,
      })
    ).rejects.toThrow('Invalid accident statistics response')
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
