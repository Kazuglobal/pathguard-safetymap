/**
 * Route Danger Finder Utilities
 *
 * Provides geo-spatial utilities for finding danger reports near a route.
 * Uses Turf.js for geographic calculations.
 */

import * as turf from '@turf/turf'
import type { DangerReport } from '@/lib/types'

type DangerCoordinates = Pick<DangerReport, 'latitude' | 'longitude'>

/**
 * Creates a buffer polygon around a route geometry.
 *
 * @param routeGeometry - The LineString geometry of the route
 * @param bufferMeters - The buffer distance in meters (default: 100)
 * @returns A GeoJSON Feature containing the buffer polygon
 * @throws Error if geometry is invalid or has insufficient points
 */
export function createRouteBuffer(
  routeGeometry: GeoJSON.LineString,
  bufferMeters: number = 100
): GeoJSON.Feature<GeoJSON.Polygon> {
  if (!routeGeometry) {
    throw new Error('Route geometry is required')
  }

  if (routeGeometry.type !== 'LineString') {
    throw new Error('Route geometry must be a LineString')
  }

  if (!routeGeometry.coordinates || routeGeometry.coordinates.length < 2) {
    throw new Error('Route geometry must have at least 2 points')
  }

  const turfAny = turf as any
  const lineFeature = turfAny.lineString(routeGeometry.coordinates)
  const buffered = turfAny.buffer(lineFeature, bufferMeters, { units: 'meters' })

  if (!buffered || buffered.geometry.type !== 'Polygon') {
    throw new Error('Failed to create buffer polygon')
  }

  return buffered as GeoJSON.Feature<GeoJSON.Polygon>
}

/**
 * Finds danger reports that are within the specified buffer distance of a route.
 *
 * @param routeGeometry - The LineString geometry of the route
 * @param dangerReports - Array of danger reports to filter
 * @param bufferMeters - The buffer distance in meters (default: 100)
 * @returns Array of danger reports within the buffer zone
 */
export function findDangersNearRoute<T extends DangerCoordinates>(
  routeGeometry: GeoJSON.LineString,
  dangerReports: T[],
  bufferMeters: number = 100
): T[] {
  if (!dangerReports || dangerReports.length === 0) {
    return []
  }

  const turfAny = turf as any
  const bufferPolygon = createRouteBuffer(routeGeometry, bufferMeters)

  return dangerReports.filter((danger) => {
    const point = turfAny.point([danger.longitude, danger.latitude])
    return turfAny.booleanPointInPolygon(point, bufferPolygon)
  })
}

/**
 * Sorts danger reports by their position along the route.
 * Dangers closer to the route start appear first.
 *
 * @param routeGeometry - The LineString geometry of the route
 * @param dangerReports - Array of danger reports to sort
 * @returns New array of danger reports sorted by position along route
 */
export function sortDangersByRoutePosition(
  routeGeometry: GeoJSON.LineString,
  dangerReports: DangerReport[]
): DangerReport[] {
  if (!dangerReports || dangerReports.length === 0) {
    return []
  }

  if (dangerReports.length === 1) {
    return [...dangerReports]
  }

  const turfAny = turf as any
  const lineFeature = turfAny.lineString(routeGeometry.coordinates)
  const lineLength = turfAny.length(lineFeature, { units: 'meters' })

  // Calculate position along route for each danger
  const dangersWithPosition = dangerReports.map((danger, originalIndex) => {
    const point = turfAny.point([danger.longitude, danger.latitude])
    const nearestPoint = turfAny.nearestPointOnLine(lineFeature, point)
    const distanceFromStart = nearestPoint.properties.location || 0

    return {
      danger,
      distanceFromStart,
      originalIndex,
    }
  })

  // Sort by distance from route start, maintaining stable sort for equal positions
  dangersWithPosition.sort((a, b) => {
    if (a.distanceFromStart === b.distanceFromStart) {
      return a.originalIndex - b.originalIndex
    }
    return a.distanceFromStart - b.distanceFromStart
  })

  return dangersWithPosition.map((item) => item.danger)
}
