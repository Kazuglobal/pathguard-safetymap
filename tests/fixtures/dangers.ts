/**
 * Danger Report Fixture Data for TDD Tests
 *
 * Phase: Route Danger Report Feature
 */

import type { DangerReport } from '@/lib/types'

// Mock danger reports near route A (within 100m buffer)
export const mockDangerReportsNearRoute: DangerReport[] = [
  {
    id: 'danger-1',
    user_id: 'test-user-id',
    title: '交差点の見通しが悪い',
    description: '右側からの車が見えにくい',
    latitude: 35.6898,
    longitude: 139.6920,
    danger_type: '交通危険',
    danger_level: 3,
    status: 'verified',
    image_url: 'https://example.com/danger1.jpg',
    processed_image_urls: ['https://example.com/danger1_processed.jpg'],
    prefecture: '東京都',
    prefecture_code: 13,
    city: '渋谷区',
    municipality_code: '13113',
    town: '道玄坂',
    postal_code: '150-0043',
    geocode_source: 'mapbox',
    geocoded_at: '2025-01-10T09:00:00Z',
    geocode_confidence: 0.95,
    address_hash: 'abc123',
    created_at: '2025-01-10T09:00:00Z',
    updated_at: '2025-01-10T09:00:00Z',
  },
  {
    id: 'danger-2',
    user_id: 'test-user-id',
    title: '歩道が狭い',
    description: '自転車との接触に注意',
    latitude: 35.6902,
    longitude: 139.6970,
    danger_type: '歩行者危険',
    danger_level: 2,
    status: 'verified',
    image_url: 'https://example.com/danger2.jpg',
    processed_image_urls: null,
    prefecture: '東京都',
    prefecture_code: 13,
    city: '渋谷区',
    municipality_code: '13113',
    town: '神南',
    postal_code: '150-0041',
    geocode_source: 'mapbox',
    geocoded_at: '2025-01-11T10:00:00Z',
    geocode_confidence: 0.92,
    address_hash: 'def456',
    created_at: '2025-01-11T10:00:00Z',
    updated_at: '2025-01-11T10:00:00Z',
  },
  {
    id: 'danger-3',
    user_id: 'test-user-id',
    title: '夜間照明が不足',
    description: '暗くて危険',
    latitude: 35.6903,
    longitude: 139.6995,
    danger_type: '環境危険',
    danger_level: 1,
    status: 'pending',
    image_url: null,
    processed_image_urls: null,
    prefecture: '東京都',
    prefecture_code: 13,
    city: '渋谷区',
    municipality_code: '13113',
    town: '神南',
    postal_code: '150-0041',
    geocode_source: 'mapbox',
    geocoded_at: '2025-01-12T11:00:00Z',
    geocode_confidence: 0.88,
    address_hash: 'ghi789',
    created_at: '2025-01-12T11:00:00Z',
    updated_at: '2025-01-12T11:00:00Z',
  },
]

// Danger reports far from any route (more than 100m away)
export const mockDangerReportsFarFromRoute: DangerReport[] = [
  {
    id: 'danger-far-1',
    user_id: 'test-user-id',
    title: '遠くの危険箇所',
    description: 'ルートから遠い',
    latitude: 35.7000, // ~1km away
    longitude: 139.7200,
    danger_type: '交通危険',
    danger_level: 2,
    status: 'verified',
    image_url: null,
    processed_image_urls: null,
    prefecture: '東京都',
    prefecture_code: 13,
    city: '渋谷区',
    municipality_code: '13113',
    town: '広尾',
    postal_code: '150-0012',
    geocode_source: 'mapbox',
    geocoded_at: '2025-01-13T12:00:00Z',
    geocode_confidence: 0.90,
    address_hash: 'jkl012',
    created_at: '2025-01-13T12:00:00Z',
    updated_at: '2025-01-13T12:00:00Z',
  },
]

// All dangers combined for comprehensive tests
export const mockAllDangerReports: DangerReport[] = [
  ...mockDangerReportsNearRoute,
  ...mockDangerReportsFarFromRoute,
]

// Empty array for edge case tests
export const mockEmptyDangerReports: DangerReport[] = []

// Single danger report for simple tests
export const mockSingleDangerReport = mockDangerReportsNearRoute[0]

// Danger types for grouping tests
export const mockDangerTypes = ['交通危険', '歩行者危険', '環境危険']

// Danger levels for grouping tests
export const mockDangerLevels = [1, 2, 3]

// Helper to create mock danger report with overrides
export function createMockDangerReport(overrides: Partial<DangerReport> = {}): DangerReport {
  return {
    ...mockSingleDangerReport,
    id: `danger-${Date.now()}`,
    ...overrides,
  }
}

// Helper to generate dangers at specific coordinates
export function generateDangersAlongRoute(
  coordinates: [number, number][],
  count: number
): DangerReport[] {
  const dangers: DangerReport[] = []
  const step = Math.floor(coordinates.length / (count + 1))

  for (let i = 0; i < count; i++) {
    const coordIndex = Math.min((i + 1) * step, coordinates.length - 1)
    const [lng, lat] = coordinates[coordIndex]
    // Add small offset to simulate nearby but not exactly on route
    dangers.push(createMockDangerReport({
      id: `danger-generated-${i}`,
      latitude: lat + (Math.random() * 0.0005 - 0.00025),
      longitude: lng + (Math.random() * 0.0005 - 0.00025),
      danger_level: (i % 3) + 1,
      danger_type: mockDangerTypes[i % mockDangerTypes.length],
    }))
  }

  return dangers
}

// Mock route geometry for buffer tests (from routes.ts)
export const mockRouteGeometry: GeoJSON.LineString = {
  type: 'LineString',
  coordinates: [
    [139.6917, 35.6895],
    [139.6950, 35.6900],
    [139.7000, 35.6905],
  ],
}

// Invalid geometry for error tests
export const mockInvalidGeometry = {
  type: 'Point', // Wrong type
  coordinates: [139.6917, 35.6895],
} as unknown as GeoJSON.LineString
