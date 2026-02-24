import { NextRequest, NextResponse } from 'next/server'
import { matrixService } from '@/lib/routing/matrix'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, ...options } = body

    switch (type) {
      case 'calculateMatrix':
        if (!options.coordinates || !Array.isArray(options.coordinates)) {
          return NextResponse.json(
            { error: 'Coordinates array is required' },
            { status: 400 }
          )
        }

        const matrixResult = await matrixService.calculateMatrix(options)
        
        if (!matrixResult.success) {
          return NextResponse.json(
            { error: matrixResult.error || 'Matrix calculation failed' },
            { status: 500 }
          )
        }

        return NextResponse.json(matrixResult.data)

      case 'createTravelTimeMatrix':
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

      case 'optimizeRoute':
        if (!options.waypoints || !Array.isArray(options.waypoints)) {
          return NextResponse.json(
            { error: 'Waypoints array is required' },
            { status: 400 }
          )
        }

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

      case 'analyzeServiceArea':
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

      case 'calculateAccessibilityMatrix':
        if (!options.locations || !Array.isArray(options.locations)) {
          return NextResponse.json(
            { error: 'Locations array is required' },
            { status: 400 }
          )
        }

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

      case 'analyzeCommuting':
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

      case 'batchCalculateMatrix':
        if (!options.requests || !Array.isArray(options.requests)) {
          return NextResponse.json(
            { error: 'Requests array is required' },
            { status: 400 }
          )
        }

        const batchResult = await matrixService.batchCalculateMatrix(
          options.requests
        )

        return NextResponse.json(batchResult)

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
