/**
 * Traffic Accident Statistics Fixture Data for TDD Tests
 *
 * Phase: Traffic Accident Statistics & Risk Score Feature
 */

import type { AccidentStats } from '@/lib/traffic-accident-data'

// High-risk location (Shibuya Crossing)
export const mockHighRiskStats: AccidentStats = {
  latitude: 35.6595,
  longitude: 139.7004,
  radius_meters: 500,
  years_analyzed: 3,

  total_accidents: 127,
  risk_score: 85, // very_high

  fatal_accidents: 3,
  serious_accidents: 18,
  minor_accidents: 106,

  pedestrian_accidents: 45,
  bicycle_accidents: 28,
  motorcycle_accidents: 22,
  car_accidents: 32,
  child_involved: 12,
  elderly_involved: 24,

  accidents_by_hour: [
    { hour: 0, count: 2, is_school_time: false },
    { hour: 1, count: 1, is_school_time: false },
    { hour: 2, count: 0, is_school_time: false },
    { hour: 3, count: 0, is_school_time: false },
    { hour: 4, count: 1, is_school_time: false },
    { hour: 5, count: 3, is_school_time: false },
    { hour: 6, count: 5, is_school_time: false },
    { hour: 7, count: 12, is_school_time: true }, // School time
    { hour: 8, count: 15, is_school_time: true }, // School time
    { hour: 9, count: 8, is_school_time: false },
    { hour: 10, count: 6, is_school_time: false },
    { hour: 11, count: 7, is_school_time: false },
    { hour: 12, count: 9, is_school_time: false },
    { hour: 13, count: 6, is_school_time: false },
    { hour: 14, count: 10, is_school_time: true }, // School time
    { hour: 15, count: 13, is_school_time: true }, // School time
    { hour: 16, count: 11, is_school_time: true }, // School time
    { hour: 17, count: 7, is_school_time: false },
    { hour: 18, count: 5, is_school_time: false },
    { hour: 19, count: 3, is_school_time: false },
    { hour: 20, count: 2, is_school_time: false },
    { hour: 21, count: 1, is_school_time: false },
    { hour: 22, count: 0, is_school_time: false },
    { hour: 23, count: 0, is_school_time: false },
  ],

  accident_types: [
    { type: '車両相互', count: 42, is_pedestrian_related: false },
    { type: '歩行者横断中', count: 28, is_pedestrian_related: true },
    { type: '出会い頭', count: 22, is_pedestrian_related: false },
    { type: '右左折時', count: 18, is_pedestrian_related: false },
    { type: '追突', count: 17, is_pedestrian_related: false },
  ],

  weather_conditions: [
    { condition: '晴れ', count: 89 },
    { condition: '曇り', count: 23 },
    { condition: '雨', count: 13 },
    { condition: '雪', count: 2 },
  ],

  accidents_by_year: [
    { year: 2023, count: 48 },
    { year: 2024, count: 42 },
    { year: 2025, count: 37 },
  ],

  nearest_accidents: [
    {
      id: 10001,
      latitude: 35.6598,
      longitude: 139.7008,
      distance_meters: 45,
      accident_date: '2025-01-15',
      severity: 'serious',
      type: '歩行者横断中',
      has_child: true,
      has_pedestrian: true,
    },
    {
      id: 10002,
      latitude: 35.6601,
      longitude: 139.7012,
      distance_meters: 78,
      accident_date: '2024-12-20',
      severity: 'minor',
      type: '右左折時',
      has_child: false,
      has_pedestrian: true,
    },
    {
      id: 10003,
      latitude: 35.6588,
      longitude: 139.6998,
      distance_meters: 92,
      accident_date: '2024-11-05',
      severity: 'fatal',
      type: '車両相互',
      has_child: false,
      has_pedestrian: false,
    },
    {
      id: 10004,
      latitude: 35.6605,
      longitude: 139.7015,
      distance_meters: 110,
      accident_date: '2024-10-18',
      severity: 'serious',
      type: '出会い頭',
      has_child: true,
      has_pedestrian: false,
    },
    {
      id: 10005,
      latitude: 35.6610,
      longitude: 139.6990,
      distance_meters: 135,
      accident_date: '2024-09-30',
      severity: 'minor',
      type: '追突',
      has_child: false,
      has_pedestrian: false,
    },
  ],
}

// Medium-risk location
export const mockMediumRiskStats: AccidentStats = {
  latitude: 35.6812,
  longitude: 139.7671,
  radius_meters: 500,
  years_analyzed: 3,

  total_accidents: 42,
  risk_score: 48, // medium

  fatal_accidents: 0,
  serious_accidents: 5,
  minor_accidents: 37,

  pedestrian_accidents: 12,
  bicycle_accidents: 15,
  motorcycle_accidents: 8,
  car_accidents: 7,
  child_involved: 3,
  elderly_involved: 8,

  accidents_by_hour: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hour >= 7 && hour <= 19 ? Math.floor(Math.random() * 4) : Math.floor(Math.random() * 2),
    is_school_time: (hour >= 7 && hour <= 8) || (hour >= 14 && hour <= 16),
  })),

  accident_types: [
    { type: '出会い頭', count: 15, is_pedestrian_related: false },
    { type: '右左折時', count: 12, is_pedestrian_related: false },
    { type: '追突', count: 10, is_pedestrian_related: false },
    { type: '歩行者横断中', count: 5, is_pedestrian_related: true },
  ],

  weather_conditions: [
    { condition: '晴れ', count: 32 },
    { condition: '曇り', count: 7 },
    { condition: '雨', count: 3 },
  ],

  accidents_by_year: [
    { year: 2023, count: 16 },
    { year: 2024, count: 14 },
    { year: 2025, count: 12 },
  ],

  nearest_accidents: [
    {
      distance_meters: 125,
      accident_date: '2025-01-08',
      severity: 'minor',
      type: '出会い頭',
      has_child: false,
      has_pedestrian: false,
    },
  ],
}

// Low-risk location
export const mockLowRiskStats: AccidentStats = {
  latitude: 35.7090,
  longitude: 139.7319,
  radius_meters: 500,
  years_analyzed: 3,

  total_accidents: 8,
  risk_score: 15, // low

  fatal_accidents: 0,
  serious_accidents: 1,
  minor_accidents: 7,

  pedestrian_accidents: 2,
  bicycle_accidents: 3,
  motorcycle_accidents: 2,
  car_accidents: 1,
  child_involved: 0,
  elderly_involved: 1,

  accidents_by_hour: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: Math.random() > 0.7 ? 1 : 0,
    is_school_time: (hour >= 7 && hour <= 8) || (hour >= 14 && hour <= 16),
  })),

  accident_types: [
    { type: '追突', count: 4, is_pedestrian_related: false },
    { type: '出会い頭', count: 3, is_pedestrian_related: false },
    { type: '右左折時', count: 1, is_pedestrian_related: false },
  ],

  weather_conditions: [
    { condition: '晴れ', count: 6 },
    { condition: '曇り', count: 2 },
  ],

  accidents_by_year: [
    { year: 2023, count: 3 },
    { year: 2024, count: 3 },
    { year: 2025, count: 2 },
  ],

  nearest_accidents: [],
}

// Zero accidents (very safe location)
export const mockEmptyAccidentStats: AccidentStats = {
  latitude: 35.7500,
  longitude: 139.8000,
  radius_meters: 500,
  years_analyzed: 3,

  total_accidents: 0,
  risk_score: 0, // safe

  fatal_accidents: 0,
  serious_accidents: 0,
  minor_accidents: 0,

  pedestrian_accidents: 0,
  bicycle_accidents: 0,
  motorcycle_accidents: 0,
  car_accidents: 0,
  child_involved: 0,
  elderly_involved: 0,

  accidents_by_hour: Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: 0,
    is_school_time: (hour >= 7 && hour <= 8) || (hour >= 14 && hour <= 16),
  })),

  accident_types: [],

  weather_conditions: [],

  accidents_by_year: [
    { year: 2023, count: 0 },
    { year: 2024, count: 0 },
    { year: 2025, count: 0 },
  ],

  nearest_accidents: [],
}

// Mock RPC response (database returns this format)
export const mockAccidentStatsRPC = (stats: AccidentStats) => ({
  data: stats,
  error: null,
})

// Mock database error
export const mockDatabaseError = {
  data: null,
  error: {
    message: 'Failed to fetch accident statistics',
    code: 'PGRST116',
    details: 'RPC function get_nearby_accident_stats failed',
    hint: null,
  },
}

// Mock network timeout error
export const mockTimeoutError = {
  data: null,
  error: {
    message: 'Network request timeout',
    code: 'NETWORK_ERROR',
    details: 'Request took too long to complete',
    hint: null,
  },
}

// Helper to create custom accident stats
export function createMockAccidentStats(
  overrides: Partial<AccidentStats> = {}
): AccidentStats {
  return {
    ...mockLowRiskStats,
    ...overrides,
  }
}

// Helper to create RPC response with custom data
export function createMockRPCResponse(stats: AccidentStats) {
  return {
    data: stats,
    error: null,
  }
}

// Helper to create error response
export function createMockErrorResponse(errorMessage: string, errorCode = 'UNKNOWN_ERROR') {
  return {
    data: null,
    error: {
      message: errorMessage,
      code: errorCode,
      details: null,
      hint: null,
    },
  }
}

// Test coordinates
export const TEST_COORDINATES = {
  SHIBUYA_CROSSING: { lat: 35.6595, lng: 139.7004 },
  TOKYO_STATION: { lat: 35.6812, lng: 139.7671 },
  SAFE_SUBURB: { lat: 35.7500, lng: 139.8000 },
}

// Default RPC parameters
export const DEFAULT_RPC_PARAMS = {
  radius_meters: 500,
  years: 3,
}
