/**
 * Mapbox MCP Services Layer
 * Unified interface for all Mapbox MCP operations with parallel processing support
 */

import { mapboxRateLimiter } from './rate-limiter'
import { mapboxLogger } from './mapbox-logger'
import { getMapboxToken } from './mapbox-config'

// Types for all Mapbox API responses
export interface MapboxAPIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  requestId?: string
  rateLimit?: {
    limit: number
    remaining: number
    reset: number
  }
}

export interface DirectionsOptions {
  coordinates: [number, number][]
  profile: 'driving' | 'walking' | 'cycling' | 'driving-traffic'
  alternatives?: boolean
  steps?: boolean
  geometries?: 'geojson' | 'polyline' | 'polyline6'
  continue_straight?: boolean
  waypoint_snapping?: string[]
  annotations?: string[]
  language?: string
  overview?: 'full' | 'simplified' | 'false'
  exclude?: string
}

export interface GeocodingOptions {
  query: string
  proximity?: [number, number]
  country?: string[]
  types?: string[]
  language?: string
  limit?: number
  autocomplete?: boolean
  bbox?: [number, number, number, number]
  fuzzyMatch?: boolean
}

export interface IsochroneOptions {
  coordinates: [number, number]
  contours_minutes?: number[]
  contours_colors?: string[]
  polygons?: boolean
  denoise?: number
  generalize?: number
}

export interface MatrixOptions {
  coordinates: [number, number][]
  sources?: number[]
  destinations?: number[]
  profile?: 'driving' | 'walking' | 'cycling'
  annotations?: ('duration' | 'distance' | 'speed')[]
  approaches?: string[]
  exclude?: string
}

export interface TilequeryOptions {
  coordinates: [number, number]
  radius?: number
  limit?: number
  dedupe?: boolean
  layers?: string[]
  geometry?: 'polygon' | 'linestring' | 'point'
}

export interface StaticImageOptions {
  style?: string
  overlay?: string
  width?: number
  height?: number
  retina?: boolean
  bearing?: number
  pitch?: number
  before_layer?: string
  addlayer?: string
  setfilter?: string
  layer_id?: string
  attribution?: boolean
  logo?: boolean
}

// Parallel processing utilities
export class ParallelProcessor {
  private concurrencyLimit: number = 5
  private requestQueue: Array<() => Promise<any>> = []
  private activeRequests: Set<Promise<any>> = new Set()

  constructor(concurrencyLimit: number = 5) {
    this.concurrencyLimit = concurrencyLimit
  }

  async executeInParallel<T>(
    requests: Array<() => Promise<T>>,
    options: {
      maxConcurrency?: number
      retryCount?: number
      retryDelay?: number
    } = {}
  ): Promise<Array<T | Error>> {
    const { maxConcurrency = this.concurrencyLimit, retryCount = 2, retryDelay = 1000 } = options
    const results: Array<T | Error> = []
    const executing: Array<Promise<any>> = []

    for (let i = 0; i < requests.length; i++) {
      const request = requests[i]
      
      const executeWithRetry = async (retries = retryCount): Promise<T | Error> => {
        try {
          return await request()
        } catch (error) {
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, retryDelay))
            return executeWithRetry(retries - 1)
          }
          return error instanceof Error ? error : new Error(String(error))
        }
      }

      const promise = executeWithRetry().then(result => {
        results[i] = result
      })

      executing.push(promise)

      if (executing.length >= maxConcurrency) {
        await Promise.race(executing)
        executing.splice(executing.findIndex(p => p === promise), 1)
      }
    }

    await Promise.all(executing)
    return results
  }

  async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = 10
  ): Promise<Array<R | Error>> {
    const results: Array<R | Error> = []
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      const batchRequests = batch.map(item => () => processor(item))
      const batchResults = await this.executeInParallel(batchRequests)
      results.push(...batchResults)
    }

    return results
  }
}

// Main MCP Service Class
export class MapboxMCPService {
  private token: string | null
  private baseUrl: string = 'https://api.mapbox.com'
  private processor: ParallelProcessor

  constructor() {
    this.token = getMapboxToken()
    this.processor = new ParallelProcessor(5)
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<MapboxAPIResponse<T>> {
    if (!this.token) {
      return {
        success: false,
        error: 'Mapbox access token is not available'
      }
    }

    const url = `${this.baseUrl}${endpoint}`
    const requestId = Math.random().toString(36).substring(2, 15)

    try {
      const response = await mapboxRateLimiter.withRateLimit(
        `mapbox-api-${endpoint}`,
        async () => {
          const result = await fetch(url, {
            ...options,
            headers: {
              'Content-Type': 'application/json',
              ...options.headers
            }
          })

          if (!result.ok) {
            throw new Error(`HTTP ${result.status}: ${result.statusText}`)
          }

          return result
        }
      )

      const data = await response.json()
      
      // Extract rate limit info from headers
      const rateLimit = {
        limit: parseInt(response.headers.get('X-RateLimit-Limit') || '0'),
        remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
        reset: parseInt(response.headers.get('X-RateLimit-Reset') || '0')
      }

      mapboxLogger.info(`API request successful: ${endpoint}`, {
        requestId,
        rateLimit
      })

      return {
        success: true,
        data,
        requestId,
        rateLimit
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      mapboxLogger.error(`API request failed: ${endpoint}`, {
        requestId,
        error: errorMessage
      })

      return {
        success: false,
        error: errorMessage,
        requestId
      }
    }
  }

  // Directions API
  async getDirections(options: DirectionsOptions): Promise<MapboxAPIResponse<any>> {
    const coords = options.coordinates.map(coord => coord.join(',')).join(';')
    const params = new URLSearchParams({
      access_token: this.token!,
      alternatives: options.alternatives?.toString() || 'false',
      steps: options.steps?.toString() || 'false',
      geometries: options.geometries || 'geojson',
      overview: options.overview || 'full'
    })

    if (options.continue_straight !== undefined) {
      params.append('continue_straight', options.continue_straight.toString())
    }
    if (options.language) {
      params.append('language', options.language)
    }
    if (options.exclude) {
      params.append('exclude', options.exclude)
    }

    const endpoint = `/directions/v5/mapbox/${options.profile}/${coords}?${params}`
    return this.makeRequest(endpoint)
  }

  // Geocoding API
  async geocode(options: GeocodingOptions): Promise<MapboxAPIResponse<any>> {
    const params = new URLSearchParams({
      access_token: this.token!,
      limit: options.limit?.toString() || '5',
      autocomplete: options.autocomplete?.toString() || 'true'
    })

    if (options.proximity) {
      params.append('proximity', options.proximity.join(','))
    }
    if (options.country) {
      params.append('country', options.country.join(','))
    }
    if (options.types) {
      params.append('types', options.types.join(','))
    }
    if (options.language) {
      params.append('language', options.language)
    }
    if (options.bbox) {
      params.append('bbox', options.bbox.join(','))
    }
    if (options.fuzzyMatch !== undefined) {
      params.append('fuzzyMatch', options.fuzzyMatch.toString())
    }

    const endpoint = `/geocoding/v5/mapbox.places/${encodeURIComponent(options.query)}.json?${params}`
    return this.makeRequest(endpoint)
  }

  // Reverse Geocoding
  async reverseGeocode(coordinates: [number, number], options: Partial<GeocodingOptions> = {}): Promise<MapboxAPIResponse<any>> {
    const coords = coordinates.join(',')
    const params = new URLSearchParams({
      access_token: this.token!,
      limit: options.limit?.toString() || '1'
    })

    if (options.types) {
      params.append('types', options.types.join(','))
    }
    if (options.language) {
      params.append('language', options.language)
    }

    const endpoint = `/geocoding/v5/mapbox.places/${coords}.json?${params}`
    return this.makeRequest(endpoint)
  }

  // Isochrone API
  async getIsochrone(options: IsochroneOptions): Promise<MapboxAPIResponse<any>> {
    const coords = options.coordinates.join(',')
    const params = new URLSearchParams({
      access_token: this.token!,
      contours_minutes: options.contours_minutes?.join(',') || '10,20,30',
      polygons: options.polygons?.toString() || 'true'
    })

    if (options.contours_colors) {
      params.append('contours_colors', options.contours_colors.join(','))
    }
    if (options.denoise) {
      params.append('denoise', options.denoise.toString())
    }
    if (options.generalize) {
      params.append('generalize', options.generalize.toString())
    }

    const endpoint = `/isochrone/v1/mapbox/walking/${coords}?${params}`
    return this.makeRequest(endpoint)
  }

  // Matrix API
  async getMatrix(options: MatrixOptions): Promise<MapboxAPIResponse<any>> {
    const coords = options.coordinates.map(coord => coord.join(',')).join(';')
    const params = new URLSearchParams({
      access_token: this.token!,
      annotations: options.annotations?.join(',') || 'duration,distance'
    })

    if (options.sources) {
      params.append('sources', options.sources.join(';'))
    }
    if (options.destinations) {
      params.append('destinations', options.destinations.join(';'))
    }
    if (options.approaches) {
      params.append('approaches', options.approaches.join(';'))
    }
    if (options.exclude) {
      params.append('exclude', options.exclude)
    }

    const profile = options.profile || 'driving'
    const endpoint = `/directions-matrix/v1/mapbox/${profile}/${coords}?${params}`
    return this.makeRequest(endpoint)
  }

  // Tilequery API
  async tilequery(options: TilequeryOptions): Promise<MapboxAPIResponse<any>> {
    const coords = options.coordinates.join(',')
    const params = new URLSearchParams({
      access_token: this.token!,
      radius: options.radius?.toString() || '50',
      limit: options.limit?.toString() || '50',
      dedupe: options.dedupe?.toString() || 'true'
    })

    if (options.layers) {
      params.append('layers', options.layers.join(','))
    }
    if (options.geometry) {
      params.append('geometry', options.geometry)
    }

    const endpoint = `/v4/mapbox.mapbox-streets-v8/tilequery/${coords}.json?${params}`
    return this.makeRequest(endpoint)
  }

  // Static Images API
  async getStaticImage(
    coordinates: [number, number],
    zoom: number,
    options: StaticImageOptions = {}
  ): Promise<MapboxAPIResponse<Blob>> {
    const style = options.style || 'mapbox/streets-v11'
    const width = options.width || 600
    const height = options.height || 400
    const retina = options.retina ? '@2x' : ''
    
    const params = new URLSearchParams({
      access_token: this.token!,
      attribution: options.attribution?.toString() || 'false',
      logo: options.logo?.toString() || 'false'
    })

    if (options.bearing) {
      params.append('bearing', options.bearing.toString())
    }
    if (options.pitch) {
      params.append('pitch', options.pitch.toString())
    }

    const endpoint = `/styles/v1/mapbox/${style}/static/${coordinates.join(',')}%2C${zoom}/${width}x${height}${retina}?${params}`
    
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const blob = await response.blob()
      return {
        success: true,
        data: blob
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  // Parallel processing methods
  async batchGeocode(queries: string[], options: Partial<GeocodingOptions> = {}): Promise<Array<MapboxAPIResponse<any> | Error>> {
    const requests = queries.map(query => () => this.geocode({ ...options, query }))
    return this.processor.executeInParallel(requests)
  }

  async batchDirections(routeOptions: DirectionsOptions[]): Promise<Array<MapboxAPIResponse<any> | Error>> {
    const requests = routeOptions.map(options => () => this.getDirections(options))
    return this.processor.executeInParallel(requests)
  }

  async batchIsochrone(isochroneOptions: IsochroneOptions[]): Promise<Array<MapboxAPIResponse<any> | Error>> {
    const requests = isochroneOptions.map(options => () => this.getIsochrone(options))
    return this.processor.executeInParallel(requests)
  }

  // Utility methods
  getProcessor(): ParallelProcessor {
    return this.processor
  }

  async healthCheck(): Promise<MapboxAPIResponse<any>> {
    return this.makeRequest('/tokens/v2')
  }
}

// Singleton instance
export const mapboxMCP = new MapboxMCPService()
export default mapboxMCP