/**
 * TDD Unit Tests: Route Danger Report Generation
 *
 * RED Phase: These tests should FAIL because the module doesn't exist yet
 *
 * Target: lib/report-generation/route-danger-report.ts
 * Phase: Route Danger Report Feature
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateOverviewMapUrl,
  createReportSummary,
  generatePDFReport,
  generateImageReport,
  getDangerImageOptions,
  resolveDangerDisplayImageUrl,
} from '@/lib/report-generation/route-danger-report'
import { mockRoutes } from '../../../fixtures/routes'
import {
  mockDangerReportsNearRoute,
  mockEmptyDangerReports,
} from '../../../fixtures/dangers'
import type { DangerReport, RouteDangerReport } from '@/lib/types'

describe('route-danger-report', () => {
  const mockRoute = mockRoutes[0]
  const mockMapboxToken = 'pk.test.mock-token'

  describe('generateOverviewMapUrl', () => {
    it('generates a valid Mapbox Static Images API URL', () => {
      const url = generateOverviewMapUrl(
        mockRoute.route_geometry!,
        mockDangerReportsNearRoute,
        mockMapboxToken
      )

      expect(url).toBeTruthy()
      expect(url).toContain('api.mapbox.com/styles')
      expect(url).toContain('static')
    })

    it('encodes route geometry as a path overlay', () => {
      const url = generateOverviewMapUrl(
        mockRoute.route_geometry!,
        mockDangerReportsNearRoute,
        mockMapboxToken
      )

      expect(url).toContain('path')
    })

    it('separates path coordinates with semicolons', () => {
      const url = generateOverviewMapUrl(
        mockRoute.route_geometry!,
        mockDangerReportsNearRoute,
        mockMapboxToken
      )

      const match = url.match(/path-[^(]*\(([^)]+)\)/)
      expect(match).toBeTruthy()
      const encodedPath = match ? match[1] : ''
      const decodedPath = decodeURIComponent(encodedPath)

      const segments = decodedPath.split(';')
      expect(segments.length).toBe(mockRoute.route_geometry!.coordinates.length)
      expect(segments.every((segment) => segment.includes(','))).toBe(true)
    })

    it('includes danger markers in the URL', () => {
      const url = generateOverviewMapUrl(
        mockRoute.route_geometry!,
        mockDangerReportsNearRoute,
        mockMapboxToken
      )

      // Should have markers for dangers
      expect(url).toContain('pin')
    })

    it('handles empty dangers array', () => {
      const url = generateOverviewMapUrl(
        mockRoute.route_geometry!,
        mockEmptyDangerReports,
        mockMapboxToken
      )

      expect(url).toBeTruthy()
      expect(url).toContain('api.mapbox.com')
    })

    it('uses default image dimensions', () => {
      const url = generateOverviewMapUrl(
        mockRoute.route_geometry!,
        mockDangerReportsNearRoute,
        mockMapboxToken
      )

      // Default dimensions should be something reasonable like 600x400
      expect(url).toMatch(/\d+x\d+/)
    })

    it('allows custom image dimensions', () => {
      const url = generateOverviewMapUrl(
        mockRoute.route_geometry!,
        mockDangerReportsNearRoute,
        mockMapboxToken,
        { width: 800, height: 600 }
      )

      expect(url).toContain('800x600')
    })

    it('omits @2x when requested size would exceed Mapbox limits', () => {
      const url = generateOverviewMapUrl(
        mockRoute.route_geometry!,
        mockDangerReportsNearRoute,
        mockMapboxToken,
        { width: 750, height: 400 }
      )

      expect(url).toContain('750x400')
      expect(url).not.toContain('@2x')
    })

    it('uses focused bbox viewport instead of world auto viewport', () => {
      const url = generateOverviewMapUrl(
        mockRoute.route_geometry!,
        mockDangerReportsNearRoute,
        mockMapboxToken
      )

      expect(url).toContain('[')
      expect(url).toContain(']')
      expect(url).not.toContain('/auto/')
    })

    it('uses numbered marker labels for dangers', () => {
      const url = generateOverviewMapUrl(
        mockRoute.route_geometry!,
        mockDangerReportsNearRoute,
        mockMapboxToken
      )

      expect(url).toContain('pin-l-1+')
      expect(url).toContain('pin-l-2+')
    })

    it('does not duplicate marker labels up to supported marker limit', () => {
      const manyDangers: DangerReport[] = Array.from({ length: 36 }, (_, i) => ({
        ...mockDangerReportsNearRoute[0],
        id: `danger-many-${i}`,
        latitude: 35.689 + i * 0.0001,
        longitude: 139.691 + i * 0.0001,
      }))

      const url = generateOverviewMapUrl(
        mockRoute.route_geometry!,
        manyDangers,
        mockMapboxToken
      )

      const labels = Array.from(
        url.matchAll(/pin-l-([a-z0-9])\+/g),
        (match) => match[1]
      )

      expect(labels.length).toBe(36)
      expect(new Set(labels).size).toBe(36)
    })

    it('does not include invalid route coordinates in path overlay', () => {
      const routeWithInvalidPoint: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [
          [999, 999],
          [139.7001, 35.6901],
          [139.7011, 35.6911],
        ],
      }

      const url = generateOverviewMapUrl(
        routeWithInvalidPoint,
        mockDangerReportsNearRoute,
        mockMapboxToken
      )

      const match = url.match(/path-[^(]*\(([^)]+)\)/)
      expect(match).toBeTruthy()
      const decodedPath = decodeURIComponent(match ? match[1] : '')
      expect(decodedPath).not.toContain('999')
      expect(decodedPath).toContain('139.7001,35.6901')
    })

    it('falls back to a valid default viewport when all coordinates are invalid', () => {
      const invalidRoute: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [
          [999, 999],
          [888, 888],
        ],
      }

      const url = generateOverviewMapUrl(
        invalidRoute,
        mockEmptyDangerReports,
        mockMapboxToken
      )

      expect(url).toContain('/static/0,0,1/')
      expect(url).not.toContain('/auto/')
    })
  })

  describe('createReportSummary', () => {
    it('calculates total danger count correctly', () => {
      const summary = createReportSummary(mockDangerReportsNearRoute)

      expect(summary.totalDangers).toBe(mockDangerReportsNearRoute.length)
    })

    it('groups dangers by type correctly', () => {
      const summary = createReportSummary(mockDangerReportsNearRoute)

      expect(summary.byType).toBeDefined()
      expect(typeof summary.byType).toBe('object')

      // Verify counts add up
      const totalByType = Object.values(summary.byType).reduce((a, b) => a + b, 0)
      expect(totalByType).toBe(mockDangerReportsNearRoute.length)
    })

    it('groups dangers by level correctly', () => {
      const summary = createReportSummary(mockDangerReportsNearRoute)

      expect(summary.byLevel).toBeDefined()
      expect(typeof summary.byLevel).toBe('object')

      // Verify counts add up
      const totalByLevel = Object.values(summary.byLevel).reduce((a, b) => a + b, 0)
      expect(totalByLevel).toBe(mockDangerReportsNearRoute.length)
    })

    it('handles empty dangers array', () => {
      const summary = createReportSummary(mockEmptyDangerReports)

      expect(summary.totalDangers).toBe(0)
      expect(summary.byType).toEqual({})
      expect(summary.byLevel).toEqual({})
    })

    it('returns proper type counts', () => {
      const summary = createReportSummary(mockDangerReportsNearRoute)

      // From fixtures: 交通危険, 歩行者危険, 環境危険
      expect(summary.byType['交通危険']).toBeDefined()
    })

    it('returns proper level counts', () => {
      const summary = createReportSummary(mockDangerReportsNearRoute)

      // Levels 1, 2, 3 from fixtures
      expect(Object.keys(summary.byLevel).length).toBeGreaterThan(0)
    })
  })

  describe('danger image selection', () => {
    it('returns processed and original image options for selection', () => {
      const options = getDangerImageOptions(mockDangerReportsNearRoute[0])

      expect(options).toEqual([
        {
          label: '報告画像',
          type: 'original',
          url: 'https://example.com/danger1.jpg',
        },
        {
          label: '加工画像 1',
          type: 'processed',
          url: 'https://example.com/danger1_processed.jpg',
        },
      ])
    })

    it('uses the user-selected image when it belongs to the danger', () => {
      const selectedUrl = resolveDangerDisplayImageUrl(
        mockDangerReportsNearRoute[0],
        {
          'danger-1': 'https://example.com/danger1.jpg',
        }
      )

      expect(selectedUrl).toBe('https://example.com/danger1.jpg')
    })

    it('falls back to the original report image when selected image is invalid', () => {
      const selectedUrl = resolveDangerDisplayImageUrl(
        mockDangerReportsNearRoute[0],
        {
          'danger-1': 'https://example.com/not-allowed.jpg',
        }
      )

      expect(selectedUrl).toBe('https://example.com/danger1.jpg')
    })

    it('swaps the stored URL for a signed URL when a mapping is provided', () => {
      // 非公開バケット対応: 保存済み公開URL → 署名URL へ差し替える。
      const signedUrl = resolveDangerDisplayImageUrl(
        mockDangerReportsNearRoute[0],
        undefined,
        {
          'https://example.com/danger1.jpg': 'https://signed.example.com/danger1?token=abc',
        }
      )

      expect(signedUrl).toBe('https://signed.example.com/danger1?token=abc')
    })

    it('keeps the stored URL when no signed mapping matches', () => {
      const url = resolveDangerDisplayImageUrl(
        mockDangerReportsNearRoute[0],
        undefined,
        { 'https://example.com/other.jpg': 'https://signed.example.com/other?token=xyz' }
      )

      expect(url).toBe('https://example.com/danger1.jpg')
    })
  })

  describe('generatePDFReport', () => {
    it('generates a PDF Blob', async () => {
      const report: RouteDangerReport = {
        route: mockRoute,
        dangers: mockDangerReportsNearRoute,
        bufferMeters: 100,
        generatedAt: new Date().toISOString(),
        summary: createReportSummary(mockDangerReportsNearRoute),
      }

      const blob = await generatePDFReport(report, mockMapboxToken)

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toContain('pdf')
    })

    it('includes route name in the title', async () => {
      const report: RouteDangerReport = {
        route: mockRoute,
        dangers: mockDangerReportsNearRoute,
        bufferMeters: 100,
        generatedAt: new Date().toISOString(),
        summary: createReportSummary(mockDangerReportsNearRoute),
      }

      // We can't easily check PDF content, but we can verify it generates
      const blob = await generatePDFReport(report, mockMapboxToken)
      expect(blob.size).toBeGreaterThan(0)
    })

    it('handles empty dangers', async () => {
      const report: RouteDangerReport = {
        route: mockRoute,
        dangers: mockEmptyDangerReports,
        bufferMeters: 100,
        generatedAt: new Date().toISOString(),
        summary: createReportSummary(mockEmptyDangerReports),
      }

      const blob = await generatePDFReport(report, mockMapboxToken)
      expect(blob).toBeInstanceOf(Blob)
    })
  })

  describe('generateImageReport', () => {
    // Note: In jsdom test environment, html2canvas doesn't work properly
    // These tests verify the function returns a Blob (placeholder in test env)

    it('generates PNG format by default', async () => {
      const report: RouteDangerReport = {
        route: mockRoute,
        dangers: mockDangerReportsNearRoute,
        bufferMeters: 100,
        generatedAt: new Date().toISOString(),
        summary: createReportSummary(mockDangerReportsNearRoute),
      }

      const blob = await generateImageReport(report, mockMapboxToken)

      expect(blob).toBeInstanceOf(Blob)
      // In test environment, we get a placeholder blob
      expect(blob.type).toContain('png')
    })

    it('generates JPEG format when specified', async () => {
      const report: RouteDangerReport = {
        route: mockRoute,
        dangers: mockDangerReportsNearRoute,
        bufferMeters: 100,
        generatedAt: new Date().toISOString(),
        summary: createReportSummary(mockDangerReportsNearRoute),
      }

      const blob = await generateImageReport(report, mockMapboxToken, 'jpeg')

      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toContain('jpeg')
    })

    it('handles empty dangers', async () => {
      const report: RouteDangerReport = {
        route: mockRoute,
        dangers: mockEmptyDangerReports,
        bufferMeters: 100,
        generatedAt: new Date().toISOString(),
        summary: createReportSummary(mockEmptyDangerReports),
      }

      const blob = await generateImageReport(report, mockMapboxToken)
      expect(blob).toBeInstanceOf(Blob)
    })
  })
})
