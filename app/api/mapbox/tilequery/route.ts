import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { tilequeryService } from '@/lib/routing/tilequery'
import type { TilequeryLayer } from '@/lib/routing/tilequery'
import { createServerClient } from '@/lib/supabase-server'
import { checkApiRateLimit, rateLimitedResponse } from '@/lib/upstash-rate-limiter'
import { isValidCoordinates } from '@/lib/coordinates'

const MAX_BATCH_SIZE = 10

async function requireAuth() {
  const supabase = await createServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

const coordinatePairSchema = z
  .tuple([z.number(), z.number()])
  .refine(([lng, lat]) => isValidCoordinates(lat, lng), {
    message: '緯度経度の範囲が不正です',
  })

function validateCoordinatePair(value: unknown, label: string): NextResponse | null {
  if (!coordinatePairSchema.safeParse(value).success) {
    return NextResponse.json(
      { error: `${label}の座標が不正です` },
      { status: 400 }
    )
  }
  return null
}

export async function POST(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const rate = await checkApiRateLimit(`mapbox-tilequery:${user.id}`)
  if (!rate.success) {
    return rateLimitedResponse(rate.reset)
  }

  try {
    const body = await request.json()
    const { type, ...options } = body

    switch (type) {
      case 'queryMapFeatures': {
        if (!options.coordinates || !Array.isArray(options.coordinates)) {
          return NextResponse.json(
            { error: 'Coordinates array is required' },
            { status: 400 }
          )
        }

        const coordinatesError = validateCoordinatePair(options.coordinates, 'coordinates')
        if (coordinatesError) return coordinatesError

        const queryResult = await tilequeryService.queryMapFeatures(options)

        if (!queryResult.success) {
          return NextResponse.json(
            { error: queryResult.error || 'Map features query failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(queryResult.data)
      }

      case 'findNearbyPOIs': {
        if (!options.location || !Array.isArray(options.location)) {
          return NextResponse.json(
            { error: 'Location coordinates are required' },
            { status: 400 }
          )
        }

        const locationError = validateCoordinatePair(options.location, 'location')
        if (locationError) return locationError

        const poisResult = await tilequeryService.findNearbyPOIs(
          options.location,
          options.radius || 1000,
          options.layers || undefined,
          options.limit || 50
        )

        if (!poisResult.success) {
          return NextResponse.json(
            { error: poisResult.error || 'POI search failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(poisResult.data)
      }

      case 'analyzeRoutePOIs': {
        if (!options.routeGeometry) {
          return NextResponse.json(
            { error: 'Route geometry is required' },
            { status: 400 }
          )
        }

        const routeAnalysisResult = await tilequeryService.analyzeRoutePOIs(
          options.routeGeometry,
          options.buffer || 500,
          options.layers || undefined,
          options.categories || undefined
        )

        if (!routeAnalysisResult.success) {
          return NextResponse.json(
            { error: routeAnalysisResult.error || 'Route POI analysis failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(routeAnalysisResult.data)
      }

      case 'findEmergencyServices': {
        if (!options.location || !Array.isArray(options.location)) {
          return NextResponse.json(
            { error: 'Location coordinates are required' },
            { status: 400 }
          )
        }

        const locationError = validateCoordinatePair(options.location, 'location')
        if (locationError) return locationError

        const emergencyResult = await tilequeryService.findEmergencyServices(
          options.location,
          options.radius || 5000,
          options.serviceTypes || ['hospital', 'police', 'fire_station']
        )

        if (!emergencyResult.success) {
          return NextResponse.json(
            { error: emergencyResult.error || 'Emergency services search failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(emergencyResult.data)
      }

      case 'analyzeTransportation': {
        if (!options.location || !Array.isArray(options.location)) {
          return NextResponse.json(
            { error: 'Location coordinates are required' },
            { status: 400 }
          )
        }

        const locationError = validateCoordinatePair(options.location, 'location')
        if (locationError) return locationError

        const transportResult = await tilequeryService.analyzeTransportation(
          options.location,
          options.radius || 2000,
          options.transportModes || ['bus', 'train', 'subway']
        )

        if (!transportResult.success) {
          return NextResponse.json(
            { error: transportResult.error || 'Transportation analysis failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(transportResult.data)
      }

      case 'findSafetyFeatures': {
        if (!options.location || !Array.isArray(options.location)) {
          return NextResponse.json(
            { error: 'Location coordinates are required' },
            { status: 400 }
          )
        }

        const locationError = validateCoordinatePair(options.location, 'location')
        if (locationError) return locationError

        const safetyResult = await tilequeryService.findSafetyFeatures(
          options.location,
          options.radius || 1000,
          options.featureTypes || ['emergency_phone', 'lighting', 'cctv']
        )

        if (!safetyResult.success) {
          return NextResponse.json(
            { error: safetyResult.error || 'Safety features search failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(safetyResult.data)
      }

      case 'batchQueryFeatures': {
        if (!options.requests || !Array.isArray(options.requests)) {
          return NextResponse.json(
            { error: 'Requests array is required' },
            { status: 400 }
          )
        }

        if (options.requests.length > MAX_BATCH_SIZE) {
          return NextResponse.json(
            { error: `requestsは最大${MAX_BATCH_SIZE}件までです` },
            { status: 400 }
          )
        }

        for (const tilequeryRequest of options.requests) {
          const requestCoordinatesError = validateCoordinatePair(tilequeryRequest?.coordinates, 'coordinates')
          if (requestCoordinatesError) return requestCoordinatesError
        }

        const batchResult = await tilequeryService.batchQueryFeatures(
          options.requests
        )

        return NextResponse.json(batchResult)
      }

      default:
        return NextResponse.json(
          { error: 'Invalid operation type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Tilequery API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const user = await requireAuth()
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const rate = await checkApiRateLimit(`mapbox-tilequery:${user.id}`)
  if (!rate.success) {
    return rateLimitedResponse(rate.reset)
  }

  try {
    const { searchParams } = new URL(request.url)
    const coordinatesParam = searchParams.get('coordinates')

    if (!coordinatesParam) {
      return NextResponse.json(
        { error: 'Coordinates parameter is required' },
        { status: 400 }
      )
    }

    // Parse coordinates from query parameter
    // Expected format: "lng,lat"
    const [lng, lat] = coordinatesParam.split(',').map(Number)
    const coordinates: [number, number] = [lng, lat]

    const coordinatesError = validateCoordinatePair(coordinates, 'coordinates')
    if (coordinatesError) return coordinatesError

    const parsedLayers = searchParams
      .get('layers')
      ?.split(',')
      .filter(Boolean) as TilequeryLayer[] | undefined

    const tilequeryRequest = {
      coordinates,
      radius: searchParams.get('radius') ? parseInt(searchParams.get('radius')!) : 1000,
      layers: parsedLayers,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
      dedupe: searchParams.get('dedupe') !== 'false',
      geometry: (searchParams.get('geometry') as any) || 'point'
    }

    const result = await tilequeryService.queryMapFeatures(tilequeryRequest)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Map features query failed' },
        { status: 500 }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Tilequery GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
