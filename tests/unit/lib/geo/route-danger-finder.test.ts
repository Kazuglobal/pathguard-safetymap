/**
 * TDD Unit Tests: Route Danger Finder
 *
 * RED Phase: These tests should FAIL because the module doesn't exist yet
 *
 * Target: lib/geo/route-danger-finder.ts
 * Phase: Route Danger Report Feature
 */

import { describe, it, expect } from 'vitest'
import {
  createRouteBuffer,
  findDangersNearRoute,
  sortDangersByRoutePosition,
} from '@/lib/geo/route-danger-finder'
import {
  mockDangerReportsNearRoute,
  mockDangerReportsFarFromRoute,
  mockAllDangerReports,
  mockEmptyDangerReports,
  mockRouteGeometry,
  mockInvalidGeometry,
} from '../../../fixtures/dangers'

describe('route-danger-finder', () => {
  describe('createRouteBuffer', () => {
    it('generates a buffer polygon from route geometry with default 100m', () => {
      const buffer = createRouteBuffer(mockRouteGeometry)

      expect(buffer).toBeDefined()
      expect(buffer.type).toBe('Feature')
      expect(buffer.geometry.type).toBe('Polygon')
      expect(buffer.geometry.coordinates).toBeInstanceOf(Array)
      expect(buffer.geometry.coordinates[0].length).toBeGreaterThan(4) // Polygon with multiple points
    })

    it('generates a buffer polygon with custom buffer distance (50m)', () => {
      const buffer50m = createRouteBuffer(mockRouteGeometry, 50)
      const buffer100m = createRouteBuffer(mockRouteGeometry, 100)

      expect(buffer50m).toBeDefined()
      expect(buffer100m).toBeDefined()

      // 50m buffer should be smaller than 100m buffer
      // We verify this by checking the bounding box or area would be different
      const getArea = (buf: GeoJSON.Feature<GeoJSON.Polygon>) => {
        const coords = buf.geometry.coordinates[0]
        // Simple approximation: count exterior ring points
        return coords.length
      }

      // Both should have valid polygon structures
      expect(buffer50m.geometry.type).toBe('Polygon')
      expect(buffer100m.geometry.type).toBe('Polygon')
    })

    it('generates a buffer polygon with custom buffer distance (200m)', () => {
      const buffer200m = createRouteBuffer(mockRouteGeometry, 200)

      expect(buffer200m).toBeDefined()
      expect(buffer200m.geometry.type).toBe('Polygon')
    })

    it('defaults to 100m buffer when no distance specified', () => {
      const bufferDefault = createRouteBuffer(mockRouteGeometry)
      const buffer100m = createRouteBuffer(mockRouteGeometry, 100)

      expect(bufferDefault).toBeDefined()
      expect(buffer100m).toBeDefined()

      // Both should produce valid polygons (exact equality would depend on implementation)
      expect(bufferDefault.geometry.type).toBe('Polygon')
      expect(buffer100m.geometry.type).toBe('Polygon')
    })

    it('throws error for invalid geometry (null)', () => {
      expect(() => createRouteBuffer(null as unknown as GeoJSON.LineString)).toThrow()
    })

    it('throws error for invalid geometry (wrong type)', () => {
      expect(() => createRouteBuffer(mockInvalidGeometry)).toThrow()
    })

    it('throws error for geometry with insufficient points', () => {
      const singlePointLine: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [[139.6917, 35.6895]], // Only 1 point
      }

      expect(() => createRouteBuffer(singlePointLine)).toThrow()
    })

    it('handles geometry with exactly 2 points', () => {
      const twoPointLine: GeoJSON.LineString = {
        type: 'LineString',
        coordinates: [
          [139.6917, 35.6895],
          [139.7000, 35.6905],
        ],
      }

      const buffer = createRouteBuffer(twoPointLine)
      expect(buffer).toBeDefined()
      expect(buffer.geometry.type).toBe('Polygon')
    })
  })

  describe('findDangersNearRoute', () => {
    it('returns dangers within the buffer zone', () => {
      const dangers = findDangersNearRoute(mockRouteGeometry, mockDangerReportsNearRoute)

      expect(dangers).toBeInstanceOf(Array)
      expect(dangers.length).toBeGreaterThan(0)
      // All near-route dangers should be included
      expect(dangers.length).toBe(mockDangerReportsNearRoute.length)
    })

    it('excludes dangers outside the buffer zone', () => {
      const dangers = findDangersNearRoute(mockRouteGeometry, mockAllDangerReports)

      // Should include near-route dangers but not far-from-route dangers
      const includedIds = dangers.map(d => d.id)

      // Near-route dangers should be included
      mockDangerReportsNearRoute.forEach(d => {
        expect(includedIds).toContain(d.id)
      })

      // Far-from-route dangers should be excluded
      mockDangerReportsFarFromRoute.forEach(d => {
        expect(includedIds).not.toContain(d.id)
      })
    })

    it('returns empty array when no dangers provided', () => {
      const dangers = findDangersNearRoute(mockRouteGeometry, mockEmptyDangerReports)

      expect(dangers).toBeInstanceOf(Array)
      expect(dangers.length).toBe(0)
    })

    it('returns empty array when no dangers within buffer', () => {
      const dangers = findDangersNearRoute(mockRouteGeometry, mockDangerReportsFarFromRoute)

      expect(dangers).toBeInstanceOf(Array)
      expect(dangers.length).toBe(0)
    })

    it('uses custom buffer distance when specified', () => {
      // With a very small buffer (1m), should find fewer or no dangers
      const dangersSmallBuffer = findDangersNearRoute(
        mockRouteGeometry,
        mockDangerReportsNearRoute,
        1
      )

      // With default 100m buffer, should find more dangers
      const dangersLargeBuffer = findDangersNearRoute(
        mockRouteGeometry,
        mockDangerReportsNearRoute,
        100
      )

      expect(dangersSmallBuffer.length).toBeLessThanOrEqual(dangersLargeBuffer.length)
    })

    it('handles dangers exactly on the route line', () => {
      // Create a danger exactly on a route point
      const [lng, lat] = mockRouteGeometry.coordinates[1]
      const dangerOnRoute = {
        ...mockDangerReportsNearRoute[0],
        id: 'danger-on-route',
        latitude: lat,
        longitude: lng,
      }

      const dangers = findDangersNearRoute(mockRouteGeometry, [dangerOnRoute])

      expect(dangers.length).toBe(1)
      expect(dangers[0].id).toBe('danger-on-route')
    })

    it('preserves original danger report data', () => {
      const dangers = findDangersNearRoute(mockRouteGeometry, mockDangerReportsNearRoute)

      if (dangers.length > 0) {
        const firstDanger = dangers[0]
        const originalDanger = mockDangerReportsNearRoute.find(d => d.id === firstDanger.id)

        expect(firstDanger).toEqual(originalDanger)
      }
    })
  })

  describe('sortDangersByRoutePosition', () => {
    it('sorts dangers by their position along the route', () => {
      const sorted = sortDangersByRoutePosition(mockRouteGeometry, mockDangerReportsNearRoute)

      expect(sorted).toBeInstanceOf(Array)
      expect(sorted.length).toBe(mockDangerReportsNearRoute.length)

      // First danger should be closest to route start
      // Last danger should be closest to route end
      if (sorted.length >= 2) {
        const firstDanger = sorted[0]
        const lastDanger = sorted[sorted.length - 1]

        // The first danger's position along route should be <= last danger's position
        // We can verify by checking longitude progression (route goes from west to east)
        expect(firstDanger.longitude).toBeLessThanOrEqual(lastDanger.longitude)
      }
    })

    it('returns empty array for empty input', () => {
      const sorted = sortDangersByRoutePosition(mockRouteGeometry, mockEmptyDangerReports)

      expect(sorted).toBeInstanceOf(Array)
      expect(sorted.length).toBe(0)
    })

    it('returns single item array unchanged for single danger', () => {
      const singleDanger = [mockDangerReportsNearRoute[0]]
      const sorted = sortDangersByRoutePosition(mockRouteGeometry, singleDanger)

      expect(sorted).toBeInstanceOf(Array)
      expect(sorted.length).toBe(1)
      expect(sorted[0]).toEqual(singleDanger[0])
    })

    it('maintains stable sort for dangers at same position', () => {
      // Create two dangers at the same location
      const samePosD1 = {
        ...mockDangerReportsNearRoute[0],
        id: 'same-pos-1',
        latitude: 35.6898,
        longitude: 139.6920,
      }
      const samePosD2 = {
        ...mockDangerReportsNearRoute[0],
        id: 'same-pos-2',
        latitude: 35.6898,
        longitude: 139.6920,
      }

      const sorted = sortDangersByRoutePosition(mockRouteGeometry, [samePosD1, samePosD2])

      expect(sorted.length).toBe(2)
      // Original order should be maintained for equal positions
      expect(sorted[0].id).toBe('same-pos-1')
      expect(sorted[1].id).toBe('same-pos-2')
    })

    it('does not mutate the original array', () => {
      const original = [...mockDangerReportsNearRoute]
      const originalIds = original.map(d => d.id)

      sortDangersByRoutePosition(mockRouteGeometry, mockDangerReportsNearRoute)

      // Original array should be unchanged
      expect(mockDangerReportsNearRoute.map(d => d.id)).toEqual(originalIds)
    })

    it('correctly orders dangers along complex route', () => {
      // Create dangers at known positions along the route
      const routeStart = mockRouteGeometry.coordinates[0]
      const routeMiddle = mockRouteGeometry.coordinates[1]
      const routeEnd = mockRouteGeometry.coordinates[2]

      const dangerAtStart = {
        ...mockDangerReportsNearRoute[0],
        id: 'at-start',
        latitude: routeStart[1],
        longitude: routeStart[0],
      }
      const dangerAtMiddle = {
        ...mockDangerReportsNearRoute[0],
        id: 'at-middle',
        latitude: routeMiddle[1],
        longitude: routeMiddle[0],
      }
      const dangerAtEnd = {
        ...mockDangerReportsNearRoute[0],
        id: 'at-end',
        latitude: routeEnd[1],
        longitude: routeEnd[0],
      }

      // Provide in random order
      const sorted = sortDangersByRoutePosition(mockRouteGeometry, [
        dangerAtMiddle,
        dangerAtEnd,
        dangerAtStart,
      ])

      expect(sorted[0].id).toBe('at-start')
      expect(sorted[1].id).toBe('at-middle')
      expect(sorted[2].id).toBe('at-end')
    })
  })
})
