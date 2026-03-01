/**
 * Map Matching API Module
 * GPS track analysis and road network matching
 */

import { mapboxMCP, MapboxAPIResponse } from '../mapbox-mcp-services'
import { mapboxLogger } from '../mapbox-logger'

export type MapMatchingProfile = 'driving' | 'walking' | 'cycling'
export type MapMatchingApproach = 'unrestricted' | 'curb'

export interface GPSPoint {
  coordinates: [number, number]
  timestamp?: number
  accuracy?: number
  speed?: number
  bearing?: number
  altitude?: number
}

export interface MapMatchingOptions {
  coordinates: [number, number][]
  profile: MapMatchingProfile
  timestamps?: number[]
  radiuses?: number[]
  approaches?: MapMatchingApproach[]
  steps?: boolean
  geometries?: 'geojson' | 'polyline' | 'polyline6'
  overview?: 'full' | 'simplified' | 'false'
  annotations?: ('duration' | 'distance' | 'speed' | 'congestion')[]
  gaps?: 'split' | 'ignore'
  tidy?: boolean
  waypoint_snapping?: string[]
}

export interface MapMatchingResponse {
  code: string
  tracepoints: (MapMatchingTracepoint | null)[]
  matchings: MapMatchingResult[]
  confidence?: number
  uuid?: string
}

export interface MapMatchingTracepoint {
  alternatives_count: number
  waypoint_index: number
  matchings_index: number
  distance: number
  name: string
  location: [number, number]
  hint?: string
}

export interface MapMatchingResult {
  confidence: number
  geometry: any
  legs: MapMatchingLeg[]
  distance: number
  duration: number
  weight: number
  weight_name: string
  uuid?: string
}

export interface MapMatchingLeg {
  steps: MapMatchingStep[]
  distance: number
  duration: number
  summary: string
  weight: number
  annotation?: MapMatchingAnnotation
}

export interface MapMatchingStep {
  intersections: MapMatchingIntersection[]
  maneuver: MapMatchingManeuver
  name: string
  duration: number
  distance: number
  driving_side: string
  weight: number
  mode: string
  geometry: any
}

export interface MapMatchingIntersection {
  location: [number, number]
  bearings: number[]
  entry: boolean[]
  in?: number
  out?: number
  classes?: string[]
}

export interface MapMatchingManeuver {
  type: string
  instruction: string
  bearing_after: number
  bearing_before: number
  location: [number, number]
  modifier?: string
}

export interface MapMatchingAnnotation {
  duration?: number[]
  distance?: number[]
  speed?: number[]
  congestion?: string[]
  datasources?: number[]
  nodes?: number[]
}

export interface GPSTrackAnalysis {
  originalTrack: GPSPoint[]
  matchedTrack: MapMatchingResult
  analysis: {
    totalDistance: number
    totalDuration: number
    averageSpeed: number
    maxSpeed: number
    confidenceScore: number
    roadTypes: string[]
    trafficConditions: string[]
    deviations: Array<{
      point: GPSPoint
      deviation: number
      reason: string
    }>
  }
  quality: {
    matchingQuality: 'excellent' | 'good' | 'fair' | 'poor'
    gpsAccuracy: number
    roadCoverage: number
    temporalConsistency: number
  }
}

export interface RouteValidationResult {
  isValid: boolean
  confidence: number
  violations: Array<{
    location: [number, number]
    type: 'speed_limit' | 'wrong_way' | 'restricted_access' | 'off_road'
    severity: 'low' | 'medium' | 'high'
    description: string
  }>
  suggestions: string[]
}

export interface VehicleTrackingData {
  vehicleId: string
  route: GPSPoint[]
  plannedRoute?: [number, number][]
  analysis: {
    adherenceScore: number
    deviationDistance: number
    timeVariance: number
    efficiencyScore: number
  }
  alerts: Array<{
    timestamp: number
    type: 'deviation' | 'delay' | 'speed' | 'restricted_area'
    severity: 'low' | 'medium' | 'high'
    message: string
    location: [number, number]
  }>
}

export class MapMatchingService {
  private cache: Map<string, { data: MapMatchingResponse; timestamp: number }> = new Map()
  private cacheMaxAge = 15 * 60 * 1000 // 15 minutes

  /**
   * Match GPS coordinates to road network
   */
  async matchGPSTrack(options: MapMatchingOptions): Promise<MapboxAPIResponse<MapMatchingResponse>> {
    const cacheKey = this.generateCacheKey(options)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      mapboxLogger.info('Map matching result retrieved from cache', { cacheKey })
      return {
        success: true,
        data: cached.data
      }
    }

    // Prepare coordinates string
    const coordinatesStr = options.coordinates.map(coord => coord.join(',')).join(';')
    
    // Build query parameters
    const params = new URLSearchParams({
      access_token: process.env.MAPBOX_ACCESS_TOKEN || '',
      steps: options.steps?.toString() || 'false',
      geometries: options.geometries || 'geojson',
      overview: options.overview || 'full',
      gaps: options.gaps || 'split',
      tidy: options.tidy?.toString() || 'false'
    })

    if (options.timestamps) {
      params.append('timestamps', options.timestamps.join(';'))
    }

    if (options.radiuses) {
      params.append('radiuses', options.radiuses.join(';'))
    }

    if (options.approaches) {
      params.append('approaches', options.approaches.join(';'))
    }

    if (options.annotations) {
      params.append('annotations', options.annotations.join(','))
    }

    if (options.waypoint_snapping) {
      params.append('waypoint_snapping', options.waypoint_snapping.join(';'))
    }

    const endpoint = `/matching/v5/mapbox/${options.profile}/${coordinatesStr}?${params}`
    
    try {
      const response = await fetch(`https://api.mapbox.com${endpoint}`)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now()
      })

      mapboxLogger.info('Map matching completed successfully', {
        profile: options.profile,
        coordinates: options.coordinates.length,
        confidence: data.matchings?.[0]?.confidence
      })

      return {
        success: true,
        data
      }
    } catch (error) {
      mapboxLogger.error('Map matching failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Analyze GPS track with detailed metrics
   */
  async analyzeGPSTrack(
    gpsPoints: GPSPoint[],
    profile: MapMatchingProfile = 'driving'
  ): Promise<MapboxAPIResponse<GPSTrackAnalysis>> {
    if (gpsPoints.length < 2) {
      return {
        success: false,
        error: 'At least 2 GPS points are required for analysis'
      }
    }

    // Prepare map matching options
    const coordinates = gpsPoints.map(point => point.coordinates)
    const timestamps = gpsPoints.map(point => point.timestamp).filter(t => t !== undefined)
    const radiuses = gpsPoints.map(point => point.accuracy || 10)

    const matchingOptions: MapMatchingOptions = {
      coordinates,
      profile,
      timestamps: timestamps.length === gpsPoints.length ? timestamps : undefined,
      radiuses,
      steps: true,
      geometries: 'geojson',
      overview: 'full',
      annotations: ['duration', 'distance', 'speed', 'congestion'],
      gaps: 'split',
      tidy: true
    }

    const response = await this.matchGPSTrack(matchingOptions)
    
    if (!response.success || !response.data) {
      return response as unknown as MapboxAPIResponse<GPSTrackAnalysis>
    }

    const matching = response.data.matchings[0]
    if (!matching) {
      return {
        success: false,
        error: 'No matching result found'
      }
    }

    // Analyze the track
    const analysis = this.performTrackAnalysis(gpsPoints, matching, response.data)
    
    return {
      success: true,
      data: analysis
    }
  }

  /**
   * Validate route against traffic rules and restrictions
   */
  async validateRoute(
    gpsPoints: GPSPoint[],
    profile: MapMatchingProfile = 'driving'
  ): Promise<MapboxAPIResponse<RouteValidationResult>> {
    const analysisResponse = await this.analyzeGPSTrack(gpsPoints, profile)
    
    if (!analysisResponse.success || !analysisResponse.data) {
      return analysisResponse as unknown as MapboxAPIResponse<RouteValidationResult>
    }

    const analysis = analysisResponse.data
    const violations = this.detectViolations(analysis)
    const suggestions = this.generateSuggestions(violations)

    const validationResult: RouteValidationResult = {
      isValid: violations.length === 0,
      confidence: analysis.quality.matchingQuality === 'excellent' ? 0.95 :
                 analysis.quality.matchingQuality === 'good' ? 0.85 :
                 analysis.quality.matchingQuality === 'fair' ? 0.65 : 0.45,
      violations,
      suggestions
    }

    return {
      success: true,
      data: validationResult
    }
  }

  /**
   * Track vehicle movement and compare with planned route
   */
  async trackVehicle(
    vehicleId: string,
    gpsPoints: GPSPoint[],
    plannedRoute?: [number, number][],
    profile: MapMatchingProfile = 'driving'
  ): Promise<MapboxAPIResponse<VehicleTrackingData>> {
    const analysisResponse = await this.analyzeGPSTrack(gpsPoints, profile)
    
    if (!analysisResponse.success || !analysisResponse.data) {
      return analysisResponse as unknown as MapboxAPIResponse<VehicleTrackingData>
    }

    const analysis = analysisResponse.data
    const alerts = this.generateTrackingAlerts(analysis, plannedRoute)
    
    const trackingData: VehicleTrackingData = {
      vehicleId,
      route: gpsPoints,
      plannedRoute,
      analysis: {
        adherenceScore: plannedRoute ? this.calculateAdherenceScore(analysis, plannedRoute) : 100,
        deviationDistance: this.calculateDeviationDistance(analysis),
        timeVariance: this.calculateTimeVariance(analysis),
        efficiencyScore: this.calculateEfficiencyScore(analysis)
      },
      alerts
    }

    return {
      success: true,
      data: trackingData
    }
  }

  /**
   * Process multiple GPS tracks in parallel
   */
  async batchProcessTracks(
    tracks: Array<{
      id: string
      gpsPoints: GPSPoint[]
      profile?: MapMatchingProfile
    }>
  ): Promise<Array<MapboxAPIResponse<GPSTrackAnalysis> | Error>> {
    const requests = tracks.map(track => () => 
      this.analyzeGPSTrack(track.gpsPoints, track.profile || 'driving')
    )

    return mapboxMCP.getProcessor().executeInParallel(requests)
  }

  private generateCacheKey(options: MapMatchingOptions): string {
    return `mapmatching-${JSON.stringify({
      coordinates: options.coordinates,
      profile: options.profile,
      timestamps: options.timestamps
    })}`
  }

  private performTrackAnalysis(
    originalTrack: GPSPoint[],
    matchedTrack: MapMatchingResult,
    response: MapMatchingResponse
  ): GPSTrackAnalysis {
    const totalDistance = matchedTrack.distance
    const totalDuration = matchedTrack.duration
    const averageSpeed = totalDistance / totalDuration * 3.6 // km/h
    
    // Calculate max speed from annotations
    const speedAnnotations = matchedTrack.legs[0]?.annotation?.speed || []
    const maxSpeed = Math.max(...speedAnnotations) * 3.6 // km/h

    // Analyze deviations
    const deviations = this.calculateDeviations(originalTrack, response.tracepoints)
    
    // Determine road types from matched geometry
    const roadTypes = this.extractRoadTypes(matchedTrack)
    
    // Extract traffic conditions
    const trafficConditions = this.extractTrafficConditions(matchedTrack)

    return {
      originalTrack,
      matchedTrack,
      analysis: {
        totalDistance,
        totalDuration,
        averageSpeed,
        maxSpeed,
        confidenceScore: matchedTrack.confidence,
        roadTypes,
        trafficConditions,
        deviations
      },
      quality: {
        matchingQuality: this.assessMatchingQuality(matchedTrack.confidence, deviations),
        gpsAccuracy: this.calculateGPSAccuracy(originalTrack),
        roadCoverage: this.calculateRoadCoverage(response.tracepoints),
        temporalConsistency: this.calculateTemporalConsistency(originalTrack)
      }
    }
  }

  private calculateDeviations(
    originalTrack: GPSPoint[],
    tracepoints: (MapMatchingTracepoint | null)[]
  ): Array<{ point: GPSPoint; deviation: number; reason: string }> {
    const deviations: Array<{ point: GPSPoint; deviation: number; reason: string }> = []
    
    for (let i = 0; i < originalTrack.length; i++) {
      const original = originalTrack[i]
      const matched = tracepoints[i]
      
      if (!matched) {
        deviations.push({
          point: original,
          deviation: -1,
          reason: 'No matching road found'
        })
        continue
      }

      const deviation = this.calculateDistance(original.coordinates, matched.location)
      
      if (deviation > 50) { // More than 50 meters deviation
        deviations.push({
          point: original,
          deviation,
          reason: deviation > 200 ? 'Significant GPS error' : 'Off-road or GPS inaccuracy'
        })
      }
    }

    return deviations
  }

  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
    // Simple haversine distance calculation
    const R = 6371e3 // Earth's radius in meters
    const φ1 = coord1[1] * Math.PI / 180
    const φ2 = coord2[1] * Math.PI / 180
    const Δφ = (coord2[1] - coord1[1]) * Math.PI / 180
    const Δλ = (coord2[0] - coord1[0]) * Math.PI / 180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
  }

  private extractRoadTypes(matchedTrack: MapMatchingResult): string[] {
    // Extract road types from matched geometry
    // This is a simplified implementation
    const roadTypes = new Set<string>()
    
    for (const leg of matchedTrack.legs) {
      for (const step of leg.steps) {
        // Extract road class from step name or intersections
        if (step.name.includes('Highway') || step.name.includes('高速道路')) {
          roadTypes.add('highway')
        } else if (step.name.includes('Street') || step.name.includes('通り')) {
          roadTypes.add('street')
        } else if (step.name.includes('Avenue') || step.name.includes('大通り')) {
          roadTypes.add('avenue')
        } else {
          roadTypes.add('local')
        }
      }
    }

    return Array.from(roadTypes)
  }

  private extractTrafficConditions(matchedTrack: MapMatchingResult): string[] {
    const conditions = new Set<string>()
    
    for (const leg of matchedTrack.legs) {
      const congestion = leg.annotation?.congestion || []
      for (const level of congestion) {
        conditions.add(level)
      }
    }

    return Array.from(conditions)
  }

  private assessMatchingQuality(
    confidence: number,
    deviations: Array<{ point: GPSPoint; deviation: number; reason: string }>
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    const deviationScore = deviations.length === 0 ? 1 : 
                          deviations.filter(d => d.deviation < 50).length / deviations.length
    
    const overallScore = confidence * 0.7 + deviationScore * 0.3
    
    if (overallScore >= 0.9) return 'excellent'
    if (overallScore >= 0.75) return 'good'
    if (overallScore >= 0.5) return 'fair'
    return 'poor'
  }

  private calculateGPSAccuracy(originalTrack: GPSPoint[]): number {
    const accuracies = originalTrack.map(point => point.accuracy).filter(a => a !== undefined)
    return accuracies.length > 0 ? 
           accuracies.reduce((sum, acc) => sum + acc!, 0) / accuracies.length : 10
  }

  private calculateRoadCoverage(tracepoints: (MapMatchingTracepoint | null)[]): number {
    const matchedPoints = tracepoints.filter(tp => tp !== null).length
    return matchedPoints / tracepoints.length
  }

  private calculateTemporalConsistency(originalTrack: GPSPoint[]): number {
    const timestamps = originalTrack.map(point => point.timestamp).filter(t => t !== undefined)
    
    if (timestamps.length < 2) return 1
    
    const intervals = []
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i]! - timestamps[i-1]!)
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length
    
    return Math.max(0, 1 - variance / (avgInterval * avgInterval))
  }

  private detectViolations(analysis: GPSTrackAnalysis): Array<{
    location: [number, number]
    type: 'speed_limit' | 'wrong_way' | 'restricted_access' | 'off_road'
    severity: 'low' | 'medium' | 'high'
    description: string
  }> {
    const violations: Array<{
      location: [number, number]
      type: 'speed_limit' | 'wrong_way' | 'restricted_access' | 'off_road'
      severity: 'low' | 'medium' | 'high'
      description: string
    }> = []

    // Check for speed violations
    if (analysis.analysis.maxSpeed > 80) { // Assuming 80 km/h general speed limit
      violations.push({
        location: analysis.originalTrack[0].coordinates,
        type: 'speed_limit',
        severity: analysis.analysis.maxSpeed > 120 ? 'high' : 'medium',
        description: `Speed limit exceeded: ${analysis.analysis.maxSpeed.toFixed(1)} km/h`
      })
    }

    // Check for off-road violations
    for (const deviation of analysis.analysis.deviations) {
      if (deviation.deviation > 100) {
        violations.push({
          location: deviation.point.coordinates,
          type: 'off_road',
          severity: deviation.deviation > 200 ? 'high' : 'medium',
          description: `Off-road deviation: ${deviation.deviation.toFixed(1)}m`
        })
      }
    }

    return violations
  }

  private generateSuggestions(violations: Array<{
    location: [number, number]
    type: 'speed_limit' | 'wrong_way' | 'restricted_access' | 'off_road'
    severity: 'low' | 'medium' | 'high'
    description: string
  }>): string[] {
    const suggestions: string[] = []

    const speedViolations = violations.filter(v => v.type === 'speed_limit')
    if (speedViolations.length > 0) {
      suggestions.push('速度制限を遵守してください')
    }

    const offRoadViolations = violations.filter(v => v.type === 'off_road')
    if (offRoadViolations.length > 0) {
      suggestions.push('GPS精度を向上させるか、道路上を走行してください')
    }

    return suggestions
  }

  private generateTrackingAlerts(
    analysis: GPSTrackAnalysis,
    plannedRoute?: [number, number][]
  ): Array<{
    timestamp: number
    type: 'deviation' | 'delay' | 'speed' | 'restricted_area'
    severity: 'low' | 'medium' | 'high'
    message: string
    location: [number, number]
  }> {
    const alerts: Array<{
      timestamp: number
      type: 'deviation' | 'delay' | 'speed' | 'restricted_area'
      severity: 'low' | 'medium' | 'high'
      message: string
      location: [number, number]
    }> = []

    // Generate speed alerts
    if (analysis.analysis.maxSpeed > 80) {
      alerts.push({
        timestamp: Date.now(),
        type: 'speed',
        severity: analysis.analysis.maxSpeed > 120 ? 'high' : 'medium',
        message: `Speed limit exceeded: ${analysis.analysis.maxSpeed.toFixed(1)} km/h`,
        location: analysis.originalTrack[0].coordinates
      })
    }

    // Generate deviation alerts
    for (const deviation of analysis.analysis.deviations) {
      if (deviation.deviation > 100) {
        alerts.push({
          timestamp: Date.now(),
          type: 'deviation',
          severity: deviation.deviation > 200 ? 'high' : 'medium',
          message: `Route deviation: ${deviation.deviation.toFixed(1)}m`,
          location: deviation.point.coordinates
        })
      }
    }

    return alerts
  }

  private calculateAdherenceScore(
    analysis: GPSTrackAnalysis,
    plannedRoute: [number, number][]
  ): number {
    // Simplified adherence calculation
    // In practice, this would compare the actual route with planned route
    return Math.max(0, 100 - analysis.analysis.deviations.length * 10)
  }

  private calculateDeviationDistance(analysis: GPSTrackAnalysis): number {
    return analysis.analysis.deviations.reduce((sum, dev) => sum + dev.deviation, 0)
  }

  private calculateTimeVariance(analysis: GPSTrackAnalysis): number {
    // Simplified time variance calculation
    return analysis.analysis.totalDuration > 0 ? 
           Math.abs(analysis.analysis.totalDuration - analysis.analysis.totalDistance / 50 * 3.6) : 0
  }

  private calculateEfficiencyScore(analysis: GPSTrackAnalysis): number {
    const expectedSpeed = 50 // km/h
    const actualSpeed = analysis.analysis.averageSpeed
    return Math.min(100, (actualSpeed / expectedSpeed) * 100)
  }
}

export const mapMatchingService = new MapMatchingService()
export default mapMatchingService
