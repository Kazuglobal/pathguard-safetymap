/**
 * Matrix API Module
 * Distance and time calculations between multiple points
 */

import { mapboxMCP, MatrixOptions, MapboxAPIResponse } from '../mapbox-mcp-services'
import { mapboxLogger } from '../mapbox-logger'

export type MatrixProfile = 'driving' | 'walking' | 'cycling'
export type MatrixAnnotation = 'duration' | 'distance' | 'speed'

export interface MatrixRequest {
  coordinates: [number, number][]
  sources?: number[]
  destinations?: number[]
  profile?: MatrixProfile
  annotations?: MatrixAnnotation[]
  approaches?: ('unrestricted' | 'curb')[]
  exclude?: 'toll' | 'motorway' | 'ferry'
  fallback_speed?: number
}

export interface MatrixResponse {
  code: string
  durations: (number | null)[][]
  distances?: (number | null)[][]
  sources: MatrixWaypoint[]
  destinations: MatrixWaypoint[]
  fallback_speed_cells?: number[][]
  metadata?: {
    processing_time: number
    total_cells: number
    calculated_cells: number
  }
}

export interface MatrixWaypoint {
  hint?: string
  distance?: number
  name: string
  location: [number, number]
}

export interface TravelTimeMatrix {
  origins: Array<{
    name: string
    coordinates: [number, number]
  }>
  destinations: Array<{
    name: string
    coordinates: [number, number]
  }>
  matrix: {
    durations: (number | null)[][]
    distances: (number | null)[][]
    speeds: (number | null)[][]
  }
  analysis: {
    averageDuration: number
    averageDistance: number
    averageSpeed: number
    maxDuration: number
    maxDistance: number
    unreachableCount: number
  }
}

export interface RouteOptimization {
  originalOrder: number[]
  optimizedOrder: number[]
  improvement: {
    timeSaved: number
    distanceSaved: number
    percentageImprovement: number
  }
  routes: Array<{
    from: number
    to: number
    duration: number
    distance: number
  }>
}

export interface ServiceAreaAnalysis {
  center: [number, number]
  servicePoints: Array<{
    name: string
    coordinates: [number, number]
    serviceArea: {
      radius: number
      coverage: number
      population: number
    }
  }>
  coverage: {
    total: number
    optimal: number
    underserved: Array<{
      coordinates: [number, number]
      nearestService: string
      distance: number
      travelTime: number
    }>
  }
  recommendations: string[]
}

export interface AccessibilityMatrix {
  locations: Array<{
    name: string
    coordinates: [number, number]
    type: 'residential' | 'commercial' | 'service' | 'transport'
  }>
  accessibility: {
    [key: string]: {
      walking: number[]
      cycling: number[]
      driving: number[]
      publicTransport?: number[]
    }
  }
  score: number
  ranking: string[]
}

export interface CommutingAnalysis {
  residentialAreas: Array<{
    name: string
    coordinates: [number, number]
    population: number
  }>
  workplaces: Array<{
    name: string
    coordinates: [number, number]
    employees: number
  }>
  commuteMatrix: {
    averageTime: number[][]
    averageDistance: number[][]
    mode: MatrixProfile
  }
  insights: {
    averageCommute: number
    longestCommute: number
    shortestCommute: number
    commuteDistribution: Array<{
      timeRange: string
      count: number
      percentage: number
    }>
  }
  recommendations: string[]
}

export class MatrixService {
  private cache: Map<string, { data: MatrixResponse; timestamp: number }> = new Map()
  private cacheMaxAge = 10 * 60 * 1000 // 10 minutes

  /**
   * Calculate travel time/distance matrix
   */
  async calculateMatrix(request: MatrixRequest): Promise<MapboxAPIResponse<MatrixResponse>> {
    const cacheKey = this.generateCacheKey(request)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      mapboxLogger.info('Matrix retrieved from cache', { cacheKey })
      return {
        success: true,
        data: cached.data
      }
    }

    const matrixOptions: MatrixOptions = {
      coordinates: request.coordinates,
      sources: request.sources,
      destinations: request.destinations,
      profile: request.profile || 'driving',
      annotations: request.annotations || ['duration', 'distance'],
      approaches: request.approaches,
      exclude: request.exclude
    }

    const response = await mapboxMCP.getMatrix(matrixOptions)
    
    if (response.success && response.data) {
      this.cache.set(cacheKey, {
        data: response.data,
        timestamp: Date.now()
      })
      
      mapboxLogger.info('Matrix calculated successfully', {
        profile: request.profile,
        coordinates: request.coordinates.length,
        sources: request.sources?.length || request.coordinates.length,
        destinations: request.destinations?.length || request.coordinates.length
      })
    }

    return response
  }

  /**
   * Create comprehensive travel time matrix with analysis
   */
  async createTravelTimeMatrix(
    origins: Array<{ name: string; coordinates: [number, number] }>,
    destinations: Array<{ name: string; coordinates: [number, number] }>,
    profile: MatrixProfile = 'driving'
  ): Promise<MapboxAPIResponse<TravelTimeMatrix>> {
    const allCoordinates = [...origins.map(o => o.coordinates), ...destinations.map(d => d.coordinates)]
    const sources = Array.from({ length: origins.length }, (_, i) => i)
    const destIndices = Array.from({ length: destinations.length }, (_, i) => i + origins.length)

    const request: MatrixRequest = {
      coordinates: allCoordinates,
      sources,
      destinations: destIndices,
      profile,
      annotations: ['duration', 'distance']
    }

    const response = await this.calculateMatrix(request)
    
    if (!response.success || !response.data) {
      return response as MapboxAPIResponse<TravelTimeMatrix>
    }

    const matrix = response.data
    
    // Calculate speeds from duration and distance
    const speeds: (number | null)[][] = []
    for (let i = 0; i < matrix.durations.length; i++) {
      speeds[i] = []
      for (let j = 0; j < matrix.durations[i].length; j++) {
        const duration = matrix.durations[i][j]
        const distance = matrix.distances?.[i][j]
        if (duration && distance && duration > 0) {
          speeds[i][j] = (distance / 1000) / (duration / 3600) // km/h
        } else {
          speeds[i][j] = null
        }
      }
    }

    // Calculate analysis metrics
    const validDurations = matrix.durations.flat().filter(d => d !== null) as number[]
    const validDistances = matrix.distances?.flat().filter(d => d !== null) as number[] || []
    const validSpeeds = speeds.flat().filter(s => s !== null) as number[]

    const analysis = {
      averageDuration: validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length,
      averageDistance: validDistances.reduce((sum, d) => sum + d, 0) / validDistances.length,
      averageSpeed: validSpeeds.reduce((sum, s) => sum + s, 0) / validSpeeds.length,
      maxDuration: Math.max(...validDurations),
      maxDistance: Math.max(...validDistances),
      unreachableCount: matrix.durations.flat().filter(d => d === null).length
    }

    const travelTimeMatrix: TravelTimeMatrix = {
      origins,
      destinations,
      matrix: {
        durations: matrix.durations,
        distances: matrix.distances || [],
        speeds
      },
      analysis
    }

    return {
      success: true,
      data: travelTimeMatrix
    }
  }

  /**
   * Optimize route order using matrix calculations
   */
  async optimizeRoute(
    waypoints: Array<{ name: string; coordinates: [number, number] }>,
    profile: MatrixProfile = 'driving',
    returnToStart: boolean = false
  ): Promise<MapboxAPIResponse<RouteOptimization>> {
    if (waypoints.length < 3) {
      return {
        success: false,
        error: 'At least 3 waypoints are required for optimization'
      }
    }

    const request: MatrixRequest = {
      coordinates: waypoints.map(wp => wp.coordinates),
      profile,
      annotations: ['duration', 'distance']
    }

    const response = await this.calculateMatrix(request)
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'Failed to calculate matrix'
      }
    }

    const matrix = response.data
    const originalOrder = Array.from({ length: waypoints.length }, (_, i) => i)
    const optimizedOrder = this.solveTSP(matrix.durations, returnToStart)

    // Calculate improvement
    const originalDistance = this.calculateTotalDistance(originalOrder, matrix.durations, returnToStart)
    const optimizedDistance = this.calculateTotalDistance(optimizedOrder, matrix.durations, returnToStart)
    const improvement = {
      timeSaved: originalDistance - optimizedDistance,
      distanceSaved: 0, // Would need distance matrix for this
      percentageImprovement: ((originalDistance - optimizedDistance) / originalDistance) * 100
    }

    // Generate route segments
    const routes = []
    for (let i = 0; i < optimizedOrder.length - 1; i++) {
      const from = optimizedOrder[i]
      const to = optimizedOrder[i + 1]
      routes.push({
        from,
        to,
        duration: matrix.durations[from][to] || 0,
        distance: matrix.distances?.[from][to] || 0
      })
    }

    if (returnToStart && optimizedOrder.length > 0) {
      const from = optimizedOrder[optimizedOrder.length - 1]
      const to = optimizedOrder[0]
      routes.push({
        from,
        to,
        duration: matrix.durations[from][to] || 0,
        distance: matrix.distances?.[from][to] || 0
      })
    }

    const optimization: RouteOptimization = {
      originalOrder,
      optimizedOrder,
      improvement,
      routes
    }

    return {
      success: true,
      data: optimization
    }
  }

  /**
   * Analyze service area coverage
   */
  async analyzeServiceArea(
    servicePoints: Array<{ name: string; coordinates: [number, number] }>,
    analysisPoints: Array<{ name: string; coordinates: [number, number] }>,
    profile: MatrixProfile = 'driving',
    maxServiceDistance: number = 10000 // meters
  ): Promise<MapboxAPIResponse<ServiceAreaAnalysis>> {
    const allCoordinates = [...servicePoints.map(sp => sp.coordinates), ...analysisPoints.map(ap => ap.coordinates)]
    const sources = Array.from({ length: servicePoints.length }, (_, i) => i)
    const destinations = Array.from({ length: analysisPoints.length }, (_, i) => i + servicePoints.length)

    const request: MatrixRequest = {
      coordinates: allCoordinates,
      sources,
      destinations,
      profile,
      annotations: ['duration', 'distance']
    }

    const response = await this.calculateMatrix(request)
    
    if (!response.success || !response.data) {
      return response as MapboxAPIResponse<ServiceAreaAnalysis>
    }

    const matrix = response.data
    
    // Analyze coverage for each service point
    const servicePointsWithAnalysis = servicePoints.map((sp, i) => {
      const distances = matrix.distances?.[i] || []
      const durations = matrix.durations[i]
      
      const reachablePoints = distances.filter(d => d !== null && d <= maxServiceDistance)
      const coverage = reachablePoints.length / analysisPoints.length
      
      return {
        name: sp.name,
        coordinates: sp.coordinates,
        serviceArea: {
          radius: Math.max(...reachablePoints.filter(d => d !== null)) || 0,
          coverage,
          population: reachablePoints.length * 100 // Simplified population estimate
        }
      }
    })

    // Find underserved areas
    const underserved = []
    for (let j = 0; j < analysisPoints.length; j++) {
      const distances = matrix.distances?.map(row => row[j]) || []
      const durations = matrix.durations.map(row => row[j])
      
      const nearestServiceIndex = distances.reduce((minIdx, dist, idx) => 
        (dist !== null && (distances[minIdx] === null || dist < distances[minIdx]!)) ? idx : minIdx, 0
      )
      
      const nearestDistance = distances[nearestServiceIndex]
      const nearestDuration = durations[nearestServiceIndex]
      
      if (nearestDistance && nearestDistance > maxServiceDistance) {
        underserved.push({
          coordinates: analysisPoints[j].coordinates,
          nearestService: servicePoints[nearestServiceIndex].name,
          distance: nearestDistance,
          travelTime: nearestDuration || 0
        })
      }
    }

    const totalCoverage = servicePointsWithAnalysis.reduce((sum, sp) => sum + sp.serviceArea.coverage, 0) / servicePointsWithAnalysis.length
    const optimalCoverage = 0.95 // 95% coverage target

    const recommendations = []
    if (totalCoverage < optimalCoverage) {
      recommendations.push(`サービスエリアの充足率が${(totalCoverage * 100).toFixed(1)}%です。${(optimalCoverage * 100).toFixed(1)}%を目標に改善が必要です。`)
    }
    if (underserved.length > 0) {
      recommendations.push(`${underserved.length}箇所のサービス不足エリアが見つかりました。`)
    }

    const analysis: ServiceAreaAnalysis = {
      center: this.calculateCentroid(servicePoints.map(sp => sp.coordinates)),
      servicePoints: servicePointsWithAnalysis,
      coverage: {
        total: totalCoverage,
        optimal: optimalCoverage,
        underserved
      },
      recommendations
    }

    return {
      success: true,
      data: analysis
    }
  }

  /**
   * Calculate accessibility matrix for different transport modes
   */
  async calculateAccessibilityMatrix(
    locations: Array<{
      name: string
      coordinates: [number, number]
      type: 'residential' | 'commercial' | 'service' | 'transport'
    }>
  ): Promise<MapboxAPIResponse<AccessibilityMatrix>> {
    const profiles: MatrixProfile[] = ['walking', 'cycling', 'driving']
    const coordinates = locations.map(loc => loc.coordinates)
    
    const results: { [key: string]: { [profile: string]: number[] } } = {}
    
    try {
      for (const profile of profiles) {
        const request: MatrixRequest = {
          coordinates,
          profile,
          annotations: ['duration']
        }

        const response = await this.calculateMatrix(request)
        
        if (response.success && response.data) {
          for (let i = 0; i < locations.length; i++) {
            const locationName = locations[i].name
            if (!results[locationName]) {
              results[locationName] = {}
            }
            results[locationName][profile] = response.data.durations[i].map(d => d || Infinity)
          }
        }
      }

      // Calculate accessibility scores
      const accessibilityScores = locations.map(location => {
        const scores = profiles.map(profile => {
          const times = results[location.name][profile] || []
          const averageTime = times.reduce((sum, time) => sum + (time === Infinity ? 0 : time), 0) / times.length
          return Math.max(0, 100 - averageTime / 60) // Score based on average time in minutes
        })
        return scores.reduce((sum, score) => sum + score, 0) / scores.length
      })

      const overallScore = accessibilityScores.reduce((sum, score) => sum + score, 0) / accessibilityScores.length
      
      // Rank locations by accessibility
      const ranking = locations
        .map((loc, idx) => ({ name: loc.name, score: accessibilityScores[idx] }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.name)

      const accessibilityMatrix: AccessibilityMatrix = {
        locations,
        accessibility: results,
        score: overallScore,
        ranking
      }

      return {
        success: true,
        data: accessibilityMatrix
      }
    } catch (error) {
      mapboxLogger.error('Accessibility matrix calculation failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Analyze commuting patterns
   */
  async analyzeCommuting(
    residentialAreas: Array<{
      name: string
      coordinates: [number, number]
      population: number
    }>,
    workplaces: Array<{
      name: string
      coordinates: [number, number]
      employees: number
    }>,
    mode: MatrixProfile = 'driving'
  ): Promise<MapboxAPIResponse<CommutingAnalysis>> {
    const allCoordinates = [...residentialAreas.map(r => r.coordinates), ...workplaces.map(w => w.coordinates)]
    const sources = Array.from({ length: residentialAreas.length }, (_, i) => i)
    const destinations = Array.from({ length: workplaces.length }, (_, i) => i + residentialAreas.length)

    const request: MatrixRequest = {
      coordinates: allCoordinates,
      sources,
      destinations,
      profile: mode,
      annotations: ['duration', 'distance']
    }

    const response = await this.calculateMatrix(request)
    
    if (!response.success || !response.data) {
      return response as MapboxAPIResponse<CommutingAnalysis>
    }

    const matrix = response.data
    
    // Calculate commute statistics
    const allCommuteTimes = matrix.durations.flat().filter(d => d !== null) as number[]
    const averageCommute = allCommuteTimes.reduce((sum, time) => sum + time, 0) / allCommuteTimes.length
    const longestCommute = Math.max(...allCommuteTimes)
    const shortestCommute = Math.min(...allCommuteTimes)

    // Create commute time distribution
    const timeRanges = [
      { range: '0-15分', min: 0, max: 15 * 60 },
      { range: '15-30分', min: 15 * 60, max: 30 * 60 },
      { range: '30-45分', min: 30 * 60, max: 45 * 60 },
      { range: '45-60分', min: 45 * 60, max: 60 * 60 },
      { range: '60分以上', min: 60 * 60, max: Infinity }
    ]

    const distribution = timeRanges.map(range => {
      const count = allCommuteTimes.filter(time => time >= range.min && time < range.max).length
      return {
        timeRange: range.range,
        count,
        percentage: (count / allCommuteTimes.length) * 100
      }
    })

    // Generate recommendations
    const recommendations = []
    if (averageCommute > 30 * 60) { // More than 30 minutes
      recommendations.push('平均通勤時間が30分を超えています。公共交通機関の改善を検討してください。')
    }
    if (longestCommute > 60 * 60) { // More than 1 hour
      recommendations.push('最長通勤時間が1時間を超えています。リモートワークオプションを検討してください。')
    }

    const analysis: CommutingAnalysis = {
      residentialAreas,
      workplaces,
      commuteMatrix: {
        averageTime: matrix.durations,
        averageDistance: matrix.distances || [],
        mode
      },
      insights: {
        averageCommute,
        longestCommute,
        shortestCommute,
        commuteDistribution: distribution
      },
      recommendations
    }

    return {
      success: true,
      data: analysis
    }
  }

  /**
   * Process multiple matrix requests in parallel
   */
  async batchCalculateMatrix(
    requests: MatrixRequest[]
  ): Promise<Array<MapboxAPIResponse<MatrixResponse> | Error>> {
    const matrixRequests = requests.map(request => () => this.calculateMatrix(request))
    return mapboxMCP.getProcessor().executeInParallel(matrixRequests)
  }

  private generateCacheKey(request: MatrixRequest): string {
    return `matrix-${JSON.stringify({
      coordinates: request.coordinates,
      sources: request.sources,
      destinations: request.destinations,
      profile: request.profile
    })}`
  }

  private solveTSP(durations: (number | null)[][], returnToStart: boolean): number[] {
    const n = durations.length
    if (n <= 2) return Array.from({ length: n }, (_, i) => i)

    // Use nearest neighbor heuristic
    const visited = new Set<number>()
    const path = [0] // Start from first point
    visited.add(0)

    while (visited.size < n) {
      const current = path[path.length - 1]
      let nearest = -1
      let minDuration = Infinity

      for (let i = 0; i < n; i++) {
        const duration = durations[current][i]
        if (!visited.has(i) && duration !== null && duration < minDuration) {
          minDuration = duration
          nearest = i
        }
      }

      if (nearest !== -1) {
        path.push(nearest)
        visited.add(nearest)
      } else {
        break
      }
    }

    if (returnToStart && path.length > 1) {
      path.push(0)
    }

    return path
  }

  private calculateTotalDistance(order: number[], durations: (number | null)[][], returnToStart: boolean): number {
    let total = 0
    for (let i = 0; i < order.length - 1; i++) {
      const duration = durations[order[i]][order[i + 1]]
      if (duration !== null) {
        total += duration
      }
    }
    
    if (returnToStart && order.length > 1) {
      const duration = durations[order[order.length - 1]][order[0]]
      if (duration !== null) {
        total += duration
      }
    }
    
    return total
  }

  private calculateCentroid(coordinates: [number, number][]): [number, number] {
    const sumLng = coordinates.reduce((sum, coord) => sum + coord[0], 0)
    const sumLat = coordinates.reduce((sum, coord) => sum + coord[1], 0)
    return [sumLng / coordinates.length, sumLat / coordinates.length]
  }
}

export const matrixService = new MatrixService()
export default matrixService