/**
 * Isochrone API Module
 * Reachability analysis for school zones, evacuation areas, and accessibility mapping
 */

import { mapboxMCP, IsochroneOptions, MapboxAPIResponse } from '../mapbox-mcp-services'
import { mapboxLogger } from '../mapbox-logger'

export type IsochroneProfile = 'walking' | 'cycling' | 'driving'

export interface IsochroneRequest {
  center: [number, number]
  contours: number[] // time in minutes
  profile: IsochroneProfile
  colors?: string[]
  denoise?: number
  generalize?: number
  polygons?: boolean
}

export interface IsochroneResponse {
  type: 'FeatureCollection'
  features: IsochroneFeature[]
  metadata: {
    profile: IsochroneProfile
    center: [number, number]
    contours: number[]
    generatedAt: string
  }
}

export interface IsochroneFeature {
  type: 'Feature'
  geometry: {
    type: 'Polygon'
    coordinates: number[][][]
  }
  properties: {
    contour: number
    color?: string
    opacity?: number
    fillColor?: string
    fillOpacity?: number
    metric: 'time'
    fill?: string
  }
}

export interface SchoolZoneAnalysis {
  school: {
    name: string
    coordinates: [number, number]
    type: 'elementary' | 'middle' | 'high'
  }
  walkingZones: {
    safe: IsochroneFeature[]    // 0-10 minutes
    caution: IsochroneFeature[] // 10-15 minutes
    distant: IsochroneFeature[] // 15-20 minutes
  }
  analysis: {
    coverage: number // percentage of area covered
    population: number // estimated population in zone
    dangerPoints: number // number of danger reports in zone
    safetyScore: number // 0-100 safety score
  }
}

export interface EvacuationZoneAnalysis {
  evacuationSite: {
    name: string
    coordinates: [number, number]
    type: 'shelter' | 'hospital' | 'fire_station' | 'police'
    capacity?: number
  }
  reachabilityZones: {
    immediate: IsochroneFeature[]  // 0-5 minutes
    urgent: IsochroneFeature[]     // 5-10 minutes
    standard: IsochroneFeature[]   // 10-15 minutes
    extended: IsochroneFeature[]   // 15-20 minutes
  }
  analysis: {
    coverage: number
    estimatedPopulation: number
    accessibilityScore: number
    bottlenecks: Array<{
      location: [number, number]
      severity: 'low' | 'medium' | 'high'
      description: string
    }>
  }
}

export interface AccessibilityAnalysis {
  location: [number, number]
  services: Array<{
    type: 'hospital' | 'school' | 'shopping' | 'transport' | 'park'
    reachability: {
      walking: IsochroneFeature[]
      cycling: IsochroneFeature[]
      driving: IsochroneFeature[]
    }
  }>
  overallScore: number
  recommendations: string[]
}

export interface BatchIsochroneRequest {
  locations: Array<{
    coordinates: [number, number]
    name?: string
    type?: string
  }>
  contours: number[]
  profile: IsochroneProfile
  colors?: string[]
}

export class IsochroneService {
  private cache: Map<string, { data: IsochroneResponse; timestamp: number }> = new Map()
  private cacheMaxAge = 10 * 60 * 1000 // 10 minutes

  /**
   * Generate isochrone polygons for a single location
   */
  async generateIsochrone(request: IsochroneRequest): Promise<MapboxAPIResponse<IsochroneResponse>> {
    const cacheKey = this.generateCacheKey(request)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      mapboxLogger.info('Isochrone retrieved from cache', { cacheKey })
      return {
        success: true,
        data: cached.data
      }
    }

    const options: IsochroneOptions = {
      coordinates: request.center,
      contours_minutes: request.contours,
      contours_colors: request.colors,
      polygons: request.polygons ?? true,
      denoise: request.denoise,
      generalize: request.generalize
    }

    const response = await mapboxMCP.getIsochrone(options)
    
    if (response.success && response.data) {
      const processedData = this.processIsochroneResponse(response.data, request)
      
      this.cache.set(cacheKey, {
        data: processedData,
        timestamp: Date.now()
      })
      
      mapboxLogger.info('Isochrone generated successfully', {
        center: request.center,
        profile: request.profile,
        contours: request.contours
      })

      return {
        success: true,
        data: processedData
      }
    }

    return response as MapboxAPIResponse<IsochroneResponse>
  }

  /**
   * Generate multiple isochrones in parallel
   */
  async batchGenerateIsochrones(request: BatchIsochroneRequest): Promise<MapboxAPIResponse<IsochroneResponse[]>> {
    const requests = request.locations.map(location => ({
      center: location.coordinates,
      contours: request.contours,
      profile: request.profile,
      colors: request.colors,
      polygons: true
    }))

    try {
      const results = await mapboxMCP.batchIsochrone(
        requests.map(req => ({
          coordinates: req.center,
          contours_minutes: req.contours,
          contours_colors: req.colors,
          polygons: req.polygons
        }))
      )

      const isochrones: IsochroneResponse[] = []
      const validResults = results.filter(result => 
        !(result instanceof Error) && result.success
      ) as MapboxAPIResponse<any>[]

      for (let i = 0; i < validResults.length; i++) {
        const result = validResults[i]
        if (result.data) {
          const processedData = this.processIsochroneResponse(result.data, requests[i])
          isochrones.push(processedData)
        }
      }

      return {
        success: true,
        data: isochrones
      }
    } catch (error) {
      mapboxLogger.error('Batch isochrone generation failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Analyze school zone accessibility
   */
  async analyzeSchoolZone(
    schoolLocation: [number, number],
    schoolName: string,
    schoolType: 'elementary' | 'middle' | 'high' = 'elementary'
  ): Promise<MapboxAPIResponse<SchoolZoneAnalysis>> {
    const walkingContours = [10, 15, 20] // minutes
    const colors = ['#4CAF50', '#FFC107', '#FF5722'] // green, amber, red

    const isochroneRequest: IsochroneRequest = {
      center: schoolLocation,
      contours: walkingContours,
      profile: 'walking',
      colors,
      polygons: true,
      denoise: 0.3,
      generalize: 0.01
    }

    const response = await this.generateIsochrone(isochroneRequest)
    
    if (!response.success || !response.data) {
      return response as unknown as MapboxAPIResponse<SchoolZoneAnalysis>
    }

    const features = response.data.features
    const analysis: SchoolZoneAnalysis = {
      school: {
        name: schoolName,
        coordinates: schoolLocation,
        type: schoolType
      },
      walkingZones: {
        safe: features.filter(f => f.properties.contour <= 10),
        caution: features.filter(f => f.properties.contour > 10 && f.properties.contour <= 15),
        distant: features.filter(f => f.properties.contour > 15)
      },
      analysis: {
        coverage: this.calculateCoverage(features),
        population: await this.estimatePopulation(features),
        dangerPoints: await this.countDangerPoints(features),
        safetyScore: this.calculateSafetyScore(features)
      }
    }

    return {
      success: true,
      data: analysis
    }
  }

  /**
   * Analyze evacuation zone coverage
   */
  async analyzeEvacuationZone(
    evacuationSite: {
      name: string
      coordinates: [number, number]
      type: 'shelter' | 'hospital' | 'fire_station' | 'police'
      capacity?: number
    }
  ): Promise<MapboxAPIResponse<EvacuationZoneAnalysis>> {
    const walkingContours = [5, 10, 15, 20] // minutes for evacuation
    const colors = ['#FF0000', '#FF6600', '#FFCC00', '#99CC00'] // red to yellow-green

    const isochroneRequest: IsochroneRequest = {
      center: evacuationSite.coordinates,
      contours: walkingContours,
      profile: 'walking',
      colors,
      polygons: true,
      denoise: 0.2,
      generalize: 0.005
    }

    const response = await this.generateIsochrone(isochroneRequest)
    
    if (!response.success || !response.data) {
      return response as unknown as MapboxAPIResponse<EvacuationZoneAnalysis>
    }

    const features = response.data.features
    const analysis: EvacuationZoneAnalysis = {
      evacuationSite,
      reachabilityZones: {
        immediate: features.filter(f => f.properties.contour <= 5),
        urgent: features.filter(f => f.properties.contour > 5 && f.properties.contour <= 10),
        standard: features.filter(f => f.properties.contour > 10 && f.properties.contour <= 15),
        extended: features.filter(f => f.properties.contour > 15)
      },
      analysis: {
        coverage: this.calculateCoverage(features),
        estimatedPopulation: await this.estimatePopulation(features),
        accessibilityScore: this.calculateAccessibilityScore(features),
        bottlenecks: await this.identifyBottlenecks(evacuationSite.coordinates, features)
      }
    }

    return {
      success: true,
      data: analysis
    }
  }

  /**
   * Comprehensive accessibility analysis
   */
  async analyzeAccessibility(
    location: [number, number],
    serviceTypes: Array<'hospital' | 'school' | 'shopping' | 'transport' | 'park'> = ['hospital', 'school', 'shopping']
  ): Promise<MapboxAPIResponse<AccessibilityAnalysis>> {
    const contours = [5, 10, 15, 20] // minutes
    const profiles: IsochroneProfile[] = ['walking', 'cycling', 'driving']

    try {
      const services = []
      
      for (const serviceType of serviceTypes) {
        const serviceReachability: any = {}
        
        for (const profile of profiles) {
          const isochroneRequest: IsochroneRequest = {
            center: location,
            contours,
            profile,
            colors: this.getServiceColors(serviceType),
            polygons: true
          }

          const response = await this.generateIsochrone(isochroneRequest)
          if (response.success && response.data) {
            serviceReachability[profile] = response.data.features
          }
        }

        services.push({
          type: serviceType,
          reachability: serviceReachability
        })
      }

      const overallScore = this.calculateOverallAccessibilityScore(services)
      const recommendations = this.generateAccessibilityRecommendations(services)

      return {
        success: true,
        data: {
          location,
          services,
          overallScore,
          recommendations
        }
      }
    } catch (error) {
      mapboxLogger.error('Accessibility analysis failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Compare reachability between multiple locations
   */
  async compareReachability(
    locations: Array<{
      coordinates: [number, number]
      name: string
    }>,
    contours: number[] = [10, 15, 20],
    profile: IsochroneProfile = 'walking'
  ): Promise<MapboxAPIResponse<{
    locations: Array<{
      name: string
      coordinates: [number, number]
      isochrone: IsochroneResponse
      score: number
    }>
    ranking: string[]
    bestLocation: string
  }>> {
    const batchRequest: BatchIsochroneRequest = {
      locations,
      contours,
      profile
    }

    const response = await this.batchGenerateIsochrones(batchRequest)
    
    if (!response.success || !response.data) {
      return response as any
    }

    const locationAnalysis = response.data.map((isochrone, index) => ({
      name: locations[index].name,
      coordinates: locations[index].coordinates,
      isochrone,
      score: this.calculateReachabilityScore(isochrone.features)
    }))

    const ranking = locationAnalysis
      .sort((a, b) => b.score - a.score)
      .map(location => location.name)

    const bestLocation = ranking[0]

    return {
      success: true,
      data: {
        locations: locationAnalysis,
        ranking,
        bestLocation
      }
    }
  }

  private processIsochroneResponse(rawResponse: any, request: IsochroneRequest): IsochroneResponse {
    return {
      type: 'FeatureCollection',
      features: rawResponse.features.map((feature: any, index: number) => ({
        ...feature,
        properties: {
          ...feature.properties,
          contour: request.contours[index],
          color: request.colors?.[index],
          opacity: 0.6,
          fillColor: request.colors?.[index],
          fillOpacity: 0.3,
          metric: 'time'
        }
      })),
      metadata: {
        profile: request.profile,
        center: request.center,
        contours: request.contours,
        generatedAt: new Date().toISOString()
      }
    }
  }

  private generateCacheKey(request: IsochroneRequest): string {
    return `isochrone-${JSON.stringify({
      center: request.center,
      contours: request.contours,
      profile: request.profile
    })}`
  }

  private calculateCoverage(features: IsochroneFeature[]): number {
    // Calculate total area covered by isochrones
    return features.reduce((total, feature) => {
      // Simplified area calculation
      return total + this.calculatePolygonArea(feature.geometry.coordinates[0])
    }, 0)
  }

  private calculatePolygonArea(coordinates: number[][]): number {
    // Simple polygon area calculation using shoelace formula
    let area = 0
    for (let i = 0; i < coordinates.length; i++) {
      const j = (i + 1) % coordinates.length
      area += coordinates[i][0] * coordinates[j][1]
      area -= coordinates[j][0] * coordinates[i][1]
    }
    return Math.abs(area) / 2
  }

  private async estimatePopulation(features: IsochroneFeature[]): Promise<number> {
    // In a real implementation, this would query population data
    // For now, return a rough estimate based on area
    const totalArea = this.calculateCoverage(features)
    return Math.round(totalArea * 1000) // Rough estimate
  }

  private async countDangerPoints(features: IsochroneFeature[]): Promise<number> {
    // In a real implementation, this would query the danger reports database
    // For now, return a placeholder
    return Math.floor(Math.random() * 20)
  }

  private calculateSafetyScore(features: IsochroneFeature[]): number {
    // Simplified safety score calculation
    const totalArea = this.calculateCoverage(features)
    const safeArea = features
      .filter(f => f.properties.contour <= 10)
      .reduce((sum, f) => sum + this.calculatePolygonArea(f.geometry.coordinates[0]), 0)
    
    return Math.round((safeArea / totalArea) * 100)
  }

  private calculateAccessibilityScore(features: IsochroneFeature[]): number {
    // Calculate accessibility score based on coverage and time
    const immediateArea = features
      .filter(f => f.properties.contour <= 5)
      .reduce((sum, f) => sum + this.calculatePolygonArea(f.geometry.coordinates[0]), 0)
    
    const totalArea = this.calculateCoverage(features)
    
    return Math.round((immediateArea / totalArea) * 100)
  }

  private async identifyBottlenecks(
    center: [number, number],
    features: IsochroneFeature[]
  ): Promise<Array<{ location: [number, number]; severity: 'low' | 'medium' | 'high'; description: string }>> {
    // Simplified bottleneck identification
    // In a real implementation, this would analyze road networks and identify narrow passages
    return [
      {
        location: [center[0] + 0.001, center[1] + 0.001],
        severity: 'medium',
        description: 'Narrow street may cause delays during evacuation'
      }
    ]
  }

  private calculateReachabilityScore(features: IsochroneFeature[]): number {
    // Calculate score based on total reachable area
    const weights = { 5: 1.0, 10: 0.8, 15: 0.6, 20: 0.4 }
    
    return features.reduce((score, feature) => {
      const contour = feature.properties.contour
      const area = this.calculatePolygonArea(feature.geometry.coordinates[0])
      const weight = weights[contour as keyof typeof weights] || 0.2
      return score + area * weight
    }, 0)
  }

  private getServiceColors(serviceType: string): string[] {
    const colorSchemes = {
      hospital: ['#FF0000', '#FF6600', '#FFAA00', '#FFCC00'],
      school: ['#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B'],
      shopping: ['#9C27B0', '#BA68C8', '#CE93D8', '#E1BEE7'],
      transport: ['#2196F3', '#64B5F6', '#90CAF9', '#BBDEFB'],
      park: ['#4CAF50', '#81C784', '#A5D6A7', '#C8E6C9']
    }
    
    return colorSchemes[serviceType as keyof typeof colorSchemes] || ['#757575', '#9E9E9E', '#BDBDBD', '#E0E0E0']
  }

  private calculateOverallAccessibilityScore(services: any[]): number {
    // Calculate weighted average of all service accessibility scores
    const weights = { hospital: 0.3, school: 0.25, shopping: 0.2, transport: 0.15, park: 0.1 }
    
    let totalScore = 0
    let totalWeight = 0
    
    for (const service of services) {
      const weight = weights[service.type as keyof typeof weights] || 0.1
      const serviceScore = this.calculateServiceAccessibilityScore(service.reachability)
      totalScore += serviceScore * weight
      totalWeight += weight
    }
    
    return Math.round(totalScore / totalWeight)
  }

  private calculateServiceAccessibilityScore(reachability: any): number {
    // Calculate score based on multi-modal accessibility
    const walkingScore = this.calculateReachabilityScore(reachability.walking || [])
    const cyclingScore = this.calculateReachabilityScore(reachability.cycling || [])
    const drivingScore = this.calculateReachabilityScore(reachability.driving || [])
    
    return Math.round((walkingScore * 0.5 + cyclingScore * 0.3 + drivingScore * 0.2) / 3)
  }

  private generateAccessibilityRecommendations(services: any[]): string[] {
    const recommendations: string[] = []
    
    // Analyze each service type and generate recommendations
    for (const service of services) {
      const score = this.calculateServiceAccessibilityScore(service.reachability)
      
      if (score < 30) {
        recommendations.push(`${service.type}へのアクセスが制限されています。公共交通機関の利用を検討してください。`)
      } else if (score < 60) {
        recommendations.push(`${service.type}へのアクセスは中程度です。自転車利用で改善できます。`)
      } else {
        recommendations.push(`${service.type}へのアクセスは良好です。`)
      }
    }
    
    return recommendations
  }
}

export const isochroneService = new IsochroneService()
export default isochroneService
