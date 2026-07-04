import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { matrixService } from '@/lib/routing/matrix'
import { createServerClient } from '@/lib/supabase-server'
import { checkApiRateLimit, rateLimitedResponse } from '@/lib/upstash-rate-limiter'
import { isValidCoordinates } from '@/lib/coordinates'

const MAX_BATCH_SIZE = 25

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

const coordinatesSchema = z.array(coordinatePairSchema).min(2).max(MAX_BATCH_SIZE)

const namedPointSchema = z.object({ coordinates: coordinatePairSchema }).passthrough()

const namedPointsSchema = z.array(namedPointSchema).min(1).max(MAX_BATCH_SIZE)

function validateCoordinates(coordinates: unknown, label = 'coordinates'): NextResponse | null {
  if (!coordinatesSchema.safeParse(coordinates).success) {
    return NextResponse.json(
      { error: `${label}が不正です(2〜${MAX_BATCH_SIZE}件、緯度経度の範囲内で指定してください)` },
      { status: 400 }
    )
  }
  return null
}

function validateNamedPoints(points: unknown, label: string): NextResponse | null {
  if (!namedPointsSchema.safeParse(points).success) {
    return NextResponse.json(
      { error: `${label}が不正です(1〜${MAX_BATCH_SIZE}件、緯度経度の範囲内で指定してください)` },
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

  const rate = await checkApiRateLimit(`mapbox-matrix:${user.id}`)
  if (!rate.success) {
    return rateLimitedResponse(rate.reset)
  }

  try {
    const body = await request.json()
    const { type, ...options } = body

    switch (type) {
      case 'calculateMatrix': {
        if (!options.coordinates || !Array.isArray(options.coordinates)) {
          return NextResponse.json(
            { error: 'Coordinates array is required' },
            { status: 400 }
          )
        }

        const coordinatesError = validateCoordinates(options.coordinates)
        if (coordinatesError) return coordinatesError

        const matrixResult = await matrixService.calculateMatrix(options)

        if (!matrixResult.success) {
          return NextResponse.json(
            { error: matrixResult.error || 'Matrix calculation failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(matrixResult.data)
      }

      case 'createTravelTimeMatrix': {
        if (!options.origins || !Array.isArray(options.origins)) {
          return NextResponse.json(
            { error: 'Origins array is required' },
            { status: 400 }
          )
        }

        if (!options.destinations || !Array.isArray(options.destinations)) {
          return NextResponse.json(
            { error: 'Destinations array is required' },
            { status: 400 }
          )
        }

        const originsError = validateNamedPoints(options.origins, 'origins')
        if (originsError) return originsError

        const destinationsError = validateNamedPoints(options.destinations, 'destinations')
        if (destinationsError) return destinationsError

        const travelTimeResult = await matrixService.createTravelTimeMatrix(
          options.origins,
          options.destinations,
          options.profile || 'driving'
        )

        if (!travelTimeResult.success) {
          return NextResponse.json(
            { error: travelTimeResult.error || 'Travel time matrix creation failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(travelTimeResult.data)
      }

      case 'optimizeRoute': {
        if (!options.waypoints || !Array.isArray(options.waypoints)) {
          return NextResponse.json(
            { error: 'Waypoints array is required' },
            { status: 400 }
          )
        }

        const waypointsError = validateNamedPoints(options.waypoints, 'waypoints')
        if (waypointsError) return waypointsError

        const optimizeResult = await matrixService.optimizeRoute(
          options.waypoints,
          options.profile || 'driving',
          options.returnToStart || false
        )

        if (!optimizeResult.success) {
          return NextResponse.json(
            { error: optimizeResult.error || 'Route optimization failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(optimizeResult.data)
      }

      case 'analyzeServiceArea': {
        if (!options.servicePoints || !Array.isArray(options.servicePoints)) {
          return NextResponse.json(
            { error: 'Service points array is required' },
            { status: 400 }
          )
        }

        if (!options.analysisPoints || !Array.isArray(options.analysisPoints)) {
          return NextResponse.json(
            { error: 'Analysis points array is required' },
            { status: 400 }
          )
        }

        const servicePointsError = validateNamedPoints(options.servicePoints, 'servicePoints')
        if (servicePointsError) return servicePointsError

        const analysisPointsError = validateNamedPoints(options.analysisPoints, 'analysisPoints')
        if (analysisPointsError) return analysisPointsError

        const serviceAreaResult = await matrixService.analyzeServiceArea(
          options.servicePoints,
          options.analysisPoints,
          options.profile || 'driving',
          options.maxServiceDistance || 10000
        )

        if (!serviceAreaResult.success) {
          return NextResponse.json(
            { error: serviceAreaResult.error || 'Service area analysis failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(serviceAreaResult.data)
      }

      case 'calculateAccessibilityMatrix': {
        if (!options.locations || !Array.isArray(options.locations)) {
          return NextResponse.json(
            { error: 'Locations array is required' },
            { status: 400 }
          )
        }

        const locationsError = validateNamedPoints(options.locations, 'locations')
        if (locationsError) return locationsError

        const accessibilityResult = await matrixService.calculateAccessibilityMatrix(
          options.locations
        )

        if (!accessibilityResult.success) {
          return NextResponse.json(
            { error: accessibilityResult.error || 'Accessibility matrix calculation failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(accessibilityResult.data)
      }

      case 'analyzeCommuting': {
        if (!options.residentialAreas || !Array.isArray(options.residentialAreas)) {
          return NextResponse.json(
            { error: 'Residential areas array is required' },
            { status: 400 }
          )
        }

        if (!options.workplaces || !Array.isArray(options.workplaces)) {
          return NextResponse.json(
            { error: 'Workplaces array is required' },
            { status: 400 }
          )
        }

        const residentialAreasError = validateNamedPoints(options.residentialAreas, 'residentialAreas')
        if (residentialAreasError) return residentialAreasError

        const workplacesError = validateNamedPoints(options.workplaces, 'workplaces')
        if (workplacesError) return workplacesError

        const commutingResult = await matrixService.analyzeCommuting(
          options.residentialAreas,
          options.workplaces,
          options.mode || 'driving'
        )

        if (!commutingResult.success) {
          return NextResponse.json(
            { error: commutingResult.error || 'Commuting analysis failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(commutingResult.data)
      }

      case 'batchCalculateMatrix': {
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

        for (const matrixRequest of options.requests) {
          const requestCoordinatesError = validateCoordinates(matrixRequest?.coordinates)
          if (requestCoordinatesError) return requestCoordinatesError
        }

        const batchResult = await matrixService.batchCalculateMatrix(
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
    console.error('Matrix API error:', error)
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

  const rate = await checkApiRateLimit(`mapbox-matrix:${user.id}`)
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
    // Expected format: "lng1,lat1;lng2,lat2;lng3,lat3"
    const coordinates = coordinatesParam.split(';').map(point => {
      const [lng, lat] = point.split(',').map(Number)
      return [lng, lat] as [number, number]
    })

    const coordinatesError = validateCoordinates(coordinates)
    if (coordinatesError) return coordinatesError

    const parsedApproaches = searchParams
      .get("approaches")
      ?.split(",")
      .filter(
        (approach): approach is "unrestricted" | "curb" =>
          approach === "unrestricted" || approach === "curb",
      )

    const matrixRequest = {
      coordinates,
      profile: (searchParams.get('profile') as any) || 'driving',
      annotations: searchParams.get('annotations')?.split(',') as any[] || ['duration', 'distance'],
      sources: searchParams.get('sources')?.split(',').map(Number),
      destinations: searchParams.get('destinations')?.split(',').map(Number),
      approaches: parsedApproaches,
      exclude: searchParams.get('exclude') as any
    }

    const result = await matrixService.calculateMatrix(matrixRequest)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Matrix calculation failed' },
        { status: 500 }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Matrix GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
