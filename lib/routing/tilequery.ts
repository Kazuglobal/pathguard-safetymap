/**
 * Tilequery API Module
 * Road attribute queries and spatial analysis
 */

import { mapboxMCP, TilequeryOptions, MapboxAPIResponse } from '../mapbox-mcp-services'
import { mapboxLogger } from '../mapbox-logger'

export type TilequeryGeometry = 'polygon' | 'linestring' | 'point'
export type TilequeryLayer = 'road' | 'poi' | 'building' | 'landuse' | 'waterway' | 'admin'

export interface TilequeryRequest {
  coordinates: [number, number]
  radius?: number
  limit?: number
  dedupe?: boolean
  layers?: TilequeryLayer[]
  geometry?: TilequeryGeometry
  buffer?: number
}

export interface TilequeryResponse {
  type: 'FeatureCollection'
  features: TilequeryFeature[]
  metadata: {
    query: {
      coordinates: [number, number]
      radius: number
      limit: number
    }
    processingTime: number
    totalFeatures: number
  }
}

export interface TilequeryFeature {
  type: 'Feature'
  id: string
  geometry: {
    type: string
    coordinates: any
  }
  properties: {
    [key: string]: any
    tilequery: {
      distance: number
      geometry: TilequeryGeometry
      layer: string
    }
  }
}

export interface RoadAttributes {
  roadClass: string
  roadType: string
  speedLimit?: number
  lanes?: number
  width?: number
  surface?: string
  access?: string
  oneWay?: boolean
  bridge?: boolean
  tunnel?: boolean
  tollRoad?: boolean
  name?: string
  ref?: string
}

export interface IntersectionAnalysis {
  location: [number, number]
  intersectionType: 'simple' | 'complex' | 'roundabout' | 'highway_junction'
  roads: Array<{
    name: string
    class: string
    bearing: number
    lanes: number
    speedLimit: number
  }>
  trafficControl: {
    hasTrafficLight: boolean
    hasStopSign: boolean
    hasYieldSign: boolean
    hasRoundabout: boolean
  }
  complexity: {
    score: number
    level: 'low' | 'medium' | 'high'
    reasons: string[]
  }
  safety: {
    score: number
    concerns: string[]
    recommendations: string[]
  }
}

export interface POIAnalysis {
  location: [number, number]
  radius: number
  categories: {
    [category: string]: Array<{
      name: string
      coordinates: [number, number]
      distance: number
      category: string
      subcategory?: string
      rating?: number
      businessHours?: string
    }>
  }
  density: {
    total: number
    perKmSquared: number
    categories: { [category: string]: number }
  }
  accessibility: {
    walkingAccess: number
    drivingAccess: number
    publicTransportAccess: number
  }
}

export interface LandUseAnalysis {
  location: [number, number]
  radius: number
  landUse: {
    residential: number
    commercial: number
    industrial: number
    recreational: number
    agricultural: number
    forest: number
    water: number
    other: number
  }
  zoning: {
    primary: string
    mixed: boolean
    compatibility: number
  }
  development: {
    density: 'low' | 'medium' | 'high'
    type: 'urban' | 'suburban' | 'rural'
    growth: 'declining' | 'stable' | 'growing'
  }
}

export interface EnvironmentalAnalysis {
  location: [number, number]
  waterFeatures: Array<{
    type: 'river' | 'lake' | 'stream' | 'canal'
    name: string
    distance: number
    coordinates: [number, number]
  }>
  elevation: {
    current: number
    min: number
    max: number
    gradient: number
  }
  vegetation: {
    coverage: number
    type: string[]
    density: 'sparse' | 'moderate' | 'dense'
  }
  risks: {
    flood: 'low' | 'medium' | 'high'
    landslide: 'low' | 'medium' | 'high'
    earthquake: 'low' | 'medium' | 'high'
  }
}

export interface AreaProfile {
  location: [number, number]
  radius: number
  profile: {
    roads: RoadAttributes[]
    intersections: IntersectionAnalysis[]
    pois: POIAnalysis
    landUse: LandUseAnalysis
    environment: EnvironmentalAnalysis
  }
  scores: {
    accessibility: number
    safety: number
    development: number
    environment: number
    overall: number
  }
  classification: {
    type: 'urban' | 'suburban' | 'rural' | 'mixed'
    density: 'low' | 'medium' | 'high'
    character: string[]
  }
}

export class TilequeryService {
  private cache: Map<string, { data: TilequeryResponse; timestamp: number }> = new Map()
  private cacheMaxAge = 30 * 60 * 1000 // 30 minutes

  /**
   * Query map features at a specific location
   */
  async queryFeatures(request: TilequeryRequest): Promise<MapboxAPIResponse<TilequeryResponse>> {
    const cacheKey = this.generateCacheKey(request)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      mapboxLogger.info('Tilequery result retrieved from cache', { cacheKey })
      return {
        success: true,
        data: cached.data
      }
    }

    const tilequeryOptions: TilequeryOptions = {
      coordinates: request.coordinates,
      radius: request.radius || 50,
      limit: request.limit || 50,
      dedupe: request.dedupe !== false,
      layers: request.layers,
      geometry: request.geometry
    }

    const response = await mapboxMCP.tilequery(tilequeryOptions)
    
    if (response.success && response.data) {
      const processedData = this.processTilequeryResponse(response.data, request)
      
      this.cache.set(cacheKey, {
        data: processedData,
        timestamp: Date.now()
      })
      
      mapboxLogger.info('Tilequery completed successfully', {
        coordinates: request.coordinates,
        radius: request.radius,
        features: processedData.features.length
      })

      return {
        success: true,
        data: processedData
      }
    }

    return response as MapboxAPIResponse<TilequeryResponse>
  }

  /**
   * Backward-compatible alias used by API routes.
   */
  async queryMapFeatures(request: TilequeryRequest): Promise<MapboxAPIResponse<TilequeryResponse>> {
    return this.queryFeatures(request)
  }

  /**
   * Backward-compatible helper for nearby POI search.
   */
  async findNearbyPOIs(
    location: [number, number],
    radius: number = 1000,
    _layers?: TilequeryLayer[],
    _limit: number = 50
  ): Promise<MapboxAPIResponse<POIAnalysis>> {
    return this.analyzePOIs(location, radius)
  }

  /**
   * Backward-compatible helper for route POI analysis.
   */
  async analyzeRoutePOIs(
    routeGeometry: GeoJSON.LineString,
    buffer: number = 500,
    _layers?: TilequeryLayer[],
    _categories?: string[]
  ): Promise<MapboxAPIResponse<POIAnalysis>> {
    const coordinates = Array.isArray(routeGeometry?.coordinates)
      ? routeGeometry.coordinates
      : []
    const midpoint = coordinates.length > 0 ? coordinates[Math.floor(coordinates.length / 2)] : undefined
    if (!midpoint || midpoint.length < 2) {
      return {
        success: false,
        error: 'Valid route geometry is required'
      }
    }
    return this.analyzePOIs([midpoint[0], midpoint[1]], buffer)
  }

  /**
   * Backward-compatible helper for emergency service discovery.
   */
  async findEmergencyServices(
    location: [number, number],
    radius: number = 5000,
    _serviceTypes?: string[]
  ): Promise<MapboxAPIResponse<POIAnalysis>> {
    return this.analyzePOIs(location, radius)
  }

  /**
   * Backward-compatible helper for transportation analysis.
   */
  async analyzeTransportation(
    location: [number, number],
    radius: number = 2000,
    _transportModes?: string[]
  ): Promise<MapboxAPIResponse<POIAnalysis>> {
    return this.analyzePOIs(location, radius)
  }

  /**
   * Backward-compatible helper for safety feature search.
   */
  async findSafetyFeatures(
    location: [number, number],
    radius: number = 1000,
    _featureTypes?: string[]
  ): Promise<MapboxAPIResponse<TilequeryResponse>> {
    return this.queryFeatures({
      coordinates: location,
      radius,
      layers: ['poi'],
      geometry: 'point'
    })
  }

  /**
   * Get road attributes at a specific location
   */
  async getRoadAttributes(coordinates: [number, number], radius: number = 10): Promise<MapboxAPIResponse<RoadAttributes[]>> {
    const request: TilequeryRequest = {
      coordinates,
      radius,
      limit: 20,
      layers: ['road'],
      geometry: 'linestring'
    }

    const response = await this.queryFeatures(request)
    
    if (!response.success || !response.data) {
      return response as unknown as MapboxAPIResponse<RoadAttributes[]>
    }

    const roadAttributes = response.data.features.map(feature => 
      this.extractRoadAttributes(feature)
    ).filter(attr => attr !== null) as RoadAttributes[]

    return {
      success: true,
      data: roadAttributes
    }
  }

  /**
   * Analyze intersection complexity and safety
   */
  async analyzeIntersection(coordinates: [number, number], radius: number = 50): Promise<MapboxAPIResponse<IntersectionAnalysis>> {
    const request: TilequeryRequest = {
      coordinates,
      radius,
      limit: 50,
      layers: ['road'],
      geometry: 'linestring'
    }

    const response = await this.queryFeatures(request)
    
    if (!response.success || !response.data) {
      return response as unknown as MapboxAPIResponse<IntersectionAnalysis>
    }

    const roadFeatures = response.data.features.filter(f => 
      f.properties.tilequery?.layer === 'road'
    )

    const roads = roadFeatures.map(feature => ({
      name: feature.properties.name || 'Unnamed Road',
      class: feature.properties.class || 'unknown',
      bearing: this.calculateBearing(coordinates, feature.geometry.coordinates),
      lanes: feature.properties.lanes || 2,
      speedLimit: feature.properties.maxspeed || 50
    }))

    const intersectionType = this.determineIntersectionType(roads.length, roadFeatures)
    const trafficControl = this.analyzeTrafficControl(roadFeatures)
    const complexity = this.calculateComplexity(roads, intersectionType)
    const safety = this.assessSafety(roads, trafficControl, complexity)

    const analysis: IntersectionAnalysis = {
      location: coordinates,
      intersectionType,
      roads,
      trafficControl,
      complexity,
      safety
    }

    return {
      success: true,
      data: analysis
    }
  }

  /**
   * Analyze Points of Interest in an area
   */
  async analyzePOIs(coordinates: [number, number], radius: number = 500): Promise<MapboxAPIResponse<POIAnalysis>> {
    const request: TilequeryRequest = {
      coordinates,
      radius,
      limit: 100,
      layers: ['poi'],
      geometry: 'point'
    }

    const response = await this.queryFeatures(request)
    
    if (!response.success || !response.data) {
      return response as unknown as MapboxAPIResponse<POIAnalysis>
    }

    const poiFeatures = response.data.features.filter(f => 
      f.properties.tilequery?.layer === 'poi'
    )

    // Categorize POIs
    const categories: { [category: string]: any[] } = {}
    poiFeatures.forEach(feature => {
      const category = feature.properties.category || 'other'
      if (!categories[category]) {
        categories[category] = []
      }
      
      categories[category].push({
        name: feature.properties.name || 'Unnamed POI',
        coordinates: feature.geometry.coordinates,
        distance: feature.properties.tilequery?.distance || 0,
        category,
        subcategory: feature.properties.subcategory,
        rating: feature.properties.rating,
        businessHours: feature.properties.opening_hours
      })
    })

    // Calculate density
    const areaKmSquared = Math.PI * Math.pow(radius / 1000, 2)
    const density = {
      total: poiFeatures.length,
      perKmSquared: poiFeatures.length / areaKmSquared,
      categories: Object.fromEntries(
        Object.entries(categories).map(([cat, pois]) => [cat, pois.length])
      )
    }

    // Assess accessibility (simplified)
    const accessibility = {
      walkingAccess: this.calculateWalkingAccess(poiFeatures),
      drivingAccess: this.calculateDrivingAccess(poiFeatures),
      publicTransportAccess: this.calculatePublicTransportAccess(poiFeatures)
    }

    const analysis: POIAnalysis = {
      location: coordinates,
      radius,
      categories,
      density,
      accessibility
    }

    return {
      success: true,
      data: analysis
    }
  }

  /**
   * Analyze land use patterns
   */
  async analyzeLandUse(coordinates: [number, number], radius: number = 1000): Promise<MapboxAPIResponse<LandUseAnalysis>> {
    const request: TilequeryRequest = {
      coordinates,
      radius,
      limit: 200,
      layers: ['landuse'],
      geometry: 'polygon'
    }

    const response = await this.queryFeatures(request)
    
    if (!response.success || !response.data) {
      return response as unknown as MapboxAPIResponse<LandUseAnalysis>
    }

    const landUseFeatures = response.data.features.filter(f => 
      f.properties.tilequery?.layer === 'landuse'
    )

    // Calculate land use percentages
    const landUse = this.calculateLandUseDistribution(landUseFeatures, radius)
    const zoning = this.analyzeZoning(landUse)
    const development = this.assessDevelopment(landUse, landUseFeatures)

    const analysis: LandUseAnalysis = {
      location: coordinates,
      radius,
      landUse,
      zoning,
      development
    }

    return {
      success: true,
      data: analysis
    }
  }

  /**
   * Analyze environmental features
   */
  async analyzeEnvironment(coordinates: [number, number], radius: number = 1000): Promise<MapboxAPIResponse<EnvironmentalAnalysis>> {
    const request: TilequeryRequest = {
      coordinates,
      radius,
      limit: 100,
      layers: ['waterway', 'landuse'],
      geometry: 'polygon'
    }

    const response = await this.queryFeatures(request)
    
    if (!response.success || !response.data) {
      return response as unknown as MapboxAPIResponse<EnvironmentalAnalysis>
    }

    const waterFeatures = response.data.features
      .filter(f => f.properties.tilequery?.layer === 'waterway')
      .map(feature => ({
        type: feature.properties.type || 'water',
        name: feature.properties.name || 'Unnamed Water Feature',
        distance: feature.properties.tilequery?.distance || 0,
        coordinates: feature.geometry.coordinates
      }))

    // Simplified environmental analysis
    const elevation = {
      current: 0, // Would need elevation API
      min: 0,
      max: 0,
      gradient: 0
    }

    const vegetation = {
      coverage: this.calculateVegetationCoverage(response.data.features),
      type: this.identifyVegetationType(response.data.features),
      density: 'moderate' as const
    }

    const risks = {
      flood: this.assessFloodRisk(waterFeatures),
      landslide: 'low' as const,
      earthquake: 'low' as const
    }

    const analysis: EnvironmentalAnalysis = {
      location: coordinates,
      waterFeatures,
      elevation,
      vegetation,
      risks
    }

    return {
      success: true,
      data: analysis
    }
  }

  /**
   * Create comprehensive area profile
   */
  async createAreaProfile(coordinates: [number, number], radius: number = 1000): Promise<MapboxAPIResponse<AreaProfile>> {
    try {
      // Run all analyses in parallel
      const [roadResponse, intersectionResponse, poiResponse, landUseResponse, envResponse] = await Promise.all([
        this.getRoadAttributes(coordinates, radius),
        this.analyzeIntersection(coordinates, 100),
        this.analyzePOIs(coordinates, radius),
        this.analyzeLandUse(coordinates, radius),
        this.analyzeEnvironment(coordinates, radius)
      ])

      // Check if all analyses succeeded
      if (!roadResponse.success || !intersectionResponse.success || !poiResponse.success || 
          !landUseResponse.success || !envResponse.success) {
        return {
          success: false,
          error: 'One or more area analyses failed'
        }
      }

      const profile: AreaProfile = {
        location: coordinates,
        radius,
        profile: {
          roads: roadResponse.data!,
          intersections: [intersectionResponse.data!],
          pois: poiResponse.data!,
          landUse: landUseResponse.data!,
          environment: envResponse.data!
        },
        scores: {
          accessibility: this.calculateAccessibilityScore(poiResponse.data!),
          safety: intersectionResponse.data!.safety.score,
          development: this.calculateDevelopmentScore(landUseResponse.data!),
          environment: this.calculateEnvironmentScore(envResponse.data!),
          overall: 0
        },
        classification: {
          type: this.classifyAreaType(landUseResponse.data!),
          density: landUseResponse.data!.development.density,
          character: this.identifyAreaCharacter(poiResponse.data!, landUseResponse.data!)
        }
      }

      // Calculate overall score
      profile.scores.overall = (
        profile.scores.accessibility * 0.3 +
        profile.scores.safety * 0.3 +
        profile.scores.development * 0.2 +
        profile.scores.environment * 0.2
      )

      return {
        success: true,
        data: profile
      }
    } catch (error) {
      mapboxLogger.error('Area profile creation failed', { error })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Batch query multiple locations
   */
  async batchQueryFeatures(requests: TilequeryRequest[]): Promise<Array<MapboxAPIResponse<TilequeryResponse> | Error>> {
    const tilequeryRequests = requests.map(request => () => this.queryFeatures(request))
    return mapboxMCP.getProcessor().executeInParallel(tilequeryRequests)
  }

  private generateCacheKey(request: TilequeryRequest): string {
    return `tilequery-${JSON.stringify({
      coordinates: request.coordinates,
      radius: request.radius,
      layers: request.layers,
      geometry: request.geometry
    })}`
  }

  private processTilequeryResponse(rawResponse: any, request: TilequeryRequest): TilequeryResponse {
    return {
      type: 'FeatureCollection',
      features: rawResponse.features || [],
      metadata: {
        query: {
          coordinates: request.coordinates,
          radius: request.radius || 50,
          limit: request.limit || 50
        },
        processingTime: Date.now(),
        totalFeatures: rawResponse.features?.length || 0
      }
    }
  }

  private extractRoadAttributes(feature: TilequeryFeature): RoadAttributes | null {
    if (!feature.properties) return null

    return {
      roadClass: feature.properties.class || 'unknown',
      roadType: feature.properties.type || 'unknown',
      speedLimit: feature.properties.maxspeed,
      lanes: feature.properties.lanes,
      width: feature.properties.width,
      surface: feature.properties.surface,
      access: feature.properties.access,
      oneWay: feature.properties.oneway === 'yes',
      bridge: feature.properties.bridge === 'yes',
      tunnel: feature.properties.tunnel === 'yes',
      tollRoad: feature.properties.toll === 'yes',
      name: feature.properties.name,
      ref: feature.properties.ref
    }
  }

  private calculateBearing(from: [number, number], to: any): number {
    // Simplified bearing calculation
    const toCoords = Array.isArray(to[0]) ? to[0] : to
    const deltaLng = toCoords[0] - from[0]
    const deltaLat = toCoords[1] - from[1]
    return Math.atan2(deltaLng, deltaLat) * 180 / Math.PI
  }

  private determineIntersectionType(roadCount: number, roadFeatures: TilequeryFeature[]): IntersectionAnalysis['intersectionType'] {
    if (roadCount <= 2) return 'simple'
    if (roadCount <= 4) return 'complex'
    
    // Check for roundabout
    const hasRoundabout = roadFeatures.some(f => f.properties.junction === 'roundabout')
    if (hasRoundabout) return 'roundabout'
    
    // Check for highway junction
    const hasHighway = roadFeatures.some(f => f.properties.class === 'motorway' || f.properties.class === 'trunk')
    if (hasHighway) return 'highway_junction'
    
    return 'complex'
  }

  private analyzeTrafficControl(roadFeatures: TilequeryFeature[]): IntersectionAnalysis['trafficControl'] {
    // Simplified traffic control analysis
    return {
      hasTrafficLight: roadFeatures.some(f => f.properties.traffic_signals === 'yes'),
      hasStopSign: roadFeatures.some(f => f.properties.stop === 'yes'),
      hasYieldSign: roadFeatures.some(f => f.properties.yield === 'yes'),
      hasRoundabout: roadFeatures.some(f => f.properties.junction === 'roundabout')
    }
  }

  private calculateComplexity(roads: any[], intersectionType: string): IntersectionAnalysis['complexity'] {
    let score = 0
    const reasons: string[] = []

    // Base complexity from number of roads
    if (roads.length > 4) {
      score += 20
      reasons.push('多数の道路が交差')
    }

    // Complexity from intersection type
    switch (intersectionType) {
      case 'highway_junction':
        score += 30
        reasons.push('高速道路ジャンクション')
        break
      case 'roundabout':
        score += 15
        reasons.push('ラウンドアバウト')
        break
      case 'complex':
        score += 10
        reasons.push('複雑な交差点')
        break
    }

    // Speed differences
    const speeds = roads.map(r => r.speedLimit)
    const speedRange = Math.max(...speeds) - Math.min(...speeds)
    if (speedRange > 30) {
      score += 10
      reasons.push('速度制限の差が大きい')
    }

    const level = score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low'

    return { score, level, reasons }
  }

  private assessSafety(roads: any[], trafficControl: any, complexity: any): IntersectionAnalysis['safety'] {
    let score = 100
    const concerns: string[] = []
    const recommendations: string[] = []

    // Reduce score based on complexity
    score -= complexity.score * 0.5

    // Check for traffic control
    if (!trafficControl.hasTrafficLight && !trafficControl.hasStopSign && !trafficControl.hasYieldSign) {
      score -= 20
      concerns.push('交通制御がない')
      recommendations.push('交通信号の設置を検討')
    }

    // Check for high-speed roads
    const hasHighSpeed = roads.some(r => r.speedLimit > 60)
    if (hasHighSpeed) {
      score -= 15
      concerns.push('高速道路が含まれる')
      recommendations.push('速度制限の見直し')
    }

    return {
      score: Math.max(0, score),
      concerns,
      recommendations
    }
  }

  private calculateWalkingAccess(poiFeatures: TilequeryFeature[]): number {
    // Simplified walking access calculation
    const walkableDistance = 500 // meters
    const walkablePOIs = poiFeatures.filter(f => 
      (f.properties.tilequery?.distance || 0) <= walkableDistance
    )
    return (walkablePOIs.length / poiFeatures.length) * 100
  }

  private calculateDrivingAccess(poiFeatures: TilequeryFeature[]): number {
    // Most POIs are accessible by car
    return 90
  }

  private calculatePublicTransportAccess(poiFeatures: TilequeryFeature[]): number {
    // Simplified public transport access
    const hasTransport = poiFeatures.some(f => 
      f.properties.category === 'transport' || f.properties.amenity === 'bus_stop'
    )
    return hasTransport ? 80 : 40
  }

  private calculateLandUseDistribution(landUseFeatures: TilequeryFeature[], radius: number): LandUseAnalysis['landUse'] {
    const landUse = {
      residential: 0,
      commercial: 0,
      industrial: 0,
      recreational: 0,
      agricultural: 0,
      forest: 0,
      water: 0,
      other: 0
    }

    // Simplified land use calculation
    landUseFeatures.forEach(feature => {
      const type = feature.properties.landuse || feature.properties.type
      switch (type) {
        case 'residential':
          landUse.residential += 1
          break
        case 'commercial':
        case 'retail':
          landUse.commercial += 1
          break
        case 'industrial':
          landUse.industrial += 1
          break
        case 'recreation':
        case 'park':
          landUse.recreational += 1
          break
        case 'agriculture':
        case 'farmland':
          landUse.agricultural += 1
          break
        case 'forest':
          landUse.forest += 1
          break
        case 'water':
          landUse.water += 1
          break
        default:
          landUse.other += 1
      }
    })

    // Normalize to percentages
    const total = Object.values(landUse).reduce((sum, val) => sum + val, 0)
    if (total > 0) {
      Object.keys(landUse).forEach(key => {
        landUse[key as keyof typeof landUse] = (landUse[key as keyof typeof landUse] / total) * 100
      })
    }

    return landUse
  }

  private analyzeZoning(landUse: LandUseAnalysis['landUse']): LandUseAnalysis['zoning'] {
    const entries = Object.entries(landUse)
    const primary = entries.reduce((a, b) => a[1] > b[1] ? a : b)[0]
    const mixed = entries.filter(([_, percentage]) => percentage > 20).length > 2
    const compatibility = mixed ? 75 : 90

    return { primary, mixed, compatibility }
  }

  private assessDevelopment(landUse: LandUseAnalysis['landUse'], features: TilequeryFeature[]): LandUseAnalysis['development'] {
    const urbanIndicators = landUse.residential + landUse.commercial + landUse.industrial
    
    const density = urbanIndicators > 60 ? 'high' : urbanIndicators > 30 ? 'medium' : 'low'
    const type = urbanIndicators > 50 ? 'urban' : urbanIndicators > 20 ? 'suburban' : 'rural'
    
    return {
      density,
      type,
      growth: 'stable' // Would need historical data
    }
  }

  private calculateVegetationCoverage(features: TilequeryFeature[]): number {
    const vegetationFeatures = features.filter(f => 
      f.properties.landuse === 'forest' || 
      f.properties.natural === 'wood' ||
      f.properties.leisure === 'park'
    )
    return (vegetationFeatures.length / features.length) * 100
  }

  private identifyVegetationType(features: TilequeryFeature[]): string[] {
    const types = new Set<string>()
    features.forEach(f => {
      if (f.properties.natural) types.add(f.properties.natural)
      if (f.properties.landuse === 'forest') types.add('forest')
      if (f.properties.leisure === 'park') types.add('park')
    })
    return Array.from(types)
  }

  private assessFloodRisk(waterFeatures: any[]): 'low' | 'medium' | 'high' {
    if (waterFeatures.length === 0) return 'low'
    
    const hasRiver = waterFeatures.some(w => w.type === 'river')
    const nearbyWater = waterFeatures.some(w => w.distance < 100)
    
    if (hasRiver && nearbyWater) return 'high'
    if (hasRiver || nearbyWater) return 'medium'
    return 'low'
  }

  private calculateAccessibilityScore(poiAnalysis: POIAnalysis): number {
    const weights = {
      walkingAccess: 0.4,
      drivingAccess: 0.3,
      publicTransportAccess: 0.3
    }
    
    return (
      poiAnalysis.accessibility.walkingAccess * weights.walkingAccess +
      poiAnalysis.accessibility.drivingAccess * weights.drivingAccess +
      poiAnalysis.accessibility.publicTransportAccess * weights.publicTransportAccess
    )
  }

  private calculateDevelopmentScore(landUseAnalysis: LandUseAnalysis): number {
    const developmentLevel = {
      'low': 40,
      'medium': 70,
      'high': 90
    }
    
    return developmentLevel[landUseAnalysis.development.density]
  }

  private calculateEnvironmentScore(envAnalysis: EnvironmentalAnalysis): number {
    let score = 50
    
    // Vegetation bonus
    score += envAnalysis.vegetation.coverage * 0.3
    
    // Water features bonus
    if (envAnalysis.waterFeatures.length > 0) {
      score += 20
    }
    
    // Risk penalties
    if (envAnalysis.risks.flood === 'high') score -= 20
    if (envAnalysis.risks.landslide === 'high') score -= 15
    
    return Math.max(0, Math.min(100, score))
  }

  private classifyAreaType(landUseAnalysis: LandUseAnalysis): 'urban' | 'suburban' | 'rural' | 'mixed' {
    const { residential, commercial, industrial } = landUseAnalysis.landUse
    const urban = residential + commercial + industrial
    
    if (urban > 60) return 'urban'
    if (urban > 30) return 'suburban'
    if (urban > 10) return 'mixed'
    return 'rural'
  }

  private identifyAreaCharacter(poiAnalysis: POIAnalysis, landUseAnalysis: LandUseAnalysis): string[] {
    const character: string[] = []
    
    // From POI analysis
    if (poiAnalysis.categories.retail && poiAnalysis.categories.retail.length > 5) {
      character.push('商業地区')
    }
    if (poiAnalysis.categories.food && poiAnalysis.categories.food.length > 10) {
      character.push('飲食店街')
    }
    if (poiAnalysis.categories.education && poiAnalysis.categories.education.length > 2) {
      character.push('文教地区')
    }
    
    // From land use analysis
    if (landUseAnalysis.landUse.residential > 50) {
      character.push('住宅地区')
    }
    if (landUseAnalysis.landUse.recreational > 20) {
      character.push('レクリエーション地区')
    }
    if (landUseAnalysis.landUse.industrial > 30) {
      character.push('工業地区')
    }
    
    return character.length > 0 ? character : ['一般地区']
  }
}

export const tilequeryService = new TilequeryService()
export default tilequeryService
