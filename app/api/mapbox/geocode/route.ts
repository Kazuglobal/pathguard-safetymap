import { NextRequest, NextResponse } from 'next/server'
import { enhancedGeocodingService } from '@/lib/geocoding/enhanced-geocoding'
import { logApiUsage } from '@/lib/api-usage-logger'
import { createServerClient } from '@/lib/supabase-server'

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 20
const MAX_QUERY_LENGTH = 200

async function requireAuthenticatedUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  return null
}

function parseCoordinatePair(value: string | null): [number, number] | undefined {
  if (!value) return undefined

  const [first, second] = value.split(',').map((v) => Number(v.trim()))
  if (!Number.isFinite(first) || !Number.isFinite(second)) {
    return undefined
  }

  return [first, second]
}

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_LIMIT

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT

  return Math.min(MAX_LIMIT, Math.max(1, parsed))
}

function normalizeQuery(value: string | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_QUERY_LENGTH) return null
  return trimmed
}

export async function GET(request: NextRequest) {
  try {
    const authError = await requireAuthenticatedUser()
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const query = normalizeQuery(searchParams.get('query'))
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      )
    }

    const options = {
      proximity: parseCoordinatePair(searchParams.get('proximity')),
      country: searchParams.get('country')?.split(','),
      types: searchParams.get('types')?.split(','),
      language: searchParams.get('language') || 'ja',
      limit: parseLimit(searchParams.get('limit')),
      sessionId: searchParams.get('sessionId') || undefined,
      userLocation: parseCoordinatePair(searchParams.get('userLocation')),
      includeAlternatives: searchParams.get('includeAlternatives') === 'true',
      includeDetails: searchParams.get('includeDetails') === 'true'
    }

    const result = await enhancedGeocodingService.geocode(query, options)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Geocoding failed' },
        { status: 500 }
      )
    }

    logApiUsage({ api_provider: 'mapbox', api_endpoint: 'geocode', request_count: 1, success: true })
    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Geocoding API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authError = await requireAuthenticatedUser()
    if (authError) return authError

    const body = await request.json()
    const { type, ...options } = body

    switch (type) {
      case 'autocomplete':
        if (!options.query) {
          return NextResponse.json(
            { error: 'Query is required for autocomplete' },
            { status: 400 }
          )
        }
        
        const autocompleteResult = await enhancedGeocodingService.autocomplete(
          options.query,
          options
        )
        
        if (!autocompleteResult.success) {
          return NextResponse.json(
            { error: autocompleteResult.error || 'Autocomplete failed' },
            { status: 500 }
          )
        }

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'geocode', request_count: 1, success: true })
        return NextResponse.json(autocompleteResult.data)

      case 'reverse':
        if (!options.coordinates || !Array.isArray(options.coordinates)) {
          return NextResponse.json(
            { error: 'Coordinates are required for reverse geocoding' },
            { status: 400 }
          )
        }

        const reverseResult = await enhancedGeocodingService.reverseGeocode(
          options.coordinates,
          options
        )

        if (!reverseResult.success) {
          return NextResponse.json(
            { error: reverseResult.error || 'Reverse geocoding failed' },
            { status: 500 }
          )
        }

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'geocode', request_count: 1, success: true })
        return NextResponse.json(reverseResult.data)

      case 'smartSearch':
        if (!options.query) {
          return NextResponse.json(
            { error: 'Query is required for smart search' },
            { status: 400 }
          )
        }

        const smartSearchResult = await enhancedGeocodingService.smartSearch(
          options.query,
          options
        )

        if (!smartSearchResult.success) {
          return NextResponse.json(
            { error: smartSearchResult.error || 'Smart search failed' },
            { status: 500 }
          )
        }

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'geocode', request_count: 1, success: true })
        return NextResponse.json(smartSearchResult.data)

      case 'batch':
        if (!options.queries || !Array.isArray(options.queries)) {
          return NextResponse.json(
            { error: 'Queries array is required for batch geocoding' },
            { status: 400 }
          )
        }

        const batchResult = await enhancedGeocodingService.batchGeocode(
          options.queries,
          options
        )

        if (!batchResult.success) {
          return NextResponse.json(
            { error: batchResult.error || 'Batch geocoding failed' },
            { status: 500 }
          )
        }

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'geocode', request_count: 1, success: true })
        return NextResponse.json(batchResult.data)

      case 'createSession':
        const sessionId = enhancedGeocodingService.createSession(
          options.userId,
          options.location,
          options.language
        )

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'geocode', request_count: 1, success: true })
        return NextResponse.json({ sessionId })

      case 'getSearchSuggestions':
        if (!options.query) {
          return NextResponse.json(
            { error: 'Query is required for search suggestions' },
            { status: 400 }
          )
        }

        const suggestions = enhancedGeocodingService.getSearchSuggestions(
          options.query,
          options.sessionId,
          options.limit
        )

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'geocode', request_count: 1, success: true })
        return NextResponse.json(suggestions)

      case 'analyzeSearchPatterns':
        const patterns = enhancedGeocodingService.analyzeSearchPatterns(
          options.sessionId
        )

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'geocode', request_count: 1, success: true })
        return NextResponse.json(patterns)

      default:
        return NextResponse.json(
          { error: 'Invalid operation type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Geocoding POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
