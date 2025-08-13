/**
 * Advanced Directions API Module
 * Multi-modal routing with optimization and analysis
 */

import { mapboxMCP, DirectionsOptions, MapboxAPIResponse } from '../mapbox-mcp-services'
import { mapboxLogger } from '../mapbox-logger'

export type RouteProfile = 'driving' | 'walking' | 'cycling' | 'driving-traffic'
export type RouteGeometry = 'geojson' | 'polyline' | 'polyline6'
export type RouteOverview = 'full' | 'simplified' | 'false'

export interface RouteWaypoint {
  coordinates: [number, number]
  name?: string
  approach?: 'unrestricted' | 'curb'
  radius?: number
  bearing?: [number, number]
}

export interface RouteOptions {
  waypoints: RouteWaypoint[]
  profile: RouteProfile
  alternatives?: boolean
  steps?: boolean
  geometries?: RouteGeometry
  overview?: RouteOverview
  language?: string
  exclude?: 'toll' | 'motorway' | 'ferry'
  annotations?: ('duration' | 'distance' | 'speed' | 'congestion')[]
  roundtrip?: boolean
  source?: 'first' | 'any'
  destination?: 'last' | 'any'
}

export interface RouteResponse {
  routes: Route[]
  waypoints: ResponseWaypoint[]
  code: string
  uuid?: string
}

export interface Route {
  geometry: any
  legs: RouteLeg[]
  duration: number
  distance: number
  weight: number
  weight_name: string
  voiceLocale?: string
}

export interface RouteLeg {
  steps: RouteStep[]
  distance: number
  duration: number
  summary: string
  weight: number
  annotation?: RouteAnnotation
}

export interface RouteStep {
  intersections: Intersection[]
  maneuver: Maneuver
  name: string
  duration: number
  distance: number
  driving_side: string
  weight: number
  mode: string
  geometry: any
  voiceInstructions?: VoiceInstruction[]
  bannerInstructions?: BannerInstruction[]
}

export interface Intersection {
  location: [number, number]
  bearings: number[]
  entry: boolean[]
  in?: number
  out?: number
  lanes?: Lane[]
  classes?: string[]
  traffic_signal?: boolean
  stop_sign?: boolean
  yield_sign?: boolean
  railway_crossing?: boolean
  roundabout_exit?: number
  is_urban?: boolean
  admin_index?: number
  mapbox_streets_v8?: {
    class: string
  }
}

export interface Maneuver {
  type: string
  instruction: string
  bearing_after: number
  bearing_before: number
  location: [number, number]
  modifier?: string
  exit?: number
}

export interface Lane {
  indications: string[]
  valid: boolean
  active: boolean
}

export interface VoiceInstruction {
  distanceAlongGeometry: number
  announcement: string
  ssmlAnnouncement: string
}

export interface BannerInstruction {
  distanceAlongGeometry: number
  primary: InstructionComponent
  secondary?: InstructionComponent
  sub?: InstructionComponent
}

export interface InstructionComponent {
  text: string
  type: string
  modifier?: string
  degrees?: number
  driving_side?: string
}

export interface ResponseWaypoint {
  hint?: string
  distance?: number
  name: string
  location: [number, number]
}

export interface RouteAnnotation {
  duration?: number[]
  distance?: number[]
  speed?: number[]
  congestion?: string[]
  datasources?: number[]
  nodes?: number[]
}

export interface RouteComparison {
  routes: Route[]
  recommendation: {
    fastest: Route
    shortest: Route
    mostEfficient: Route
    safest?: Route
  }
  analysis: {
    timeDifference: number
    distanceDifference: number
    trafficImpact: number
    safetyScore?: number
  }
}

export interface MultiModalRouteOptions {
  origin: [number, number]
  destination: [number, number]
  waypoints?: [number, number][]
  profiles: RouteProfile[]
  preferences?: {
    prioritizeTime?: boolean
    prioritizeDistance?: boolean
    avoidTraffic?: boolean
    accessibilityRequirements?: string[]
  }
}

export class DirectionsService {
  private cache: Map<string, { data: RouteResponse; timestamp: number }> = new Map()
  private cacheMaxAge = 5 * 60 * 1000 // 5 minutes

  /**
   * Get directions for a single route
   */
  async getRoute(options: RouteOptions): Promise<MapboxAPIResponse<RouteResponse>> {
    const cacheKey = this.generateCacheKey(options)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      mapboxLogger.info('Route retrieved from cache', { cacheKey })
      return {
        success: true,
        data: cached.data
      }
    }

    const coordinates = options.waypoints.map(wp => wp.coordinates)
    const directionsOptions: DirectionsOptions = {
      coordinates,
      profile: options.profile,
      alternatives: options.alternatives,
      steps: options.steps,
      geometries: options.geometries,
      overview: options.overview,
      language: options.language,
      exclude: options.exclude,
      annotations: options.annotations
    }

    const response = await mapboxMCP.getDirections(directionsOptions)
    
    if (response.success && response.data) {
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      })
      
      mapboxLogger.info('Route calculated successfully', {
        profile: options.profile,
        waypoints: options.waypoints.length,
        distance: response.data.routes?.[0]?.distance,
        duration: response.data.routes?.[0]?.duration
      })
    }

    return response
  }

  /**
   * Get multiple route alternatives with different profiles
   */
  async getMultiModalRoutes(options: MultiModalRouteOptions): Promise<MapboxAPIResponse<RouteComparison>> {
    const routeRequests = options.profiles.map(profile => ({
      waypoints: [
        { coordinates: options.origin },
        ...(options.waypoints?.map(coord => ({ coordinates: coord })) || []),
        { coordinates: options.destination }
      ],
      profile,
      alternatives: true,
      steps: true,
      geometries: 'geojson' as RouteGeometry,
      overview: 'full' as RouteOverview,
      annotations: ['duration', 'distance', 'speed', 'congestion'] as any[]
    }))

    try {
      const results = await mapboxMCP.batchDirections(
        routeRequests.map(req => ({
          coordinates: req.waypoints.map(wp => wp.coordinates),
          profile: req.profile,
          alternatives: req.alternatives,
          steps: req.steps,
          geometries: req.geometries,
          overview: req.overview,
          annotations: req.annotations
        }))
      )

      const routes: Route[] = []
      const validResults = results.filter(result => 
        !(result instanceof Error) && result.success
      ) as MapboxAPIResponse<RouteResponse>[]

      for (const result of validResults) {
        if (result.data?.routes) {
          routes.push(...result.data.routes)
        }
      }

      const comparison = this.compareRoutes(routes, options.preferences)
      
      return {
        success: true,
        data: comparison
      }
    } catch (error) {
      mapboxLogger.error('Multi-modal route calculation failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Optimize waypoint order for minimum travel time
   */
  async optimizeWaypoints(
    waypoints: RouteWaypoint[],
    profile: RouteProfile = 'driving',
    roundtrip: boolean = false
  ): Promise<MapboxAPIResponse<{ optimizedOrder: number[]; route: RouteResponse }>> {
    if (waypoints.length < 2) {
      return {
        success: false,
        error: 'At least 2 waypoints are required for optimization'
      }
    }

    const coordinates = waypoints.map(wp => wp.coordinates)
    
    // Use Matrix API to get all distances
    const matrixResponse = await mapboxMCP.getMatrix({
      coordinates,
      profile: profile as 'driving' | 'walking' | 'cycling',
      annotations: ['duration', 'distance']
    })

    if (!matrixResponse.success || !matrixResponse.data) {
      return {
        success: false,
        error: 'Failed to get distance matrix for optimization'
      }
    }

    const optimizedOrder = this.solveTSP(
      matrixResponse.data.durations,
      roundtrip
    )

    // Get optimized route
    const optimizedWaypoints = optimizedOrder.map(index => waypoints[index])
    const routeResponse = await this.getRoute({
      waypoints: optimizedWaypoints,
      profile,
      steps: true,
      geometries: 'geojson',
      overview: 'full'
    })

    if (!routeResponse.success) {
      return {
        success: false,
        error: 'Failed to get optimized route'
      }
    }

    return {
      success: true,
      data: {
        optimizedOrder,
        route: routeResponse.data!
      }
    }
  }

  /**
   * Get route with real-time traffic information
   */
  async getTrafficAwareRoute(options: RouteOptions): Promise<MapboxAPIResponse<RouteResponse & { trafficAnalysis: any }>> {
    const trafficOptions = {
      ...options,
      profile: 'driving-traffic' as RouteProfile,
      annotations: ['duration', 'distance', 'speed', 'congestion'] as ('duration' | 'distance' | 'speed' | 'congestion')[]
    }

    const response = await this.getRoute(trafficOptions)
    
    if (!response.success || !response.data) {
      return response as any
    }

    const trafficAnalysis = this.analyzeTraffic(response.data)
    
    return {
      success: true,
      data: {
        ...response.data,
        trafficAnalysis
      }
    }
  }

  /**
   * Get accessibility-friendly routes
   */
  async getAccessibilityRoute(
    options: RouteOptions,
    accessibilityRequirements: string[] = []
  ): Promise<MapboxAPIResponse<RouteResponse>> {
    const accessibilityOptions = {
      ...options,
      profile: 'walking' as RouteProfile,
      exclude: 'ferry' as 'toll' | 'motorway' | 'ferry',
      annotations: ['duration', 'distance'] as ('duration' | 'distance' | 'speed' | 'congestion')[]
    }

    const response = await this.getRoute(accessibilityOptions)
    
    if (response.success && response.data) {
      // Filter routes based on accessibility requirements
      const filteredRoutes = response.data.routes.filter(route => 
        this.meetsAccessibilityRequirements(route, accessibilityRequirements)
      )

      return {
        success: true,
        data: {
          ...response.data,
          routes: filteredRoutes
        }
      }
    }

    return response
  }

  /**
   * Generate route instructions in multiple languages
   */
  async getLocalizedInstructions(
    waypoints: RouteWaypoint[],
    profile: RouteProfile,
    languages: string[] = ['ja', 'en']
  ): Promise<MapboxAPIResponse<{ [language: string]: RouteResponse }>> {
    const requests = languages.map(language => ({
      waypoints,
      profile,
      steps: true,
      language,
      geometries: 'geojson' as RouteGeometry,
      overview: 'full' as RouteOverview
    }))

    const results = await mapboxMCP.batchDirections(
      requests.map(req => ({
        coordinates: req.waypoints.map(wp => wp.coordinates),
        profile: req.profile,
        steps: req.steps,
        language: req.language,
        geometries: req.geometries,
        overview: req.overview
      }))
    )

    const localizedRoutes: { [language: string]: RouteResponse } = {}
    
    results.forEach((result, index) => {
      if (!(result instanceof Error) && result.success && result.data) {
        localizedRoutes[languages[index]] = result.data
      }
    })

    return {
      success: true,
      data: localizedRoutes
    }
  }

  private generateCacheKey(options: RouteOptions): string {
    return JSON.stringify({
      waypoints: options.waypoints.map(wp => wp.coordinates),
      profile: options.profile,
      alternatives: options.alternatives,
      exclude: options.exclude
    })
  }

  private compareRoutes(routes: Route[], preferences: MultiModalRouteOptions['preferences'] = {}): RouteComparison {
    if (routes.length === 0) {
      throw new Error('No routes to compare')
    }

    const fastest = routes.reduce((prev, curr) => 
      curr.duration < prev.duration ? curr : prev
    )

    const shortest = routes.reduce((prev, curr) => 
      curr.distance < prev.distance ? curr : prev
    )

    const mostEfficient = routes.reduce((prev, curr) => {
      const prevScore = prev.duration / prev.distance
      const currScore = curr.duration / curr.distance
      return currScore < prevScore ? curr : prev
    })

    const timeDifference = Math.max(...routes.map(r => r.duration)) - Math.min(...routes.map(r => r.duration))
    const distanceDifference = Math.max(...routes.map(r => r.distance)) - Math.min(...routes.map(r => r.distance))

    return {
      routes,
      recommendation: {
        fastest,
        shortest,
        mostEfficient
      },
      analysis: {
        timeDifference,
        distanceDifference,
        trafficImpact: this.calculateTrafficImpact(routes)
      }
    }
  }

  private analyzeTraffic(routeResponse: RouteResponse): any {
    const route = routeResponse.routes[0]
    if (!route?.legs?.[0]?.annotation?.congestion) {
      return { trafficLevel: 'unknown' }
    }

    const congestion = route.legs[0].annotation.congestion
    const trafficCounts = congestion.reduce((acc, level) => {
      acc[level] = (acc[level] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalSegments = congestion.length
    const severeTraffic = (trafficCounts['severe'] || 0) / totalSegments
    const heavyTraffic = (trafficCounts['heavy'] || 0) / totalSegments
    const moderateTraffic = (trafficCounts['moderate'] || 0) / totalSegments

    return {
      trafficLevel: severeTraffic > 0.3 ? 'severe' : 
                   heavyTraffic > 0.5 ? 'heavy' : 
                   moderateTraffic > 0.3 ? 'moderate' : 'light',
      trafficBreakdown: trafficCounts,
      trafficPercentage: {
        severe: severeTraffic * 100,
        heavy: heavyTraffic * 100,
        moderate: moderateTraffic * 100,
        light: ((trafficCounts['low'] || 0) + (trafficCounts['unknown'] || 0)) / totalSegments * 100
      }
    }
  }

  private calculateTrafficImpact(routes: Route[]): number {
    // Calculate average traffic impact across all routes
    return routes.reduce((acc, route) => {
      const baseTime = route.distance / 50 * 3.6 // Assume 50 km/h base speed
      const actualTime = route.duration / 3600 // Convert to hours
      return acc + (actualTime - baseTime) / baseTime
    }, 0) / routes.length
  }

  private solveTSP(distances: number[][], roundtrip: boolean = false): number[] {
    const n = distances.length
    if (n <= 2) return Array.from({ length: n }, (_, i) => i)

    // Simple nearest neighbor heuristic for TSP
    const visited = new Set<number>()
    const path = [0] // Start from first waypoint
    visited.add(0)

    while (visited.size < n) {
      const current = path[path.length - 1]
      let nearest = -1
      let minDistance = Infinity

      for (let i = 0; i < n; i++) {
        if (!visited.has(i) && distances[current][i] < minDistance) {
          minDistance = distances[current][i]
          nearest = i
        }
      }

      if (nearest !== -1) {
        path.push(nearest)
        visited.add(nearest)
      }
    }

    if (roundtrip && path.length > 1) {
      path.push(0)
    }

    return path
  }

  private meetsAccessibilityRequirements(route: Route, requirements: string[]): boolean {
    // Implement accessibility checking logic
    // This is a simplified version - in practice, you'd check for:
    // - Wheelchair accessible paths
    // - Avoided stairs
    // - Minimum sidewalk width
    // - etc.
    return true
  }
}

export const directionsService = new DirectionsService()
export default directionsService