/**
 * Enhanced Geocoding Service
 * Advanced address search with autocomplete and intelligent suggestions
 */

import { mapboxMCP, GeocodingOptions, MapboxAPIResponse } from '../mapbox-mcp-services'
import { mapboxLogger } from '../mapbox-logger'

export type GeocodingType = 'country' | 'region' | 'postcode' | 'district' | 'place' | 'locality' | 'neighborhood' | 'address' | 'poi'

export interface EnhancedGeocodingOptions extends Partial<GeocodingOptions> {
  sessionId?: string
  userLocation?: [number, number]
  searchHistory?: string[]
  preferredLanguages?: string[]
  biasRegion?: string
  strictBounds?: boolean
  includeAlternatives?: boolean
  includeDetails?: boolean
}

export interface GeocodingResult {
  id: string
  place_name: string
  place_name_ja?: string
  text: string
  text_ja?: string
  center: [number, number]
  geometry: {
    type: 'Point'
    coordinates: [number, number]
  }
  bbox?: [number, number, number, number]
  properties: {
    accuracy?: string
    address?: string
    category?: string
    maki?: string
    landmark?: boolean
    tel?: string
    website?: string
    wikidata?: string
    short_code?: string
    foursquare?: string
  }
  place_type: GeocodingType[]
  relevance: number
  confidence: number
  context: Array<{
    id: string
    text: string
    text_ja?: string
    short_code?: string
    wikidata?: string
  }>
}

export interface AutocompleteResult {
  id: string
  place_name: string
  place_name_ja?: string
  text: string
  matching_text: string
  matching_place_name: string
  center: [number, number]
  place_type: GeocodingType[]
  relevance: number
  suggestion_type: 'address' | 'poi' | 'place' | 'category'
  address_components?: {
    street_number?: string
    street_name?: string
    locality?: string
    region?: string
    postcode?: string
    country?: string
  }
  distance?: number
  category?: string
  icon?: string
}

export interface SearchSuggestion {
  query: string
  type: 'recent' | 'popular' | 'completion' | 'correction'
  score: number
  metadata?: {
    lastUsed?: number
    frequency?: number
    context?: string
  }
}

export interface GeocodingSession {
  sessionId: string
  userId?: string
  startTime: number
  queries: Array<{
    query: string
    timestamp: number
    results: GeocodingResult[]
    selected?: string
  }>
  location: [number, number]
  language: string
  context: {
    region?: string
    previousQueries: string[]
    selectedPlaces: string[]
  }
}

export interface LocationIntelligence {
  location: [number, number]
  address: {
    formatted: string
    components: {
      street_number?: string
      street_name?: string
      locality?: string
      region?: string
      postcode?: string
      country?: string
    }
    confidence: number
  }
  nearby: {
    pois: GeocodingResult[]
    places: GeocodingResult[]
    addresses: GeocodingResult[]
  }
  categories: string[]
  accessibility: {
    walkingScore: number
    drivingScore: number
    publicTransportScore: number
  }
  demographics: {
    population?: number
    density?: number
    ageDistribution?: { [key: string]: number }
  }
}

export interface BatchGeocodingResult {
  query: string
  results: GeocodingResult[]
  status: 'success' | 'error' | 'partial'
  error?: string
  processingTime: number
}

export interface SmartSearch {
  query: string
  suggestions: AutocompleteResult[]
  corrections: Array<{
    original: string
    corrected: string
    confidence: number
  }>
  categories: Array<{
    name: string
    count: number
    results: AutocompleteResult[]
  }>
  filters: {
    distance: { min: number; max: number }
    categories: string[]
    types: GeocodingType[]
  }
}

export class EnhancedGeocodingService {
  private cache: Map<string, { data: GeocodingResult[]; timestamp: number }> = new Map()
  private sessionCache: Map<string, GeocodingSession> = new Map()
  private searchHistory: Map<string, SearchSuggestion[]> = new Map()
  private cacheMaxAge = 5 * 60 * 1000 // 5 minutes
  private historyMaxAge = 7 * 24 * 60 * 60 * 1000 // 7 days

  /**
   * Enhanced geocoding with intelligent suggestions
   */
  async geocode(
    query: string,
    options: EnhancedGeocodingOptions = {}
  ): Promise<MapboxAPIResponse<GeocodingResult[]>> {
    const cacheKey = this.generateCacheKey(query, options)
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      mapboxLogger.info('Geocoding result retrieved from cache', { query, cacheKey })
      return {
        success: true,
        data: cached.data
      }
    }

    // Prepare geocoding options
    const geocodingOptions: GeocodingOptions = {
      query,
      proximity: options.proximity || options.userLocation,
      country: options.country,
      types: options.types,
      language: options.language || 'ja',
      limit: options.limit || 10,
      autocomplete: options.autocomplete !== false,
      bbox: options.bbox,
      fuzzyMatch: options.fuzzyMatch !== false
    }

    const response = await mapboxMCP.geocode(geocodingOptions)
    
    if (response.success && response.data) {
      const enhancedResults = this.enhanceGeocodingResults(response.data.features, query, options)
      
      // Cache the results
      this.cache.set(cacheKey, {
        data: enhancedResults,
        timestamp: Date.now()
      })
      
      // Update session if provided
      if (options.sessionId) {
        this.updateSession(options.sessionId, query, enhancedResults)
      }
      
      // Update search history
      this.updateSearchHistory(query, enhancedResults)
      
      mapboxLogger.info('Geocoding completed successfully', {
        query,
        results: enhancedResults.length,
        sessionId: options.sessionId
      })

      return {
        success: true,
        data: enhancedResults
      }
    }

    return response as MapboxAPIResponse<GeocodingResult[]>
  }

  /**
   * Real-time autocomplete with intelligent suggestions
   */
  async autocomplete(
    query: string,
    options: EnhancedGeocodingOptions = {}
  ): Promise<MapboxAPIResponse<AutocompleteResult[]>> {
    if (query.length < 2) {
      return {
        success: true,
        data: []
      }
    }

    const geocodingOptions: GeocodingOptions = {
      query,
      proximity: options.proximity || options.userLocation,
      country: options.country,
      types: options.types,
      language: options.language || 'ja',
      limit: options.limit || 5,
      autocomplete: true,
      fuzzyMatch: true
    }

    const response = await mapboxMCP.geocode(geocodingOptions)
    
    if (response.success && response.data) {
      const autocompleteResults = this.convertToAutocompleteResults(
        response.data.features,
        query,
        options
      )
      
      // Add suggestions from search history
      const historySuggestions = this.getHistorySuggestions(query, options)
      
      // Merge and rank all suggestions
      const allSuggestions = [...autocompleteResults, ...historySuggestions]
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, options.limit || 8)

      return {
        success: true,
        data: allSuggestions
      }
    }

    return response as MapboxAPIResponse<AutocompleteResult[]>
  }

  /**
   * Reverse geocoding with location intelligence
   */
  async reverseGeocode(
    coordinates: [number, number],
    options: Partial<EnhancedGeocodingOptions> = {}
  ): Promise<MapboxAPIResponse<LocationIntelligence>> {
    const reverseOptions: Partial<GeocodingOptions> = {
      types: options.types || ['address'],
      language: options.language || 'ja',
      limit: 1
    }

    const response = await mapboxMCP.reverseGeocode(coordinates, reverseOptions)
    
    if (!response.success || !response.data) {
      return response as MapboxAPIResponse<LocationIntelligence>
    }

    const primaryResult = response.data.features[0]
    const intelligence = await this.generateLocationIntelligence(coordinates, primaryResult, options)
    
    return {
      success: true,
      data: intelligence
    }
  }

  /**
   * Smart search with categorization and filtering
   */
  async smartSearch(
    query: string,
    options: EnhancedGeocodingOptions = {}
  ): Promise<MapboxAPIResponse<SmartSearch>> {
    // Get autocomplete suggestions
    const autocompleteResponse = await this.autocomplete(query, {
      ...options,
      limit: 20
    })
    
    if (!autocompleteResponse.success || !autocompleteResponse.data) {
      return {
        success: false,
        error: 'Failed to get autocomplete suggestions'
      }
    }

    const suggestions = autocompleteResponse.data
    
    // Generate query corrections
    const corrections = this.generateQueryCorrections(query, suggestions)
    
    // Categorize results
    const categories = this.categorizeResults(suggestions)
    
    // Generate filters
    const filters = this.generateFilters(suggestions, options)
    
    const smartSearchResult: SmartSearch = {
      query,
      suggestions,
      corrections,
      categories,
      filters
    }

    return {
      success: true,
      data: smartSearchResult
    }
  }

  /**
   * Batch geocoding with parallel processing
   */
  async batchGeocode(
    queries: string[],
    options: EnhancedGeocodingOptions = {}
  ): Promise<MapboxAPIResponse<BatchGeocodingResult[]>> {
    const startTime = Date.now()
    
    const requests = queries.map(query => async () => {
      const queryStartTime = Date.now()
      try {
        const response = await this.geocode(query, options)
        return {
          query,
          results: response.success ? response.data! : [],
          status: response.success ? 'success' as const : 'error' as const,
          error: response.error,
          processingTime: Date.now() - queryStartTime
        }
      } catch (error) {
        return {
          query,
          results: [],
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingTime: Date.now() - queryStartTime
        }
      }
    })

    const results = await mapboxMCP.getProcessor().executeInParallel(requests)
    
    const batchResults = results.map(result => 
      result instanceof Error ? {
        query: 'unknown',
        results: [],
        status: 'error' as const,
        error: result.message,
        processingTime: 0
      } : result
    )

    mapboxLogger.info('Batch geocoding completed', {
      queries: queries.length,
      totalTime: Date.now() - startTime,
      successful: batchResults.filter(r => r.status === 'success').length
    })

    return {
      success: true,
      data: batchResults
    }
  }

  /**
   * Create and manage geocoding session
   */
  createSession(userId?: string, location?: [number, number], language: string = 'ja'): string {
    const sessionId = Math.random().toString(36).substring(2, 15)
    
    const session: GeocodingSession = {
      sessionId,
      userId,
      startTime: Date.now(),
      queries: [],
      location: location || [139.6917, 35.6895], // Default to Tokyo
      language,
      context: {
        previousQueries: [],
        selectedPlaces: []
      }
    }

    this.sessionCache.set(sessionId, session)
    
    mapboxLogger.info('Geocoding session created', { sessionId, userId })
    
    return sessionId
  }

  /**
   * Get search suggestions based on context
   */
  getSearchSuggestions(
    query: string,
    sessionId?: string,
    limit: number = 5
  ): SearchSuggestion[] {
    const suggestions: SearchSuggestion[] = []
    
    // Get session context
    const session = sessionId ? this.sessionCache.get(sessionId) : null
    
    // Recent queries from session
    if (session) {
      const recentQueries = session.queries
        .filter(q => q.query.toLowerCase().includes(query.toLowerCase()))
        .slice(-3)
        .map(q => ({
          query: q.query,
          type: 'recent' as const,
          score: 0.8,
          metadata: { lastUsed: q.timestamp }
        }))
      
      suggestions.push(...recentQueries)
    }
    
    // Popular searches
    const popularSuggestions = this.getPopularSuggestions(query, limit)
    suggestions.push(...popularSuggestions)
    
    // Query completions
    const completions = this.getQueryCompletions(query, limit)
    suggestions.push(...completions)
    
    // Sort and limit
    return suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Analyze search patterns and trends
   */
  analyzeSearchPatterns(sessionId?: string): {
    topQueries: string[]
    popularCategories: string[]
    regionPreferences: string[]
    searchTrends: { query: string; frequency: number; trend: 'up' | 'down' | 'stable' }[]
  } {
    const session = sessionId ? this.sessionCache.get(sessionId) : null
    
    // This would typically analyze historical data
    // For now, return sample data
    return {
      topQueries: ['東京駅', '新宿', '渋谷', '池袋', '品川'],
      popularCategories: ['駅', 'レストラン', 'ショッピング', 'ホテル', '観光地'],
      regionPreferences: ['東京', '大阪', '名古屋', '横浜', '京都'],
      searchTrends: [
        { query: '東京駅', frequency: 1250, trend: 'up' },
        { query: '新宿', frequency: 980, trend: 'stable' },
        { query: '渋谷', frequency: 856, trend: 'down' }
      ]
    }
  }

  /**
   * Clean up expired sessions and cache
   */
  cleanupExpiredData(): void {
    const now = Date.now()
    
    // Clean up expired cache entries
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheMaxAge) {
        this.cache.delete(key)
      }
    }
    
    // Clean up expired sessions
    for (const [sessionId, session] of this.sessionCache.entries()) {
      if (now - session.startTime > 24 * 60 * 60 * 1000) { // 24 hours
        this.sessionCache.delete(sessionId)
      }
    }
    
    // Clean up old search history
    for (const [key, suggestions] of this.searchHistory.entries()) {
      const validSuggestions = suggestions.filter(s => 
        !s.metadata?.lastUsed || (now - s.metadata.lastUsed) < this.historyMaxAge
      )
      
      if (validSuggestions.length === 0) {
        this.searchHistory.delete(key)
      } else {
        this.searchHistory.set(key, validSuggestions)
      }
    }
    
    mapboxLogger.info('Cleanup completed', {
      cacheSize: this.cache.size,
      sessionCount: this.sessionCache.size,
      historyEntries: this.searchHistory.size
    })
  }

  private generateCacheKey(query: string, options: EnhancedGeocodingOptions): string {
    return `geocoding-${JSON.stringify({
      query: query.toLowerCase(),
      proximity: options.proximity,
      country: options.country,
      types: options.types,
      language: options.language
    })}`
  }

  private enhanceGeocodingResults(
    features: any[],
    query: string,
    options: EnhancedGeocodingOptions
  ): GeocodingResult[] {
    return features.map((feature, index) => {
      const result: GeocodingResult = {
        id: feature.id || `result-${index}`,
        place_name: feature.place_name,
        place_name_ja: feature.place_name_ja,
        text: feature.text,
        text_ja: feature.text_ja,
        center: feature.center,
        geometry: feature.geometry,
        bbox: feature.bbox,
        properties: feature.properties || {},
        place_type: feature.place_type || ['place'],
        relevance: feature.relevance || 0,
        confidence: this.calculateConfidence(feature, query),
        context: feature.context || []
      }

      // Add distance if user location is provided
      if (options.userLocation) {
        const distance = this.calculateDistance(
          options.userLocation,
          feature.center
        )
        result.properties = { ...result.properties, distance }
      }

      return result
    })
  }

  private convertToAutocompleteResults(
    features: any[],
    query: string,
    options: EnhancedGeocodingOptions
  ): AutocompleteResult[] {
    return features.map((feature, index) => {
      const result: AutocompleteResult = {
        id: feature.id || `autocomplete-${index}`,
        place_name: feature.place_name,
        place_name_ja: feature.place_name_ja,
        text: feature.text,
        matching_text: this.extractMatchingText(feature.text, query),
        matching_place_name: this.extractMatchingText(feature.place_name, query),
        center: feature.center,
        place_type: feature.place_type || ['place'],
        relevance: feature.relevance || 0,
        suggestion_type: this.determineSuggestionType(feature),
        category: feature.properties?.category,
        icon: feature.properties?.maki || 'marker'
      }

      // Add address components
      if (feature.context) {
        result.address_components = this.extractAddressComponents(feature.context)
      }

      // Add distance if user location is provided
      if (options.userLocation) {
        result.distance = this.calculateDistance(
          options.userLocation,
          feature.center
        )
      }

      return result
    })
  }

  private async generateLocationIntelligence(
    coordinates: [number, number],
    primaryResult: any,
    options: Partial<EnhancedGeocodingOptions>
  ): Promise<LocationIntelligence> {
    // Get nearby POIs and places
    const nearbyResponse = await this.geocode('nearby', {
      proximity: coordinates,
      types: ['poi', 'place', 'address'],
      limit: 10
    })

    const nearby = nearbyResponse.success ? nearbyResponse.data! : []

    return {
      location: coordinates,
      address: {
        formatted: primaryResult?.place_name || '',
        components: this.extractAddressComponents(primaryResult?.context || []) || {},
        confidence: this.calculateConfidence(primaryResult, '')
      },
      nearby: {
        pois: nearby.filter(r => r.place_type.includes('poi')),
        places: nearby.filter(r => r.place_type.includes('place')),
        addresses: nearby.filter(r => r.place_type.includes('address'))
      },
      categories: this.extractCategories(nearby),
      accessibility: {
        walkingScore: this.calculateWalkingScore(nearby),
        drivingScore: this.calculateDrivingScore(nearby),
        publicTransportScore: this.calculatePublicTransportScore(nearby)
      },
      demographics: {
        population: undefined, // Would need external data
        density: undefined,
        ageDistribution: undefined
      }
    }
  }

  private updateSession(sessionId: string, query: string, results: GeocodingResult[]): void {
    const session = this.sessionCache.get(sessionId)
    if (!session) return

    session.queries.push({
      query,
      timestamp: Date.now(),
      results
    })

    session.context.previousQueries.push(query)
    
    // Keep only last 10 queries
    if (session.queries.length > 10) {
      session.queries = session.queries.slice(-10)
    }
    
    if (session.context.previousQueries.length > 10) {
      session.context.previousQueries = session.context.previousQueries.slice(-10)
    }
  }

  private updateSearchHistory(query: string, results: GeocodingResult[]): void {
    const key = query.toLowerCase()
    
    if (!this.searchHistory.has(key)) {
      this.searchHistory.set(key, [])
    }
    
    const suggestions = this.searchHistory.get(key)!
    
    // Update or add suggestion
    const existingIndex = suggestions.findIndex(s => s.query === query)
    if (existingIndex >= 0) {
      suggestions[existingIndex].metadata!.frequency = (suggestions[existingIndex].metadata!.frequency || 0) + 1
      suggestions[existingIndex].metadata!.lastUsed = Date.now()
    } else {
      suggestions.push({
        query,
        type: 'recent',
        score: 0.7,
        metadata: {
          frequency: 1,
          lastUsed: Date.now()
        }
      })
    }
  }

  private getHistorySuggestions(query: string, options: EnhancedGeocodingOptions): AutocompleteResult[] {
    const historyKey = query.toLowerCase()
    const suggestions = this.searchHistory.get(historyKey) || []
    
    return suggestions
      .filter(s => s.query.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 2)
      .map(s => ({
        id: `history-${s.query}`,
        place_name: s.query,
        text: s.query,
        matching_text: s.query,
        matching_place_name: s.query,
        center: [0, 0] as [number, number],
        place_type: ['place'] as GeocodingType[],
        relevance: s.score,
        suggestion_type: 'address' as const,
        icon: 'history'
      }))
  }

  private generateQueryCorrections(
    query: string,
    suggestions: AutocompleteResult[]
  ): Array<{ original: string; corrected: string; confidence: number }> {
    const corrections: Array<{ original: string; corrected: string; confidence: number }> = []
    
    // Simple typo correction logic
    for (const suggestion of suggestions) {
      const distance = this.calculateEditDistance(query, suggestion.text)
      if (distance > 0 && distance <= 2) {
        corrections.push({
          original: query,
          corrected: suggestion.text,
          confidence: 1 - (distance / query.length)
        })
      }
    }
    
    return corrections.slice(0, 3)
  }

  private categorizeResults(suggestions: AutocompleteResult[]): Array<{
    name: string
    count: number
    results: AutocompleteResult[]
  }> {
    const categories: { [key: string]: AutocompleteResult[] } = {}
    
    suggestions.forEach(suggestion => {
      const category = suggestion.category || 'その他'
      if (!categories[category]) {
        categories[category] = []
      }
      categories[category].push(suggestion)
    })
    
    return Object.entries(categories).map(([name, results]) => ({
      name,
      count: results.length,
      results
    }))
  }

  private generateFilters(
    suggestions: AutocompleteResult[],
    options: EnhancedGeocodingOptions
  ): SmartSearch['filters'] {
    const distances = suggestions
      .map(s => s.distance)
      .filter(d => d !== undefined) as number[]
    
    const categories = [...new Set(suggestions.map(s => s.category).filter(c => c))]
    const types = [...new Set(suggestions.flatMap(s => s.place_type))]
    
    return {
      distance: {
        min: Math.min(...distances, 0),
        max: Math.max(...distances, 10000)
      },
      categories,
      types
    }
  }

  private calculateConfidence(feature: any, query: string): number {
    let confidence = feature.relevance || 0
    
    // Boost confidence for exact matches
    if (feature.text?.toLowerCase() === query.toLowerCase()) {
      confidence += 0.2
    }
    
    // Boost confidence for specific place types
    if (feature.place_type?.includes('address')) {
      confidence += 0.1
    }
    
    return Math.min(1, confidence)
  }

  private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
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

  private extractMatchingText(text: string, query: string): string {
    if (!text) return ''
    
    const queryLower = query.toLowerCase()
    const textLower = text.toLowerCase()
    
    const index = textLower.indexOf(queryLower)
    if (index >= 0) {
      return text.substring(index, index + query.length)
    }
    
    return text
  }

  private determineSuggestionType(feature: any): AutocompleteResult['suggestion_type'] {
    if (feature.place_type?.includes('poi')) return 'poi'
    if (feature.place_type?.includes('address')) return 'address'
    if (feature.properties?.category) return 'category'
    return 'place'
  }

  private extractAddressComponents(context: any[]): AutocompleteResult['address_components'] {
    const components: AutocompleteResult['address_components'] = {}
    
    context.forEach(item => {
      if (item.id.includes('postcode')) {
        components.postcode = item.text
      } else if (item.id.includes('place')) {
        components.locality = item.text
      } else if (item.id.includes('region')) {
        components.region = item.text
      } else if (item.id.includes('country')) {
        components.country = item.text
      }
    })
    
    return components
  }

  private extractCategories(results: GeocodingResult[]): string[] {
    const categories = new Set<string>()
    
    results.forEach(result => {
      if (result.properties.category) {
        categories.add(result.properties.category)
      }
    })
    
    return Array.from(categories).filter(cat => cat !== undefined)
  }

  private calculateWalkingScore(nearby: GeocodingResult[]): number {
    // Count nearby amenities within walking distance (500m)
    const walkingDistance = 500
    const walkable = nearby.filter(r => 
      (r.properties as any).distance && (r.properties as any).distance <= walkingDistance
    )
    
    return Math.min(100, walkable.length * 10)
  }

  private calculateDrivingScore(nearby: GeocodingResult[]): number {
    // Most places are accessible by car
    return 85
  }

  private calculatePublicTransportScore(nearby: GeocodingResult[]): number {
    // Check for nearby transport hubs
    const transportHubs = nearby.filter(r => 
      r.properties.category === 'transport' || 
      r.place_type.includes('poi') && r.text?.includes('駅')
    )
    
    return transportHubs.length > 0 ? 80 : 40
  }

  private getPopularSuggestions(query: string, limit: number): SearchSuggestion[] {
    // This would typically come from analytics data
    const popularQueries = ['東京駅', '新宿', '渋谷', '池袋', '品川']
    
    return popularQueries
      .filter(q => q.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit)
      .map(q => ({
        query: q,
        type: 'popular',
        score: 0.9,
        metadata: { frequency: 1000 }
      }))
  }

  private getQueryCompletions(query: string, limit: number): SearchSuggestion[] {
    // Simple completion suggestions
    const completions = [
      query + '駅',
      query + '空港',
      query + 'ホテル',
      query + 'レストラン'
    ]
    
    return completions
      .slice(0, limit)
      .map(q => ({
        query: q,
        type: 'completion',
        score: 0.6
      }))
  }

  private calculateEditDistance(str1: string, str2: string): number {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }
}

export const enhancedGeocodingService = new EnhancedGeocodingService()
export default enhancedGeocodingService