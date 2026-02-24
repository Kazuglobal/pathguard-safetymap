import { NextRequest, NextResponse } from 'next/server'
import { directionsService } from '@/lib/routing/directions'
import { logApiUsage } from '@/lib/api-usage-logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, ...options } = body

    switch (type) {
      case 'getRoute':
        if (!options.waypoints || !Array.isArray(options.waypoints)) {
          return NextResponse.json(
            { error: 'Waypoints array is required' },
            { status: 400 }
          )
        }

        const routeResult = await directionsService.getRoute(options)

        if (!routeResult.success) {
          return NextResponse.json(
            { error: routeResult.error || 'Route calculation failed' },
            { status: 500 }
          )
        }

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'directions', request_count: 1, success: true })
        return NextResponse.json(routeResult.data)

      case 'getMultiModalRoutes':
        if (!options.origin || !options.destination) {
          return NextResponse.json(
            { error: 'Origin and destination are required' },
            { status: 400 }
          )
        }

        if (!options.profiles || !Array.isArray(options.profiles)) {
          return NextResponse.json(
            { error: 'Profiles array is required' },
            { status: 400 }
          )
        }

        const multiModalResult = await directionsService.getMultiModalRoutes(options)

        if (!multiModalResult.success) {
          return NextResponse.json(
            { error: multiModalResult.error || 'Multi-modal routing failed' },
            { status: 500 }
          )
        }

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'directions', request_count: 1, success: true })
        return NextResponse.json(multiModalResult.data)

      case 'optimizeWaypoints':
        if (!options.waypoints || !Array.isArray(options.waypoints)) {
          return NextResponse.json(
            { error: 'Waypoints array is required' },
            { status: 400 }
          )
        }

        const optimizeResult = await directionsService.optimizeWaypoints(
          options.waypoints,
          options.profile || 'driving',
          options.roundtrip || false
        )

        if (!optimizeResult.success) {
          return NextResponse.json(
            { error: optimizeResult.error || 'Waypoint optimization failed' },
            { status: 500 }
          )
        }

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'directions', request_count: 1, success: true })
        return NextResponse.json(optimizeResult.data)

      case 'getTrafficAwareRoute':
        if (!options.waypoints || !Array.isArray(options.waypoints)) {
          return NextResponse.json(
            { error: 'Waypoints array is required' },
            { status: 400 }
          )
        }

        const trafficResult = await directionsService.getTrafficAwareRoute(options)

        if (!trafficResult.success) {
          return NextResponse.json(
            { error: trafficResult.error || 'Traffic-aware routing failed' },
            { status: 500 }
          )
        }

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'directions', request_count: 1, success: true })
        return NextResponse.json(trafficResult.data)

      case 'getAccessibilityRoute':
        if (!options.waypoints || !Array.isArray(options.waypoints)) {
          return NextResponse.json(
            { error: 'Waypoints array is required' },
            { status: 400 }
          )
        }

        const accessibilityResult = await directionsService.getAccessibilityRoute(
          options,
          options.accessibilityRequirements || []
        )

        if (!accessibilityResult.success) {
          return NextResponse.json(
            { error: accessibilityResult.error || 'Accessibility routing failed' },
            { status: 500 }
          )
        }

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'directions', request_count: 1, success: true })
        return NextResponse.json(accessibilityResult.data)

      case 'getLocalizedInstructions':
        if (!options.waypoints || !Array.isArray(options.waypoints)) {
          return NextResponse.json(
            { error: 'Waypoints array is required' },
            { status: 400 }
          )
        }

        if (!options.profile) {
          return NextResponse.json(
            { error: 'Profile is required' },
            { status: 400 }
          )
        }

        const localizedResult = await directionsService.getLocalizedInstructions(
          options.waypoints,
          options.profile,
          options.languages || ['ja', 'en']
        )

        if (!localizedResult.success) {
          return NextResponse.json(
            { error: localizedResult.error || 'Localized instructions failed' },
            { status: 500 }
          )
        }

        logApiUsage({ api_provider: 'mapbox', api_endpoint: 'directions', request_count: 1, success: true })
        return NextResponse.json(localizedResult.data)

      default:
        return NextResponse.json(
          { error: 'Invalid operation type' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Directions API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const waypointsParam = searchParams.get('waypoints')
    
    if (!waypointsParam) {
      return NextResponse.json(
        { error: 'Waypoints parameter is required' },
        { status: 400 }
      )
    }

    // Parse waypoints from query parameter
    // Expected format: "lng1,lat1;lng2,lat2;lng3,lat3"
    const waypoints = waypointsParam.split(';').map(point => {
      const [lng, lat] = point.split(',').map(Number)
      return { coordinates: [lng, lat] as [number, number] }
    })

    const routeOptions = {
      waypoints,
      profile: (searchParams.get('profile') as any) || 'driving',
      alternatives: searchParams.get('alternatives') === 'true',
      steps: searchParams.get('steps') === 'true',
      geometries: (searchParams.get('geometries') as any) || 'geojson',
      overview: (searchParams.get('overview') as any) || 'full',
      language: searchParams.get('language') || 'ja',
      exclude: searchParams.get('exclude') as any,
      annotations: searchParams.get('annotations')?.split(',') as any
    }

    const result = await directionsService.getRoute(routeOptions)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Route calculation failed' },
        { status: 500 }
      )
    }

    logApiUsage({ api_provider: 'mapbox', api_endpoint: 'directions', request_count: 1, success: true })
    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Directions GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}