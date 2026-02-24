/**
 * Route Fixture Data for TDD Tests
 *
 * Phase 2.1: School Route Management
 */

import type { UserRoute, CreateRouteInput, UpdateRouteInput } from '@/lib/types'

// Mock user for authenticated tests
export const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
}

// Mock route data
export const mockRoutes: UserRoute[] = [
  {
    id: 'route-1',
    user_id: 'test-user-id',
    name: '通学路A（主要ルート）',
    description: '毎日使う最短ルート',
    start_lat: 35.6895,
    start_lng: 139.6917,
    end_lat: 35.6905,
    end_lng: 139.7000,
    start_address: '東京都渋谷区道玄坂1-1-1',
    end_address: '東京都渋谷区神南1-1-1',
    route_geometry: {
      type: 'LineString',
      coordinates: [
        [139.6917, 35.6895],
        [139.6950, 35.6900],
        [139.7000, 35.6905],
      ],
    },
    distance_meters: 850,
    estimated_time_minutes: 11,
    is_favorite: true,
    created_at: '2025-01-10T08:00:00Z',
    updated_at: '2025-01-10T08:00:00Z',
  },
  {
    id: 'route-2',
    user_id: 'test-user-id',
    name: '通学路B（雨の日用）',
    description: '雨の日はこちら。屋根のある道が多い',
    start_lat: 35.6895,
    start_lng: 139.6917,
    end_lat: 35.6905,
    end_lng: 139.7000,
    start_address: '東京都渋谷区道玄坂1-1-1',
    end_address: '東京都渋谷区神南1-1-1',
    route_geometry: {
      type: 'LineString',
      coordinates: [
        [139.6917, 35.6895],
        [139.6930, 35.6910],
        [139.6980, 35.6920],
        [139.7000, 35.6905],
      ],
    },
    distance_meters: 1200,
    estimated_time_minutes: 15,
    is_favorite: false,
    created_at: '2025-01-12T10:00:00Z',
    updated_at: '2025-01-12T10:00:00Z',
  },
  {
    id: 'route-3',
    user_id: 'test-user-id',
    name: '公園経由ルート',
    description: null,
    start_lat: 35.6895,
    start_lng: 139.6917,
    end_lat: 35.6905,
    end_lng: 139.7000,
    start_address: '東京都渋谷区道玄坂1-1-1',
    end_address: '東京都渋谷区神南1-1-1',
    route_geometry: null,
    distance_meters: 1500,
    estimated_time_minutes: 19,
    is_favorite: false,
    created_at: '2025-01-15T14:00:00Z',
    updated_at: '2025-01-15T14:00:00Z',
  },
]

// Single route for simple tests
export const mockSingleRoute = mockRoutes[0]

// Primary/favorite route
export const mockPrimaryRoute = mockRoutes.find(r => r.is_favorite) || mockRoutes[0]

// Empty routes array for empty state tests
export const mockEmptyRoutes: UserRoute[] = []

// Input for creating a new route
export const mockCreateRouteInput: CreateRouteInput = {
  name: '新しい通学路',
  description: '新規作成テスト用',
  start_lat: 35.6800,
  start_lng: 139.6800,
  end_lat: 35.6900,
  end_lng: 139.6900,
  start_address: '出発地点',
  end_address: '到着地点',
  route_geometry: {
    type: 'LineString',
    coordinates: [
      [139.6800, 35.6800],
      [139.6900, 35.6900],
    ],
  },
}

// Input for updating a route
export const mockUpdateRouteInput: UpdateRouteInput = {
  name: '更新された通学路',
  description: '更新テスト用',
  is_favorite: true,
}

// Route with very long name (for validation tests)
export const mockRouteWithLongName = {
  ...mockSingleRoute,
  name: 'あ'.repeat(101), // 101 characters, exceeds 100 limit
}

// Route with minimal points (edge case)
export const mockRouteWithMinimalPoints: UserRoute = {
  ...mockSingleRoute,
  id: 'route-minimal',
  route_geometry: {
    type: 'LineString',
    coordinates: [
      [139.6917, 35.6895],
      [139.7000, 35.6905],
    ],
  },
}

// Route with distance over 1km (for display formatting tests)
export const mockRouteLongDistance: UserRoute = {
  ...mockSingleRoute,
  id: 'route-long',
  distance_meters: 2500,
  estimated_time_minutes: 31,
}

// Route with distance under 1km
export const mockRouteShortDistance: UserRoute = {
  ...mockSingleRoute,
  id: 'route-short',
  distance_meters: 450,
  estimated_time_minutes: 6,
}

// Error responses
export const mockDatabaseError = {
  message: 'Database connection failed',
  code: 'PGRST301',
}

export const mockAuthError = {
  message: 'Not authenticated',
  code: 'AUTH001',
}

// Helper to create mock Supabase responses
export function createMockSupabaseResponse<T>(data: T, error: any = null) {
  return Promise.resolve({ data, error })
}

// Helper to create mock route with overrides
export function createMockRoute(overrides: Partial<UserRoute> = {}): UserRoute {
  return {
    ...mockSingleRoute,
    id: `route-${Date.now()}`,
    ...overrides,
  }
}

// Helper to generate test points for route creation
export function generateTestPoints(count: number): [number, number][] {
  const points: [number, number][] = []
  const baseLng = 139.6917
  const baseLat = 35.6895

  for (let i = 0; i < count; i++) {
    points.push([baseLng + (i * 0.005), baseLat + (i * 0.002)])
  }

  return points
}
